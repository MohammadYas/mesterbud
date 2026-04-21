const nodemailer = require('nodemailer');
const { getStore } = require('@netlify/blobs');
const { CORS_HEADERS, parseBody, checkRateLimit, rateLimitResponse } = require('./_security');

const formatKr = (v) =>
  new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(v || 0);

const datoStr = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`send-rykker:${user.sub}`, 10, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  const userId = user.sub;
  const store = getStore('mesterbud');

  try {
    const fakturaId = body?.fakturaId;
    if (!fakturaId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler fakturaId' }) };

    const raw = await store.get(`faktura/${userId}/${fakturaId}`);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
    const faktura = JSON.parse(raw);

    // ── Generer AI-rykkertekst ────────────────────────────────────────────
    if (body.generer) {
      const nyFrist = new Date();
      nyFrist.setDate(nyFrist.getDate() + 8);
      const nyFristStr = datoStr(nyFrist.toISOString());
      const forfaldStr = datoStr(faktura.forfaldsdato);

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'system',
            content: `Du er en dansk virksomhed der sender en professionel rykker for en ubetalt faktura.
Skriv en kort, høflig men tydelig rykkeremail på dansk – max 5 linjer brødtekst.
Professionel tone. Ikke aggressiv, ikke underdanig.
Nævn: fakturanummer, beløb inkl. moms, original forfaldsdato, ny betalingsfrist.
Returner KUN emailens brødtekst – ingen emnelinjer, ingen hilsen/underskrift.

Fakturanummer: ${fakturaId}
Beløb inkl. moms: ${formatKr(faktura.total)}
Original forfaldsdato: ${forfaldStr}
Ny betalingsfrist: ${nyFristStr}
Kundenavn: ${faktura.modtager?.navn || ''}
Afsender: ${faktura.afsender?.firmanavn || ''}`,
          }],
          max_tokens: 300,
        }),
      });

      const aiData = await aiRes.json();
      const tekst = aiData.choices?.[0]?.message?.content?.trim() || '';
      return { statusCode: 200, headers, body: JSON.stringify({ tekst, nyFrist: nyFristStr }) };
    }

    // ── Send rykker (brugeren har godkendt teksten) ─────────────────────
    const rykkerTekst = body.tekst;
    if (!rykkerTekst) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler rykkertekst' }) };
    if (!faktura.modtager?.email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Kundens e-mail mangler' }) };

    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://mesterbud.dk';
    const previewLink = faktura.publicToken
      ? `${siteUrl}/faktura-preview.html?id=${fakturaId}&token=${faktura.publicToken}`
      : '';

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.resend.com',
      port:   parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from:    `${faktura.afsender?.firmanavn || 'Mesterbud'} <${process.env.SMTP_USER}>`,
      to:      faktura.modtager.email,
      subject: `Rykker – Faktura ${fakturaId} fra ${faktura.afsender?.firmanavn || 'Mesterbud'}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1c1c18">
<p>${rykkerTekst.replace(/\n/g, '<br>')}</p>
${previewLink ? `<p style="margin-top:20px"><a href="${previewLink}" style="color:#a23900;font-weight:700">Se faktura online →</a></p>` : ''}
<hr style="border:none;border-top:1px solid #e1bfb3;margin:24px 0">
<p style="font-size:12px;color:#8d7167">Sendt via Mesterbud &middot; ${faktura.afsender?.firmanavn || ''}</p>
</div>`,
      text: rykkerTekst,
    });

    // Opdater faktura
    faktura.rykkerSendt  = new Date().toISOString();
    faktura.rykkerAntal  = (faktura.rykkerAntal || 0) + 1;
    await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));

    console.log(`Rykker sendt til ${faktura.modtager.email} for faktura ${fakturaId}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.error('send-rykker fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

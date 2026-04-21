const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { CORS_HEADERS, parseBody, checkRateLimit, rateLimitResponse } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`send-faktura:${user.sub}`, 20, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  const fakturaId = body?.fakturaId;
  if (!fakturaId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler fakturaId' }) };

  const store = getStore('mesterbud');
  const userId = user.sub;

  try {
    const raw = await store.get(`faktura/${userId}/${fakturaId}`);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
    const faktura = JSON.parse(raw);

    if (!faktura.modtager?.email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Kundens e-mail mangler på fakturaen' }) };
    }

    // Generer eller genbrug public token
    const token = faktura.publicToken || crypto.randomBytes(32).toString('hex');

    // Gem public mapping (fakturaId → userId)
    await store.set(`meta/faktura-public/${fakturaId}`, JSON.stringify({ userId }));

    // Opdater faktura med token + status
    faktura.publicToken = token;
    faktura.status = 'afventer_betaling';
    faktura.sendt = new Date().toISOString();
    await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));

    const siteUrl = process.env.SITE_URL || process.env.URL || 'https://mesterbud.dk';
    const previewLink = `${siteUrl}/faktura-preview.html?id=${fakturaId}&token=${token}`;

    const formatKr = (v) =>
      new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK' }).format(v || 0);

    const forfaldStr = faktura.forfaldsdato
      ? new Date(faktura.forfaldsdato).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

    const betalingLinjer = [
      faktura.afsender.regNr && faktura.afsender.kontoNr
        ? `Reg.nr. ${faktura.afsender.regNr} &nbsp;|&nbsp; Konto: ${faktura.afsender.kontoNr}`
        : '',
      faktura.afsender.mobilePay
        ? `MobilePay: ${faktura.afsender.mobilePay}`
        : '',
    ].filter(Boolean).join('<br>');

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.resend.com',
      port:   parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from:    `${faktura.afsender.firmanavn || 'Mesterbud'} <${process.env.SMTP_USER}>`,
      to:      faktura.modtager.email,
      subject: `Faktura ${fakturaId} fra ${faktura.afsender.firmanavn || 'Mesterbud'}`,
      html: `
<div style="font-family:'Plus Jakarta Sans',sans-serif;max-width:600px;margin:0 auto;color:#1c1c18">
  <div style="background:#a23900;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px;font-family:Georgia,serif">Faktura ${fakturaId}</h1>
    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px">${faktura.afsender.firmanavn || ''}</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e1bfb3;border-top:none;border-radius:0 0 12px 12px">
    <p style="margin-top:0">Hej ${faktura.modtager.kontaktperson || faktura.modtager.navn || 'der'},</p>
    <p>Hermed fremsendes faktura på <strong>${formatKr(faktura.total)}</strong> inkl. moms.<br>
    Forfaldsdato: <strong>${forfaldStr}</strong>.</p>

    <div style="text-align:center;margin:28px 0">
      <a href="${previewLink}" style="display:inline-block;background:#a23900;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px">
        Se og download faktura →
      </a>
    </div>

    ${betalingLinjer ? `
    <div style="background:#f7f3ed;padding:16px 20px;border-radius:8px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#594138">Betalingsinformation</p>
      <p style="margin:0;font-size:14px;line-height:1.8">${betalingLinjer}</p>
    </div>` : ''}

    ${faktura.note ? `<p style="font-size:14px;color:#594138;border-left:3px solid #e1bfb3;padding-left:12px;">${faktura.note}</p>` : ''}

    <hr style="border:none;border-top:1px solid #e1bfb3;margin:24px 0">
    <p style="font-size:12px;color:#8d7167;margin:0">
      Sendt via <a href="https://mesterbud.dk" style="color:#a23900">Mesterbud</a>
    </p>
  </div>
</div>`,
      text: `Faktura ${fakturaId} – ${formatKr(faktura.total)} inkl. moms – forfald ${forfaldStr}\n\nSe faktura: ${previewLink}`,
    });

    console.log(`Faktura ${fakturaId} sendt til ${faktura.modtager.email}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, previewLink }) };
  } catch (e) {
    console.error('send-faktura fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Afsendelse fejlede: ' + e.message }) };
  }
};

/**
 * send-tilbud.js – sender tilbud-email til kunden med unikt token-link
 * Genererer publicToken, gemmer public-mapping, opdaterer status → sendt
 */
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { CORS_HEADERS, parseBody, checkRateLimit, rateLimitResponse, sanitizeString } = require('./_security');

const SITE = process.env.SITE_URL || process.env.URL || 'https://mesterbud.dk';

function formatKr(v) {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0) + ' kr.';
}

function formatDato(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildHtml(t, previewUrl) {
  const firma = t.afsender?.firmanavn || 'Din håndværker';
  const kontakt = t.modtager?.kontaktperson || t.modtager?.navn || '';
  const gyldig = formatDato(t.gyldigTil);
  const total = formatKr(t.total);

  return `<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EC;font-family:'Plus Jakarta Sans',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #E2DAD0;overflow:hidden">

  <!-- Header -->
  <tr><td style="background:#1A1A18;padding:24px 32px">
    <span style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#fff">${firma}</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 32px">
    ${kontakt ? `<p style="font-size:16px;color:#52524C;margin:0 0 8px">Hej ${kontakt},</p>` : ''}
    <p style="font-size:16px;color:#1A1A18;margin:0 0 32px;font-weight:600">${firma} har sendt dig et tilbud.</p>

    <!-- Tilbudsinfo boks -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2EC;border-radius:8px;margin-bottom:16px">
    <tr><td style="padding:20px 24px">
      <p style="margin:0 0 4px;font-size:12px;color:#8C8C84;text-transform:uppercase;letter-spacing:1px">Tilbudsnummer</p>
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1A1A18">${t.id}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#8C8C84;text-transform:uppercase;letter-spacing:1px">Beløb inkl. moms</p>
      <p style="margin:0 0 16px;font-size:28px;font-family:Georgia,serif;font-weight:600;color:#1A1A18">${total}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#8C8C84;text-transform:uppercase;letter-spacing:1px">Gyldigt til</p>
      <p style="margin:0;font-size:15px;color:#1A1A18">${gyldig}</p>
    </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0">
      <a href="${previewUrl}" style="display:inline-block;background:#D4500A;color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:8px">
        Se og accepter tilbud →
      </a>
    </td></tr></table>

    <p style="margin:0;font-size:13px;color:#8C8C84;text-align:center">
      Linket er personligt og gyldigt til ${gyldig}.<br>
      Problemer? Skriv til <a href="mailto:${t.afsender?.email || ''}" style="color:#D4500A">${t.afsender?.email || firma}</a>
    </p>
  </td></tr>

  <!-- Afsender info -->
  <tr><td style="padding:24px 32px;border-top:1px solid #E2DAD0">
    <p style="margin:0;font-size:14px;color:#1A1A18;font-weight:600">${firma}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#8C8C84">
      ${t.afsender?.telefon ? t.afsender.telefon + ' · ' : ''}${t.afsender?.email || ''}
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px;background:#F6F2EC;border-top:1px solid #E2DAD0;text-align:center">
    <p style="margin:0;font-size:11px;color:#8C8C84">
      Sendt via <a href="${SITE}" style="color:#D4500A">Mesterbud.dk</a> · Bygget i Danmark 🇩🇰
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`send-tilbud:${user.sub}`, 20, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  const tilbudsId = sanitizeString(body?.tilbudsId || '', 20);
  if (!tilbudsId || !/^MB-\d{4}-\d{3,6}$/.test(tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID' }) };
  }

  const store = getStore('mesterbud');
  const userId = user.sub;

  try {
    const raw = await store.get(`tilbud/${userId}/${tilbudsId}`);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
    const tilbud = JSON.parse(raw);

    if (!tilbud.modtager?.email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Kundens e-mail mangler på tilbuddet' }) };
    }

    // Generer eller genbrug token
    const token = tilbud.publicToken || crypto.randomBytes(32).toString('hex');

    // Gem public mapping (tilbudsId → userId) til brug for get-tilbud-public + update-tilbud-status
    await store.set(`meta/tilbud-public/${tilbudsId}`, JSON.stringify({ userId }));

    // Opdater tilbud
    tilbud.publicToken = token;
    tilbud.status = 'sendt';
    tilbud.sendt = new Date().toISOString();
    tilbud.opdateret = new Date().toISOString();
    await store.set(`tilbud/${userId}/${tilbudsId}`, JSON.stringify(tilbud));

    const previewUrl = `${SITE}/tilbud-preview.html?id=${tilbudsId}&token=${token}`;

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.resend.com',
      port:   parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS },
    });

    const firma = tilbud.afsender?.firmanavn || 'Mesterbud';

    await transporter.sendMail({
      from:    `${firma} <${process.env.SMTP_USER || 'noreply@mesterbud.dk'}>`,
      replyTo: tilbud.afsender?.email || undefined,
      to:      tilbud.modtager.email,
      subject: `Tilbud fra ${firma}`,
      html:    buildHtml(tilbud, previewUrl),
      text:    `Hej,\n\n${firma} har sendt dig et tilbud på ${formatKr(tilbud.total)} inkl. moms.\n\nGyldigt til: ${formatDato(tilbud.gyldigTil)}\n\nSe tilbud: ${previewUrl}`,
    });

    console.log(`Tilbud ${tilbudsId} sendt til ${tilbud.modtager.email}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, previewLink: previewUrl }) };
  } catch (e) {
    console.error('send-tilbud fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Afsendelse fejlede: ' + e.message }) };
  }
};

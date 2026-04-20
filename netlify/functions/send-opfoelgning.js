const nodemailer = require('nodemailer');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, sanitizeString, sanitizeEmail, CORS_HEADERS,
} = require('./_security');

// Maks. mails pr. dag pr. bruger
const DAGLIG_MAIL_KVOTE = 50;

async function checkMailKvote(store, userId) {
  const dag = new Date().toISOString().slice(0, 10);
  const key = `meta/${userId}/mail-kvote/${dag}`;
  try {
    const raw = await store.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= DAGLIG_MAIL_KVOTE) return false;
    await store.set(key, String(count + 1));
    return true;
  } catch {
    return true;
  }
}

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Burst: maks. 5 mails/min pr. bruger
  const rl = checkRateLimit(`send-mail:${user.sub}`, 5, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const { valid, errors, data } = validateSchema(body, {
    tilbudsId:      { type: 'string', required: true, maxLen: 20 },
    mailTekst:      { type: 'string', required: true, maxLen: 3000 },
    kundeEmail:     { type: 'email', required: true },
    kundenavn:      { type: 'string', maxLen: 100 },
    afsenderFirma:  { type: 'string', maxLen: 150 },
  });
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  // Valider tilbuds-ID format
  if (!/^MB-\d{4}-\d{3,6}$/.test(data.tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID format' }) };
  }

  const store = getStore('mesterbud');

  // Daglig mailkvote
  const tilladt = await checkMailKvote(store, user.sub);
  if (!tilladt) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: `Daglig mailgrænse på ${DAGLIG_MAIL_KVOTE} nået. Prøv igen i morgen.` }) };
  }

  const previewUrl = `${process.env.URL || 'https://mesterbud.dk'}/tilbud-preview.html?id=${data.tilbudsId}`;
  const kundenavn = data.kundenavn || 'kunde';
  const firma = sanitizeString(data.afsenderFirma, 150);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `${firma || 'Mesterbud'} <noreply@mesterbud.dk>`,
      to: data.kundeEmail,
      subject: `Opfølgning på tilbud – ${firma || 'din håndværker'}`,
      text: `Hej ${kundenavn},\n\n${data.mailTekst}\n\nDu kan se tilbuddet her:\n${previewUrl}\n\nMed venlig hilsen\n${firma || ''}`,
      html: `<p>Hej ${kundenavn},</p>
<p>${data.mailTekst.replace(/\n/g, '<br>')}</p>
<p><a href="${previewUrl}" style="background:#a23900;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;">Se tilbud</a></p>
<p>Med venlig hilsen<br><strong>${firma || ''}</strong></p>
<hr style="margin-top:32px;border:none;border-top:1px solid #e1bfb3">
<p style="font-size:11px;color:#8d7167">Sendt via Mesterbud · mesterbud.dk</p>`,
    });

    // Opdatér tilbud med opfølgningsdato
    const key = `tilbud/${user.sub}/${data.tilbudsId}`;
    const raw = await store.get(key);
    if (raw) {
      const t = JSON.parse(raw);
      t.opfoelgningsendt = new Date().toISOString();
      await store.set(key, JSON.stringify(t));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.error('send-opfoelgning fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Fejl ved afsendelse' }) };
  }
};

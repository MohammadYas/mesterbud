/**
 * admin-send-mail.js
 * POST { til: "alle" | email-string, emne: string, besked: string }
 * Sender email til alle brugere eller specifik modtager.
 * Rate limit: maks. 1 "alle"-mail per 10 min (gem timestamp i Blobs: admin/last-bulk-mail)
 */

const nodemailer = require('nodemailer');
const { getStore } = require('@netlify/blobs');
const { adminGuard, ADMIN_HEADERS } = require('./_admin-auth');
const { logActivity, logError } = require('./_admin-log');
const { parseBody, sanitizeString, sanitizeEmail } = require('./_security');

const BULK_COOLDOWN_MS = 10 * 60 * 1000; // 10 min

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const til = sanitizeString(body.til || '', 254);
  const emne = sanitizeString(body.emne || '', 200);
  const besked = sanitizeString(body.besked || '', 5000);

  if (!til) return err('Mangler modtager');
  if (!emne) return err('Mangler emne');
  if (!besked) return err('Mangler besked');

  const { user: adminUser } = context.clientContext;
  const store = getStore('mesterbud');

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

    const fromAddress = `Mesterbud <${process.env.SMTP_USER}>`;

    // ── Send til alle brugere ──────────────────────────────────────────────
    if (til === 'alle') {
      // Rate limit: maks. 1 bulk-mail per 10 min
      try {
        const lastBulkRaw = await store.get('admin/last-bulk-mail');
        if (lastBulkRaw) {
          const lastTs = parseInt(lastBulkRaw, 10);
          const elapsed = Date.now() - lastTs;
          if (elapsed < BULK_COOLDOWN_MS) {
            const ventMin = Math.ceil((BULK_COOLDOWN_MS - elapsed) / 60000);
            return err(`Vent venligst ${ventMin} minut(ter) før næste masseudsendelse.`, 429);
          }
        }
      } catch {}

      // Hent alle brugere fra Netlify Identity API
      let emails = [];
      if (process.env.NETLIFY_API_TOKEN && process.env.NETLIFY_SITE_ID) {
        try {
          let page = 1;
          const perPage = 100;
          while (true) {
            const resp = await fetch(
              `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/identity/users?per_page=${perPage}&page=${page}`,
              { headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` } }
            );
            if (!resp.ok) break;
            const data = await resp.json();
            const users = data.users || [];
            emails.push(...users.map(u => u.email).filter(Boolean));
            if (users.length < perPage) break;
            page++;
          }
        } catch (e) {
          await logError('admin-send-mail', 'Kunne ikke hente brugerliste: ' + e.message);
          return err('Kunne ikke hente brugerliste: ' + e.message);
        }
      } else {
        return err('NETLIFY_API_TOKEN eller NETLIFY_SITE_ID mangler i miljøvariabler');
      }

      if (!emails.length) return err('Ingen brugere fundet');

      // Gem timestamp for seneste bulk-mail
      await store.set('admin/last-bulk-mail', String(Date.now()));

      // Send til hver bruger enkeltvis
      let sendt = 0;
      for (const email of emails) {
        try {
          await transporter.sendMail({
            from: fromAddress,
            to: email,
            subject: emne,
            text: besked,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<p>${besked.replace(/\n/g, '<br>')}</p>
<hr style="margin-top:32px;border:none;border-top:1px solid #e1bfb3">
<p style="font-size:11px;color:#8d7167">Mesterbud &middot; mesterbud.dk</p>
</div>`,
          });
          sendt++;
        } catch {}
      }

      await logActivity('admin_bulk_mail', `Admin sendte masseemail til ${sendt} brugere: "${emne}"`, {
        adminEmail: adminUser.email,
        emne,
        antal: sendt,
      });

      return ok({ antal: sendt });
    }

    // ── Send til specifik email ────────────────────────────────────────────
    const modtager = sanitizeEmail(til);
    if (!modtager) return err('Ugyldig email-adresse');

    await transporter.sendMail({
      from: fromAddress,
      to: modtager,
      subject: emne,
      text: besked,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
<p>${besked.replace(/\n/g, '<br>')}</p>
<hr style="margin-top:32px;border:none;border-top:1px solid #e1bfb3">
<p style="font-size:11px;color:#8d7167">Mesterbud &middot; mesterbud.dk</p>
</div>`,
    });

    await logActivity('admin_single_mail', `Admin sendte email til ${modtager}: "${emne}"`, {
      adminEmail: adminUser.email,
      emne,
      modtager,
    });

    return ok({ antal: 1 });

  } catch (e) {
    await logError('admin-send-mail', e.message);
    return { statusCode: 500, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Afsendelse fejlede: ' + e.message }) };
  }
};

function ok(data) {
  return { statusCode: 200, headers: ADMIN_HEADERS, body: JSON.stringify({ success: true, ...data }) };
}
function err(msg, code = 400) {
  return { statusCode: code, headers: ADMIN_HEADERS, body: JSON.stringify({ error: msg }) };
}

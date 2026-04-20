/**
 * admin-action.js
 * Håndterer alle admin-handlinger:
 *   give_pro          – giv bruger 30 dages gratis Pro
 *   cancel_sub        – annullér Stripe-abonnement
 *   delete_user       – slet bruger + alle data
 *   clear_error_log   – ryd fejllog
 *   send_test_email   – send testmail til admin
 * Alle handlinger logges til aktivitetslog.
 */

const Stripe = require('stripe');
const nodemailer = require('nodemailer');
const { getStore } = require('@netlify/blobs');
const { adminGuard, ADMIN_HEADERS, ADMIN_EMAIL } = require('./_admin-auth');
const { logActivity, logError, clearErrorLog } = require('./_admin-log');
const { parseBody, sanitizeString } = require('./_security');

const GYLDIGE_ACTIONS = ['give_pro', 'cancel_sub', 'delete_user', 'clear_error_log', 'send_test_email'];

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const action = sanitizeString(body.action || '', 50);
  const targetUserId = sanitizeString(body.userId || '', 128);
  const targetEmail = sanitizeString(body.email || '', 254);

  if (!GYLDIGE_ACTIONS.includes(action)) {
    return { statusCode: 400, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Ukendt handling' }) };
  }

  const store = getStore('mesterbud');
  const { user: adminUser } = context.clientContext;

  try {
    // ── give_pro: giv bruger 30 dages gratis Pro ──────────────────────────
    if (action === 'give_pro') {
      if (!targetUserId) return err('Mangler userId');

      const profilKey = `profil/${targetUserId}`;
      const raw = await store.get(profilKey);
      const profil = raw ? JSON.parse(raw) : {};

      const udloeber = new Date(Date.now() + 30 * 86400000).toISOString();
      profil.plan = 'pro';
      profil.proGratis = true;
      profil.proGratisUdloeber = udloeber;
      profil.opdateret = new Date().toISOString();
      await store.set(profilKey, JSON.stringify(profil));

      await logActivity('admin_give_pro', `Admin gav gratis Pro til ${targetEmail || targetUserId}`, {
        userId: targetUserId, email: targetEmail, udloeber, adminEmail: adminUser.email,
      });

      return ok({ message: `Pro aktiveret til ${udloeber.slice(0, 10)}` });
    }

    // ── cancel_sub: annullér Stripe-abonnement ────────────────────────────
    if (action === 'cancel_sub') {
      if (!targetUserId) return err('Mangler userId');

      const raw = await store.get(`profil/${targetUserId}`);
      const profil = raw ? JSON.parse(raw) : {};

      if (!profil.stripeSubscriptionId) {
        return err('Ingen aktiv Stripe-abonnement fundet for denne bruger');
      }

      const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(profil.stripeSubscriptionId);

      profil.plan = 'none';
      profil.opdateret = new Date().toISOString();
      await store.set(`profil/${targetUserId}`, JSON.stringify(profil));

      await logActivity('admin_cancel_sub', `Admin annullerede abonnement for ${targetEmail || targetUserId}`, {
        userId: targetUserId, email: targetEmail, adminEmail: adminUser.email,
      });

      return ok({ message: 'Abonnement annulleret' });
    }

    // ── delete_user: slet bruger og alle data ─────────────────────────────
    if (action === 'delete_user') {
      if (!targetUserId) return err('Mangler userId');

      // Slet tilbud-blobs
      const tilbudList = await store.list({ prefix: `tilbud/${targetUserId}/` });
      await Promise.all(tilbudList.blobs.map(b => store.delete(b.key).catch(() => {})));

      // Slet meta-blobs
      const metaList = await store.list({ prefix: `meta/${targetUserId}/` });
      await Promise.all(metaList.blobs.map(b => store.delete(b.key).catch(() => {})));

      // Slet profil
      await store.delete(`profil/${targetUserId}`).catch(() => {});

      // Slet fra Netlify Identity via API
      if (process.env.NETLIFY_API_TOKEN && process.env.NETLIFY_SITE_ID) {
        try {
          await fetch(
            `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/identity/users/${targetUserId}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` },
            }
          );
        } catch (e) {
          console.error('Netlify Identity delete fejl:', e.message);
        }
      }

      await logActivity('admin_delete_user', `Admin slettede bruger ${targetEmail || targetUserId}`, {
        userId: targetUserId, email: targetEmail, adminEmail: adminUser.email,
      });

      return ok({ message: 'Bruger og al data slettet' });
    }

    // ── clear_error_log ────────────────────────────────────────────────────
    if (action === 'clear_error_log') {
      await clearErrorLog();
      await logActivity('admin_clear_errors', 'Admin ryddede fejllog', { adminEmail: adminUser.email });
      return ok({ message: 'Fejllog ryddet' });
    }

    // ── send_test_email ────────────────────────────────────────────────────
    if (action === 'send_test_email') {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'Mesterbud Admin <noreply@mesterbud.dk>',
        to: ADMIN_EMAIL,
        subject: 'Mesterbud – testmail fra admin panel',
        text: `Testmail sendt ${new Date().toLocaleString('da-DK')} fra admin panel.\nSmtp: ${process.env.SMTP_HOST}`,
        html: `<p>Testmail sendt <strong>${new Date().toLocaleString('da-DK')}</strong> fra admin panel.</p><p>SMTP: <code>${process.env.SMTP_HOST}</code></p>`,
      });

      await logActivity('admin_test_email', 'Admin sendte testmail', { adminEmail: adminUser.email });
      return ok({ message: `Testmail sendt til ${ADMIN_EMAIL}` });
    }

  } catch (e) {
    console.error('admin-action fejl:', e);
    await logError('admin-action', e.message);
    return { statusCode: 500, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Handlingen fejlede: ' + e.message }) };
  }
};

function ok(data) {
  return { statusCode: 200, headers: ADMIN_HEADERS, body: JSON.stringify({ success: true, ...data }) };
}
function err(msg, code = 400) {
  return { statusCode: code, headers: ADMIN_HEADERS, body: JSON.stringify({ error: msg }) };
}

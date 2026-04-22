/**
 * _notifikationer.js – intern notifikationsmodul
 * Sender email-notifikationer til brugeren (håndværkeren) om aktivitet på tilbud/fakturaer.
 */
const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.resend.com',
    port:   parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: process.env.SMTP_USER || 'resend', pass: process.env.SMTP_PASS },
  });
}

const SITE = process.env.SITE_URL || process.env.URL || 'https://mesterbud.dk';
const FROM = process.env.SMTP_USER || 'noreply@mesterbud.dk';

// ── Email templates ───────────────────────────────────────────────────────────

function wrapEmail(indhold) {
  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F2EC;font-family:'Plus Jakarta Sans',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #E2DAD0;overflow:hidden">
  <tr><td style="background:#1A1A18;padding:24px 32px">
    <span style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:#fff">Mesterbud</span>
  </td></tr>
  <tr><td style="padding:32px">${indhold}</td></tr>
  <tr><td style="padding:16px 32px;background:#F6F2EC;border-top:1px solid #E2DAD0;text-align:center">
    <p style="margin:0;font-size:11px;color:#8C8C84">
      Sendt via <a href="${SITE}" style="color:#D4500A">Mesterbud.dk</a> · Bygget i Danmark
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function knap(url, tekst) {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0">
<a href="${url}" style="display:inline-block;background:#D4500A;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px">${tekst} →</a>
</td></tr></table>`;
}

const templates = {

  dokument_set: (d) => ({
    emne: `👁 ${d.kundeNavn} har åbnet dit ${d.dokumentType} – ${d.dokumentNr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 16px">
  <strong>${d.kundeNavn}</strong>${d.firmaNavnKunde ? ` fra <strong>${d.firmaNavnKunde}</strong>` : ''}
  har netop åbnet dit ${d.dokumentType} <strong>${d.dokumentNr}</strong>.
</p>
<p style="color:#52524C;margin:0 0 24px">Nu er det et godt tidspunkt at ringe og følge op.</p>
${knap(`${SITE}/dashboard.html`, 'Se i dashboard')}`)
  }),

  tilbud_accepteret: (d) => ({
    emne: `✅ Tilbud accepteret – ${d.dokumentNr} – ${d.totalStr}`,
    html: wrapEmail(`
<p style="font-size:18px;font-weight:700;color:#1A1A18;margin:0 0 12px">Tillykke! Tilbud accepteret.</p>
<p style="color:#52524C;margin:0 0 24px">
  <strong>${d.kundeNavn}</strong>${d.firmaNavnKunde ? ` fra <strong>${d.firmaNavnKunde}</strong>` : ''}
  har accepteret tilbud <strong>${d.dokumentNr}</strong> på <strong>${d.totalStr}</strong>.
</p>
<p style="color:#52524C;margin:0 0 24px">Du kan nu konvertere tilbuddet til en faktura når arbejdet er udført.</p>
${knap(`${SITE}/dashboard.html`, 'Konverter til faktura')}`)
  }),

  tilbud_afvist: (d) => ({
    emne: `❌ Tilbud afvist – ${d.dokumentNr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 12px">
  <strong>${d.kundeNavn}</strong>${d.firmaNavnKunde ? ` fra <strong>${d.firmaNavnKunde}</strong>` : ''}
  har afvist tilbud <strong>${d.dokumentNr}</strong>.
</p>
${d.besked ? `<div style="background:#FEF2F2;border-radius:8px;padding:16px 20px;margin-bottom:20px">
  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#B91C1C;text-transform:uppercase">Kundens besked</p>
  <p style="margin:0;color:#1A1A18;font-style:italic">"${d.besked}"</p>
</div>` : ''}
${knap(`${SITE}/dashboard.html`, 'Se tilbud i dashboard')}`)
  }),

  tilbud_udloeber_snart: (d) => ({
    emne: `⏰ Dit tilbud udløber om 3 dage – ${d.dokumentNr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 12px">
  Dit tilbud <strong>${d.dokumentNr}</strong> til <strong>${d.firmaNavnKunde || d.kundeNavn}</strong>
  udløber om 3 dage (${d.gyldigDato}).
</p>
<p style="color:#52524C;margin:0 0 24px">Overvej at sende en opfølgning for at minde kunden om tilbuddet.</p>
${knap(`${SITE}/dashboard.html`, 'Send opfølgning')}`)
  }),

  faktura_forfalder_snart: (d) => ({
    emne: `⏰ Faktura forfalder om 3 dage – ${d.dokumentNr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 12px">
  Faktura <strong>${d.dokumentNr}</strong> til <strong>${d.firmaNavnKunde || d.kundeNavn}</strong>
  forfalder om 3 dage (${d.forfaldsDato}).
</p>
<p style="color:#52524C;margin:0 0 8px">Beløb: <strong>${d.totalStr}</strong></p>
${knap(`${SITE}/dashboard.html`, 'Se faktura')}`)
  }),

  faktura_forfalden: (d) => ({
    emne: `🔴 Faktura forfalden – ${d.dokumentNr} – ${d.totalStr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 12px">
  Faktura <strong>${d.dokumentNr}</strong> til <strong>${d.firmaNavnKunde || d.kundeNavn}</strong>
  er forfalden siden ${d.forfaldsDato}.
</p>
<p style="color:#52524C;margin:0 0 24px">Beløb: <strong>${d.totalStr}</strong></p>
${knap(`${SITE}/dashboard.html`, 'Send rykker')}`)
  }),

  faktura_betalt_af_kunde: (d) => ({
    emne: `💰 ${d.kundeNavn} bekræfter betaling – ${d.dokumentNr}`,
    html: wrapEmail(`
<p style="font-size:16px;color:#1A1A18;margin:0 0 12px">
  <strong>${d.kundeNavn}</strong>${d.firmaNavnKunde ? ` fra <strong>${d.firmaNavnKunde}</strong>` : ''}
  bekræfter at have betalt faktura <strong>${d.dokumentNr}</strong> på <strong>${d.totalStr}</strong>.
</p>
<p style="color:#52524C;margin:0 0 24px">Verificér betalingen i din bank og markér fakturaen som betalt.</p>
${knap(`${SITE}/dashboard.html`, 'Marker som betalt')}`)
  }),
};

/**
 * sendNotifikation({ type, til, data, notifPraeferencer? })
 * type: 'dokument_set' | 'tilbud_accepteret' | 'tilbud_afvist' |
 *       'tilbud_udloeber_snart' | 'faktura_forfalder_snart' | 'faktura_forfalden' | 'faktura_betalt_af_kunde'
 * til: brugerens email
 * data: { kundeNavn, firmaNavnKunde, dokumentNr, dokumentType, totalStr, ... }
 * notifPraeferencer: objekt fra profil (undefined = send alt)
 */
async function sendNotifikation({ type, til, data, notifPraeferencer } = {}) {
  if (!til || !type) return;
  if (!process.env.SMTP_PASS) return; // Ingen SMTP konfigureret – skip stille

  // Tjek brugerens præferencer (default: alt tilladt)
  if (notifPraeferencer) {
    const matrice = {
      'dokument_set':            'dokument_set',
      'tilbud_accepteret':       'tilbud_accepteret',
      'tilbud_afvist':           'tilbud_afvist',
      'tilbud_udloeber_snart':   'tilbud_udloeber_snart',
      'faktura_forfalder_snart': 'faktura_forfalder_snart',
      'faktura_forfalden':       'faktura_forfalden',
      'faktura_betalt_af_kunde': 'faktura_betalt_af_kunde',
    };
    const felt = matrice[type];
    if (felt && notifPraeferencer[felt] === false) return;
  }

  const tpl = templates[type];
  if (!tpl) { console.warn('Ukendt notifikationstype:', type); return; }

  const { emne, html } = tpl(data);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `Mesterbud <${FROM}>`,
      to: til,
      subject: emne,
      html,
      text: emne, // Simpel fallback
    });
    console.log(`Notifikation sendt [${type}] → ${til}`);
  } catch (e) {
    // Log men fail soft – notifikationsfejl må ikke crashe workflow
    console.error(`Notifikation fejlede [${type}]:`, e.message);
  }
}

module.exports = { sendNotifikation };

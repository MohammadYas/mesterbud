/**
 * check-forfald.js – Netlify Scheduled Function, kører kl. 02:00 UTC dagligt
 *
 * TILBUD:
 * - status sendt/set + gyldigTil < i dag → mark 'udloebet', notify
 * - status sendt/set + gyldigTil = om 3 dage → notify "udløber snart"
 *
 * FAKTURAER:
 * - status afventer_betaling/set + forfaldsdato < i dag → mark 'forfalden', notify
 * - status afventer_betaling/set + forfaldsdato = om 3 dage → notify "forfalder snart"
 */
const { getStore } = require('@netlify/blobs');
const { sendNotifikation } = require('./_notifikationer');

function formatDato(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatKr(v) {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0 }).format(v || 0) + ' kr.';
}

function erOm3Dage(datoStr, idag) {
  if (!datoStr) return false;
  const dato = new Date(datoStr);
  dato.setHours(0, 0, 0, 0);
  const diff = Math.round((dato - idag) / 86400000);
  return diff === 3;
}

function erPasseret(datoStr, idag) {
  if (!datoStr) return false;
  const dato = new Date(datoStr);
  dato.setHours(0, 0, 0, 0);
  return dato < idag;
}

exports.handler = async () => {
  const store = getStore('mesterbud');
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  let tilbudOpdateret = 0;
  let fakturaOpdateret = 0;

  try {
    const profiler = await store.list({ prefix: 'profil/' });

    for (const profilBlob of profiler.blobs) {
      const userId = profilBlob.key.replace('profil/', '');

      // Hent brugeremail + notifpræferencer
      let brugerEmail = '';
      let notifPraeferencer = undefined;
      try {
        const profilRaw = await store.get(profilBlob.key);
        if (profilRaw) {
          const profil = JSON.parse(profilRaw);
          brugerEmail = profil.virksomhed?.email || profil.email || '';
          notifPraeferencer = profil.notifikationer;
        }
      } catch {}

      // ── TILBUD ─────────────────────────────────────────────────────────────
      try {
        const tilbudBlobs = await store.list({ prefix: `tilbud/${userId}/` });
        for (const blob of tilbudBlobs.blobs) {
          try {
            const raw = await store.get(blob.key);
            if (!raw) continue;
            const tilbud = JSON.parse(raw);

            if (!['sendt', 'set'].includes(tilbud.status)) continue;

            const kundeNavn = tilbud.modtager?.kontaktperson || tilbud.modtager?.navn || 'Kunden';
            const firmaNavnKunde = tilbud.modtager?.navn || '';

            if (erPasseret(tilbud.gyldigTil, idag)) {
              // Marker udløbet
              tilbud.status = 'udloebet';
              tilbud.opdateret = new Date().toISOString();
              await store.set(blob.key, JSON.stringify(tilbud));
              tilbudOpdateret++;
              console.log(`Tilbud ${tilbud.id} markeret som udløbet`);

              if (brugerEmail) {
                await sendNotifikation({
                  type: 'tilbud_udloeber_snart', // genbruger template med "allerede udløbet" kontekst
                  til: brugerEmail,
                  data: { dokumentNr: tilbud.id, kundeNavn, firmaNavnKunde, gyldigDato: formatDato(tilbud.gyldigTil) },
                  notifPraeferencer,
                });
              }
            } else if (erOm3Dage(tilbud.gyldigTil, idag) && brugerEmail) {
              await sendNotifikation({
                type: 'tilbud_udloeber_snart',
                til: brugerEmail,
                data: { dokumentNr: tilbud.id, kundeNavn, firmaNavnKunde, gyldigDato: formatDato(tilbud.gyldigTil) },
                notifPraeferencer,
              });
            }
          } catch (e) { console.error('Fejl på tilbuds-blob:', e.message); }
        }
      } catch (e) { console.error('Fejl ved tilbudsgennemgang for bruger:', userId, e.message); }

      // ── FAKTURAER ──────────────────────────────────────────────────────────
      try {
        const fakturaBlobs = await store.list({ prefix: `faktura/${userId}/` });
        for (const blob of fakturaBlobs.blobs) {
          try {
            const raw = await store.get(blob.key);
            if (!raw) continue;
            const faktura = JSON.parse(raw);

            if (!['afventer_betaling', 'set'].includes(faktura.status)) continue;

            const kundeNavn = faktura.modtager?.kontaktperson || faktura.modtager?.navn || 'Kunden';
            const firmaNavnKunde = faktura.modtager?.navn || '';
            const totalStr = formatKr(faktura.total);
            const forfaldsDato = formatDato(faktura.forfaldsdato);

            if (erPasseret(faktura.forfaldsdato, idag)) {
              faktura.status = 'forfalden';
              faktura.opdateret = new Date().toISOString();
              await store.set(blob.key, JSON.stringify(faktura));
              fakturaOpdateret++;
              console.log(`Faktura ${faktura.id} markeret som forfalden`);

              if (brugerEmail) {
                await sendNotifikation({
                  type: 'faktura_forfalden',
                  til: brugerEmail,
                  data: { dokumentNr: faktura.id, kundeNavn, firmaNavnKunde, totalStr, forfaldsDato },
                  notifPraeferencer,
                });
              }
            } else if (erOm3Dage(faktura.forfaldsdato, idag) && brugerEmail) {
              await sendNotifikation({
                type: 'faktura_forfalder_snart',
                til: brugerEmail,
                data: { dokumentNr: faktura.id, kundeNavn, firmaNavnKunde, totalStr, forfaldsDato },
                notifPraeferencer,
              });
            }
          } catch (e) { console.error('Fejl på faktura-blob:', e.message); }
        }
      } catch (e) { console.error('Fejl ved fakturgennemgang for bruger:', userId, e.message); }
    }

    console.log(`check-forfald fuldført: ${tilbudOpdateret} tilbud + ${fakturaOpdateret} fakturaer opdateret`);
    return { statusCode: 200, body: JSON.stringify({ success: true, tilbudOpdateret, fakturaOpdateret }) };
  } catch (e) {
    console.error('check-forfald kritisk fejl:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

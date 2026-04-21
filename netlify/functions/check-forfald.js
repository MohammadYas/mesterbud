/**
 * check-forfald.js – Netlify Scheduled Function
 * Kører dagligt kl. 02:00 UTC
 * Markerer fakturaer som "forfalden" hvis forfaldsdato er passeret
 */
const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  const store = getStore('mesterbud');
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  let opdateret = 0;

  try {
    // Hent alle brugerprofiler for at finde user IDs
    const profiler = await store.list({ prefix: 'profil/' });

    for (const profilBlob of profiler.blobs) {
      const userId = profilBlob.key.replace('profil/', '');
      try {
        const fakturaBlobs = await store.list({ prefix: `faktura/${userId}/` });
        for (const blob of fakturaBlobs.blobs) {
          try {
            const raw = await store.get(blob.key);
            if (!raw) continue;
            const faktura = JSON.parse(raw);

            if (faktura.status === 'afventer_betaling' && faktura.forfaldsdato) {
              const forfald = new Date(faktura.forfaldsdato);
              forfald.setHours(0, 0, 0, 0);
              if (forfald < idag) {
                faktura.status = 'forfalden';
                faktura.opdateret = new Date().toISOString();
                await store.set(blob.key, JSON.stringify(faktura));
                opdateret++;
                console.log(`Faktura ${faktura.id} markeret som forfalden (forfald: ${faktura.forfaldsdato})`);
              }
            }
          } catch (e) {
            console.error('Fejl på faktura-blob:', e.message);
          }
        }
      } catch (e) {
        console.error('Fejl for bruger:', userId, e.message);
      }
    }

    console.log(`check-forfald fuldført: ${opdateret} fakturaer markeret som forfaldne`);
    return { statusCode: 200, body: JSON.stringify({ success: true, opdateret }) };
  } catch (e) {
    console.error('check-forfald kritisk fejl:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

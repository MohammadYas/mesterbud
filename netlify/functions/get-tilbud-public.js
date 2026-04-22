/**
 * get-tilbud-public.js – offentlig endpoint til kundevisning
 * Kræver token (64-hex) + tilbudsId. Ingen JWT.
 * Tracker åbninger og sender notifikation til brugeren ved første åbning.
 */
const { getStore } = require('@netlify/blobs');
const { checkRateLimit, getClientIP, rateLimitResponse, sanitizeString } = require('./_security');
const { sendNotifikation } = require('./_notifikationer');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const ip = getClientIP(event);
  const rl = checkRateLimit(`get-tilbud-public:${ip}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  // Hent parametre fra query eller body (begge understøttes)
  let tilbudsId, token;
  if (event.httpMethod === 'GET') {
    tilbudsId = event.queryStringParameters?.id;
    token     = event.queryStringParameters?.token;
  } else {
    try {
      const b = JSON.parse(event.body || '{}');
      tilbudsId = b.id || b.tilbudsId;
      token     = b.token;
    } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) }; }
  }

  tilbudsId = sanitizeString(tilbudsId || '', 20);
  token     = sanitizeString(token || '', 80);

  if (!tilbudsId || !/^MB-\d{4}-\d{3,6}$/.test(tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID format' }) };
  }
  if (!token || token.length < 60) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link – token mangler' }) };
  }

  const store = getStore('mesterbud');

  try {
    // Slå userId op via public mapping (sat af send-tilbud.js)
    const mappingRaw = await store.get(`meta/tilbud-public/${tilbudsId}`);
    if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
    const { userId } = JSON.parse(mappingRaw);

    const raw = await store.get(`tilbud/${userId}/${tilbudsId}`);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
    const tilbud = JSON.parse(raw);

    // Valider token
    if (tilbud.publicToken !== token) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
    }

    const nu = new Date().toISOString();
    let opdateret = false;

    // Track åbning
    if (!tilbud.aabninger) tilbud.aabninger = [];
    tilbud.aabninger.push({ tidspunkt: nu, userAgent: (event.headers?.['user-agent'] || 'ukendt').slice(0, 200) });

    // Første åbning
    if (!tilbud.foersteSetDato) {
      tilbud.foersteSetDato = nu;
      if (tilbud.status === 'sendt') {
        tilbud.status = 'set';
        tilbud.opdateret = nu;
      }
      opdateret = true;

      // Hent brugerens email + notifpræferencer
      try {
        const profilRaw = await store.get(`profil/${userId}`);
        if (profilRaw) {
          const profil = JSON.parse(profilRaw);
          const brugerEmail = profil.virksomhed?.email || profil.email;
          if (brugerEmail) {
            await sendNotifikation({
              type: 'dokument_set',
              til: brugerEmail,
              data: {
                dokumentType: 'tilbud',
                dokumentNr: tilbudsId,
                kundeNavn: tilbud.modtager?.kontaktperson || tilbud.modtager?.navn || 'Kunden',
                firmaNavnKunde: tilbud.modtager?.navn || '',
              },
              notifPraeferencer: profil.notifikationer,
            });
          }
        }
      } catch (e) { console.error('Notifikation fejlede (tilbud set):', e.message); }
    } else {
      opdateret = true;
    }

    if (opdateret) {
      await store.set(`tilbud/${userId}/${tilbudsId}`, JSON.stringify(tilbud));
    }

    // Fjern intern data fra svar til kunden
    const { publicToken: _pt, aabninger: _ab, ...tilbudPublic } = tilbud;
    return { statusCode: 200, headers, body: JSON.stringify(tilbudPublic) };
  } catch (e) {
    console.error('get-tilbud-public fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

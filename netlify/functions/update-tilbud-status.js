/**
 * update-tilbud-status.js – kunden accepterer eller afviser tilbud
 * Offentlig endpoint – ingen JWT, men token kræves + valideres.
 * userId hentes fra server-side mapping (IKKE fra klienten).
 */
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, getClientIP, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');
const { sendNotifikation } = require('./_notifikationer');

exports.handler = async (event) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const ip = getClientIP(event);
  const rl = checkRateLimit(`update-status:${ip}`, 10, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const { valid, errors, data } = validateSchema(body, {
    tilbudsId:    { type: 'string', required: true, maxLen: 20 },
    token:        { type: 'string', required: true, maxLen: 80 },
    status:       { type: 'string', required: true, enum: ['accepteret', 'afvist'] },
    signaturNavn: { type: 'string', maxLen: 100 },
    besked:       { type: 'string', maxLen: 1000 },
    dato:         { type: 'string', maxLen: 30 },
  });

  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  if (!/^MB-\d{4}-\d{3,6}$/.test(data.tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID format' }) };
  }
  if (!data.token || data.token.length < 60) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
  }

  const store = getStore('mesterbud');

  try {
    // Slå userId op server-side – klienten sender IKKE userId
    const mappingRaw = await store.get(`meta/tilbud-public/${data.tilbudsId}`);
    if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
    const { userId } = JSON.parse(mappingRaw);

    const key = `tilbud/${userId}/${data.tilbudsId}`;
    const raw = await store.get(key);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
    const tilbud = JSON.parse(raw);

    // Valider token
    if (tilbud.publicToken !== data.token) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
    }

    // Tilbuddet kan kun besvares hvis det er sendt eller set
    if (!['sendt', 'set'].includes(tilbud.status)) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Tilbuddet er allerede behandlet' }) };
    }

    tilbud.status = data.status;
    tilbud.opdateret = new Date().toISOString();
    tilbud.kundeResponse = {
      status: data.status,
      signaturNavn: data.signaturNavn || null,
      besked: data.besked || null,
      dato: data.dato || new Date().toISOString(),
    };

    await store.set(key, JSON.stringify(tilbud));

    // Send notifikation til brugeren
    try {
      const profilRaw = await store.get(`profil/${userId}`);
      if (profilRaw) {
        const profil = JSON.parse(profilRaw);
        const brugerEmail = profil.virksomhed?.email || profil.email;
        if (brugerEmail) {
          const totalStr = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0 }).format(tilbud.total || 0) + ' kr.';
          await sendNotifikation({
            type: data.status === 'accepteret' ? 'tilbud_accepteret' : 'tilbud_afvist',
            til: brugerEmail,
            data: {
              dokumentNr: data.tilbudsId,
              kundeNavn: tilbud.modtager?.kontaktperson || tilbud.modtager?.navn || 'Kunden',
              firmaNavnKunde: tilbud.modtager?.navn || '',
              totalStr,
              besked: data.besked || '',
            },
            notifPraeferencer: profil.notifikationer,
          });
        }
      }
    } catch (e) { console.error('Notifikation fejlede (svar-tilbud):', e.message); }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: data.status }) };
  } catch (e) {
    console.error('update-tilbud-status fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

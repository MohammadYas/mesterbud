const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, sanitizeString, sanitizeEmail, CORS_HEADERS,
} = require('./_security');

// Tilladte felter i virksomhedsprofil
const ALLOWED_VIRKSOMHED_FIELDS = [
  'navn', 'adresse', 'postnr', 'by', 'telefon', 'email',
  'cvr', 'hjemmeside', 'logo', 'betalingsbetingelser', 'momsNr',
];

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 20 saves/min
  const rl = checkRateLimit(`save-user:${user.sub}`, 20, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const userId = user.sub;
  const store = getStore('mesterbud');

  try {
    const raw = await store.get(`profil/${userId}`);
    const profil = raw ? JSON.parse(raw) : { plan: 'trial', oprettet: new Date().toISOString() };

    if (body.virksomhed && typeof body.virksomhed === 'object') {
      const v = body.virksomhed;
      const cleanVirksomhed = {
        navn:               sanitizeString(v.navn, 150),
        adresse:            sanitizeString(v.adresse, 200),
        postnr:             sanitizeString(v.postnr, 10),
        by:                 sanitizeString(v.by, 100),
        telefon:            sanitizeString(v.telefon, 30),
        email:              sanitizeEmail(v.email),
        cvr:                sanitizeString(v.cvr, 20),
        hjemmeside:         sanitizeString(v.hjemmeside, 200),
        betalingsbetingelser: sanitizeString(v.betalingsbetingelser, 500),
        momsNr:             sanitizeString(v.momsNr, 30),
        // Logo: kun base64 data-URL tilladt
        logo: typeof v.logo === 'string' && v.logo.startsWith('data:image/')
          ? v.logo.slice(0, 500_000) // maks ~375 KB billede
          : (profil.virksomhed?.logo || ''),
      };
      profil.virksomhed = cleanVirksomhed;
    }

    profil.opdateret = new Date().toISOString();
    await store.set(`profil/${userId}`, JSON.stringify(profil));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.error('save-user fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

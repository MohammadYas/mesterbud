const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, getClientIP, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

// Offentlig endpoint – bruges af kunden til at acceptere/afvise
exports.handler = async (event) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  // Rate limit: 10 POST/min pr. IP (beskytter mod status-spam)
  const ip = getClientIP(event);
  const rl = checkRateLimit(`update-status:${ip}`, 10, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  // Input validation
  const { valid, errors, data } = validateSchema(body, {
    tilbudsId: { type: 'string', required: true, maxLen: 20 },
    userId:    { type: 'string', required: true, maxLen: 128 },
    status:    { type: 'string', required: true, enum: ['accepteret', 'afvist'] },
    signaturNavn: { type: 'string', maxLen: 100 },
    besked:    { type: 'string', maxLen: 1000 },
    dato:      { type: 'string', maxLen: 30 },
  });

  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  // Ekstra ID-format check
  if (!/^MB-\d{4}-\d{3,6}$/.test(data.tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID format' }) };
  }

  const store = getStore('mesterbud');
  const key = `tilbud/${data.userId}/${data.tilbudsId}`;

  try {
    const raw = await store.get(key);
    if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };

    const tilbud = JSON.parse(raw);

    // Kun sendte tilbud kan accepteres/afvises
    if (tilbud.status !== 'sendt') {
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
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: data.status }) };
  } catch (e) {
    console.error('update-tilbud-status fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

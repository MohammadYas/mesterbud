const { getStore } = require('@netlify/blobs');
const { checkRateLimit, getClientIP, rateLimitResponse } = require('./_security');

// Offentlig endpoint – kræver ikke auth
// Tilbuds-ID fungerer som opaque identifier
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  // Rate limit: 60 req/min pr. IP (offentlig endpoint)
  const ip = getClientIP(event);
  const rl = checkRateLimit(`get-tilbud-public:${ip}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const tilbudsId = event.queryStringParameters?.id;
  if (!tilbudsId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler id' }) };

  // Valider format: MB-YYYY-NNN (forhindrer path traversal / wildcard-søgning)
  if (!/^MB-\d{4}-\d{3,6}$/.test(tilbudsId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID format' }) };
  }

  const store = getStore('mesterbud');

  try {
    const list = await store.list({ prefix: 'tilbud/' });
    let found = null;

    for (const blob of list.blobs) {
      if (blob.key.endsWith('/' + tilbudsId)) {
        const raw = await store.get(blob.key);
        if (raw) {
          found = JSON.parse(raw);
          break;
        }
      }
    }

    if (!found) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };

    return { statusCode: 200, headers, body: JSON.stringify(found) };
  } catch (e) {
    console.error('get-tilbud-public fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

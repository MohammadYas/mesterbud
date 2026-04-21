const { getStore } = require('@netlify/blobs');
const { checkRateLimit, rateLimitResponse, sanitizeString, parseBody, CORS_HEADERS } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 120 req/min pr. bruger
  const rl = checkRateLimit(`get-tilbud:${user.sub}`, 120, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;
  const store = getStore('mesterbud');

  try {
    // POST mode: { mode: "alle" } eller { mode: "enkelt", tilbudsId }
    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

      const mode = body.mode || 'alle';

      if (mode === 'enkelt') {
        const tilbudsId = sanitizeString(body.tilbudsId || '', 20);
        if (!tilbudsId || !/^MB-\d{4}-\d{3,6}$/.test(tilbudsId)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID' }) };
        }
        const raw = await store.get(`tilbud/${userId}/${tilbudsId}`);
        if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
        return { statusCode: 200, headers, body: raw };
      }

      // mode === "alle"
      const list = await store.list({ prefix: `tilbud/${userId}/` });
      const rawItems = await Promise.all(list.blobs.map(b => store.get(b.key)));
      const tilbud = rawItems
        .filter(Boolean)
        .map(r => { try { return JSON.parse(r); } catch { return null; } })
        .filter(Boolean)
        .sort((a, b) => new Date(b.opdateret || 0) - new Date(a.opdateret || 0));

      return { statusCode: 200, headers, body: JSON.stringify(tilbud) };
    }

    // GET fallback (baglæns kompatibilitet)
    if (event.httpMethod === 'GET') {
      const tilbudsId = event.queryStringParameters?.id;

      if (tilbudsId) {
        const cleanId = sanitizeString(tilbudsId, 20);
        if (!/^MB-\d{4}-\d{3,6}$/.test(cleanId)) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID' }) };
        }
        const raw = await store.get(`tilbud/${userId}/${cleanId}`);
        if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
        return { statusCode: 200, headers, body: raw };
      } else {
        const list = await store.list({ prefix: `tilbud/${userId}/` });
        const rawItems = await Promise.all(list.blobs.map(b => store.get(b.key)));
        const tilbud = rawItems
          .filter(Boolean)
          .map(r => { try { return JSON.parse(r); } catch { return null; } })
          .filter(Boolean)
          .sort((a, b) => new Date(b.opdateret || 0) - new Date(a.opdateret || 0));
        return { statusCode: 200, headers, body: JSON.stringify(tilbud) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };
  } catch (e) {
    console.error('get-tilbud fejl:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Intern serverfejl ved hentning af tilbud' }) };
  }
};

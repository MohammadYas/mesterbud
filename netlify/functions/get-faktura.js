const { getStore } = require('@netlify/blobs');
const { checkRateLimit, rateLimitResponse, CORS_HEADERS, parseBody } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const body = parseBody(event);
  const store = getStore('mesterbud');

  // ── Offentlig adgang via token (ingen JWT) ─────────────────────────────
  if (body?.mode === 'offentlig') {
    const { token, fakturaId } = body;
    if (!token || !fakturaId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler token eller fakturaId' }) };
    }
    try {
      const mappingRaw = await store.get(`meta/faktura-public/${fakturaId}`);
      if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const { userId } = JSON.parse(mappingRaw);
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const faktura = JSON.parse(raw);
      if (faktura.publicToken !== token) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(faktura) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── Bekræft betaling fra kunde (ingen JWT) ─────────────────────────────
  if (body?.mode === 'bekraeft_betaling') {
    const { token, fakturaId } = body;
    if (!token || !fakturaId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler token eller fakturaId' }) };
    }
    try {
      const mappingRaw = await store.get(`meta/faktura-public/${fakturaId}`);
      if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const { userId } = JSON.parse(mappingRaw);
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const faktura = JSON.parse(raw);
      if (faktura.publicToken !== token) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
      }
      if (faktura.status !== 'betalt') {
        faktura.status = 'betalt_af_kunde';
        faktura.betaletAfKunde = new Date().toISOString();
        await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, firmanavn: faktura.afsender?.firmanavn }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── JWT-beskyttet ──────────────────────────────────────────────────────
  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`get-faktura:${user.sub}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;

  try {
    if (body?.mode === 'enkelt') {
      const { fakturaId } = body;
      if (!fakturaId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler fakturaId' }) };
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      return { statusCode: 200, headers, body: raw };
    }

    // mode: "alle"
    const list = await store.list({ prefix: `faktura/${userId}/` });
    const fakturaer = [];
    for (const blob of list.blobs) {
      try {
        const raw = await store.get(blob.key);
        if (raw) fakturaer.push(JSON.parse(raw));
      } catch {}
    }
    fakturaer.sort((a, b) => new Date(b.opdateret) - new Date(a.opdateret));
    return { statusCode: 200, headers, body: JSON.stringify(fakturaer) };
  } catch (e) {
    console.error('get-faktura fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

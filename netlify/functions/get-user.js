const { getStore } = require('@netlify/blobs');
const { checkRateLimit, rateLimitResponse, CORS_HEADERS } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 60 req/min pr. bruger
  const rl = checkRateLimit(`get-user:${user.sub}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;
  const store = getStore('mesterbud');

  try {
    const raw = await store.get(`profil/${userId}`);
    const profil = raw ? JSON.parse(raw) : { plan: 'trial', virksomhed: {} };

    // Tjek om trial er udløbet (14 dage)
    if (profil.plan === 'trial' && profil.oprettet) {
      const dage = (Date.now() - new Date(profil.oprettet).getTime()) / 86_400_000;
      if (dage > 14) profil.plan = 'none';
    } else if (!profil.oprettet) {
      profil.oprettet = new Date().toISOString();
      profil.plan = 'trial';
      await store.set(`profil/${userId}`, JSON.stringify(profil));
    }

    return { statusCode: 200, headers, body: JSON.stringify(profil) };
  } catch (e) {
    console.error('get-user fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

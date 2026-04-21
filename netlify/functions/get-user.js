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
    // Nye brugere får plan: 'none' – trial starter FØRST når Stripe checkout er gennemført
    const profil = raw ? JSON.parse(raw) : { plan: 'none', virksomhed: {} };

    // Tjek om Stripe trial er udløbet
    if (profil.trialSlutter && profil.plan === 'trial') {
      if (new Date(profil.trialSlutter) < new Date()) profil.plan = 'none';
    }

    // Beregn dage tilbage af prøveperiode
    const dageTilbage = profil.trialSlutter
      ? Math.max(0, Math.ceil((new Date(profil.trialSlutter) - new Date()) / 86400000))
      : null;

    const response = {
      ...profil,
      plan: profil.plan || 'basis',
      trialSlutter: profil.trialSlutter || null,
      stripeStatus: profil.stripeStatus || null,
      dageTilbage,
    };

    return { statusCode: 200, headers, body: JSON.stringify(response) };
  } catch (e) {
    console.error('get-user fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

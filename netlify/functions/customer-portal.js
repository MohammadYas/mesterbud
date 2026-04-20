const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');
const { checkRateLimit, rateLimitResponse, CORS_HEADERS } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 10/min
  const rl = checkRateLimit(`portal:${user.sub}`, 10, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const store = getStore('mesterbud');

  try {
    const raw = await store.get(`profil/${user.sub}`);
    const profil = raw ? JSON.parse(raw) : {};

    if (!profil.stripeCustomerId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ingen aktiv Stripe-kunde fundet' }) };
    }

    const baseUrl = process.env.URL || 'https://mesterbud.dk';

    const session = await stripe.billingPortal.sessions.create({
      customer: profil.stripeCustomerId,
      return_url: `${baseUrl}/konto.html`,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    console.error('customer-portal fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
  }
};

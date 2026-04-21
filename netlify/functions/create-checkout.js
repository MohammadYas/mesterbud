const Stripe = require('stripe');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 5 checkout-forsøg/min pr. bruger (forhindrer subscriptions-spam)
  const rl = checkRateLimit(`checkout:${user.sub}`, 5, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const { valid, errors, data } = validateSchema(body, {
    plan:      { type: 'string', required: true, enum: ['basis', 'pro'] },
    userEmail: { type: 'email', maxLen: 254 },
    userId:    { type: 'string', maxLen: 128 },
  });
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  // Nøgler kun fra env – aldrig fra request
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const priceMap = {
    basis: process.env.STRIPE_PRICE_BASIS,
    pro:   process.env.STRIPE_PRICE_PRO,
  };

  const priceId = priceMap[data.plan];
  if (!priceId) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Pris ikke konfigureret' }) };

  const baseUrl = process.env.SITE_URL || process.env.URL || 'https://mesterbud.dk';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { netlifyUserId: data.userId || user.sub, plan: data.plan },
      },
      customer_email: data.userEmail || user.email,
      metadata: { netlifyUserId: data.userId || user.sub, plan: data.plan },
      success_url: `${baseUrl}/dashboard.html?checkout=success`,
      cancel_url: `${baseUrl}/konto.html`,
      locale: 'da',
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    console.error('create-checkout fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Betalingsfejl – prøv igen' }) };
  }
};

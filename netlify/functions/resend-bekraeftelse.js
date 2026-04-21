/**
 * resend-bekraeftelse.js
 * POST { email: string }
 * Ingen JWT – brugeren er ikke logget ind endnu.
 * Rate limit: 3 req / 10 min pr. IP
 * Kalder Netlify Identity admin API for at resende bekræftelsesmail.
 * Returnerer altid { success: true } for ikke at afsløre om email eksisterer.
 */

const { checkRateLimit, rateLimitResponse, getClientIP, sanitizeEmail, CORS_HEADERS } = require('./_security');

exports.handler = async (event) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  // Rate limit: 3 req / 10 min pr. IP
  const ip = getClientIP(event);
  const rl = checkRateLimit(`resend-bekraeftelse:${ip}`, 3, 10 * 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };
  }

  const email = sanitizeEmail(body.email || '');
  if (!email) {
    // Returner success for ikke at afsløre noget
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  const siteId = process.env.NETLIFY_SITE_ID;
  const apiToken = process.env.NETLIFY_API_TOKEN;

  if (!siteId || !apiToken) {
    // Konfiguration mangler – log internt, returner success til klient
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }

  try {
    // Opslag: find bruger ID via email
    const searchRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/identity/users?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );

    if (!searchRes.ok) {
      // Returner success selvom opslag fejler
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const searchData = await searchRes.json();
    const users = searchData.users || [];

    if (users.length === 0) {
      // Email findes ikke – afslør det ikke
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    const userId = users[0].id;

    // Send bekræftelsesmail
    await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/identity/users/${userId}/send_confirmation`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}` },
      }
    );
  } catch {
    // Stille fejl – returner altid success
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};

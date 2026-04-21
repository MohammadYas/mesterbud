/**
 * _admin-auth.js – Admin sikkerhedslag
 * Lag 1: Email whitelist
 * Lag 2: JWT validering via Netlify Identity
 * Lag 4: Rate limiting (10 req/min pr. IP)
 */

const { checkRateLimit, getClientIP, rateLimitResponse, CORS_HEADERS } = require('./_security');

// Understøtter én eller kommaseparerede admin-emails i ADMIN_EMAIL env var
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || 'mohammadyassin26@hotmail.com')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_EMAIL = ADMIN_EMAILS[0]; // Bagudkompatibilitet

// Lag 7: Streng CSP for admin API-svar
const ADMIN_HEADERS = {
  ...CORS_HEADERS,
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com https://identity.netlify.com https://cdn.jsdelivr.net https://fonts.googleapis.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:;",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * verifyAdmin(event, context)
 * Returnerer { user } ved succes eller { error, statusCode } ved fejl
 */
function verifyAdmin(event, context) {
  // Lag 4: Rate limit – 10 req/min pr. IP
  const ip = getClientIP(event);
  const rl = checkRateLimit(`admin:${ip}`, 10, 60_000);
  if (rl.limited) return { rateLimited: true, retryAfter: rl.retryAfter };

  // Lag 2: JWT – kræver Netlify Identity token
  const { user } = context.clientContext || {};
  if (!user) return { error: 'Ikke autoriseret – log ind', statusCode: 401 };

  // Lag 1: Email whitelist
  if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    // Log forsøget uden at afsløre den rigtige admin email
    console.warn(`Admin adgangsforsøg nægtet for: ${user.email}`);
    return { error: 'Adgang nægtet', statusCode: 403 };
  }

  return { user, error: null };
}

/**
 * adminGuard(event, context)
 * Returnerer response-objekt hvis adgang nægtes, ellers null
 */
function adminGuard(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: ADMIN_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    // Lag 6: Ingen data i URL – kun POST
    return { statusCode: 405, headers: ADMIN_HEADERS, body: JSON.stringify({ error: 'Kun POST tilladt' }) };
  }

  const result = verifyAdmin(event, context);

  if (result.rateLimited) {
    return rateLimitResponse(result.retryAfter);
  }
  if (result.error) {
    return { statusCode: result.statusCode, headers: ADMIN_HEADERS, body: JSON.stringify({ error: result.error }) };
  }

  return null; // Adgang tilladt
}

module.exports = { adminGuard, verifyAdmin, ADMIN_HEADERS, ADMIN_EMAIL, ADMIN_EMAILS };

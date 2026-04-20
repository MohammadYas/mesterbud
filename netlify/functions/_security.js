/**
 * _security.js – delt sikkerhedsmodul til alle Netlify Functions
 * OWASP: rate limiting, input validation, output sanitization
 */

// ─── Rate limiting (in-memory pr. function-instans) ─────────────────────────
// Serverless: state overlever kun i warm lambdas – tilstrækkeligt til at bremse burst-angreb

const rateLimitStore = new Map(); // key → { count, resetAt }

/**
 * checkRateLimit(key, maxRequests, windowMs)
 * Returnerer { limited: true, retryAfter } eller { limited: false }
 */
function checkRateLimit(key, maxRequests = 30, windowMs = 60_000) {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

/**
 * getClientIP(event) – henter klientens IP fra Netlify headers
 */
function getClientIP(event) {
  return (
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['client-ip'] ||
    'unknown'
  );
}

/**
 * rateLimitResponse(retryAfter) – standard 429-svar
 */
function rateLimitResponse(retryAfter = 60) {
  return {
    statusCode: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      error: 'For mange forespørgsler. Prøv igen om lidt.',
      retryAfter,
    }),
  };
}

// ─── Input validation / sanitization ────────────────────────────────────────

/**
 * sanitizeString(val, maxLen) – trimmer, fjerner null-bytes, begrænser længde
 */
function sanitizeString(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.replace(/\0/g, '').trim().slice(0, maxLen);
}

/**
 * sanitizeEmail(val) – validerer og normaliserer email
 */
function sanitizeEmail(val) {
  if (typeof val !== 'string') return '';
  const v = val.trim().toLowerCase().slice(0, 254);
  // RFC 5321 simpel check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : '';
}

/**
 * sanitizeNumber(val, min, max) – numerisk validering
 */
function sanitizeNumber(val, min = 0, max = 1_000_000_000) {
  const n = Number(val);
  if (!isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/**
 * validateSchema(obj, schema)
 * schema: { field: { type, required, maxLen, min, max, enum } }
 * Returnerer { valid: true, data } eller { valid: false, errors[] }
 */
function validateSchema(obj, schema) {
  if (typeof obj !== 'object' || obj === null) {
    return { valid: false, errors: ['Ugyldig JSON-body'] };
  }

  const errors = [];
  const data = {};

  for (const [field, rules] of Object.entries(schema)) {
    let val = obj[field];

    // Påkrævet felt
    if (rules.required && (val === undefined || val === null || val === '')) {
      errors.push(`'${field}' er påkrævet`);
      continue;
    }

    // Valgfrit felt ikke tilstede – skip
    if (val === undefined || val === null) {
      if (rules.default !== undefined) data[field] = rules.default;
      continue;
    }

    // Type-check og sanitering
    if (rules.type === 'string') {
      val = sanitizeString(val, rules.maxLen || 500);
      if (rules.required && val === '') {
        errors.push(`'${field}' må ikke være tom`);
        continue;
      }
    } else if (rules.type === 'email') {
      val = sanitizeEmail(val);
      if (rules.required && val === '') {
        errors.push(`'${field}' er ikke en gyldig email`);
        continue;
      }
    } else if (rules.type === 'number') {
      val = sanitizeNumber(val, rules.min, rules.max);
      if (val === null) {
        errors.push(`'${field}' er uden for tilladt interval`);
        continue;
      }
    } else if (rules.type === 'boolean') {
      val = Boolean(val);
    } else if (rules.type === 'array') {
      if (!Array.isArray(val)) {
        errors.push(`'${field}' skal være et array`);
        continue;
      }
      if (rules.maxItems && val.length > rules.maxItems) {
        val = val.slice(0, rules.maxItems);
      }
    }

    // Enum-check
    if (rules.enum && !rules.enum.includes(val)) {
      errors.push(`'${field}' har ugyldig værdi`);
      continue;
    }

    data[field] = val;
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}

/**
 * stripUnknownFields(obj, allowedKeys)
 * Fjerner alle felter der ikke er i allowedKeys – forhindrer mass assignment
 */
function stripUnknownFields(obj, allowedKeys) {
  if (typeof obj !== 'object' || obj === null) return {};
  const clean = {};
  for (const key of allowedKeys) {
    if (key in obj) clean[key] = obj[key];
  }
  return clean;
}

/**
 * parseBody(event) – sikker JSON-parse af request body
 */
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

// ─── Standard response headers ───────────────────────────────────────────────
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

module.exports = {
  checkRateLimit,
  getClientIP,
  rateLimitResponse,
  sanitizeString,
  sanitizeEmail,
  sanitizeNumber,
  validateSchema,
  stripUnknownFields,
  parseBody,
  CORS_HEADERS,
};

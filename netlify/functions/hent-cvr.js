// GET ?cvr=12345678
// Ingen JWT krævet (offentlig data)
const { CORS_HEADERS } = require('./_security');

exports.handler = async (event) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ fejl: 'Metode ikke tilladt' }) };

  const cvr = (event.queryStringParameters?.cvr || '').replace(/\s/g, '');
  if (!/^\d{8}$/.test(cvr)) {
    return { statusCode: 400, headers, body: JSON.stringify({ fejl: 'CVR-nummer skal være 8 cifre' }) };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`https://cvrapi.dk/api?search=${cvr}&country=dk`, {
      headers: { 'User-Agent': 'Mesterbud.dk' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ fejl: 'CVR ikke fundet' }) };
    }

    const data = await res.json();
    if (data.error) {
      return { statusCode: 200, headers, body: JSON.stringify({ fejl: 'CVR ikke fundet' }) };
    }

    const resultat = {
      navn:    data.name    || '',
      adresse: data.address || '',
      postnr:  String(data.zipcode || ''),
      by:      data.city    || '',
      telefon: data.phone   || '',
      email:   data.email   || '',
    };

    return { statusCode: 200, headers, body: JSON.stringify(resultat) };
  } catch (e) {
    // Timeout eller netværksfejl – returner stille fejl, aldrig 500
    return { statusCode: 200, headers, body: JSON.stringify({ fejl: 'CVR-opslag fejlede – prøv igen' }) };
  }
};

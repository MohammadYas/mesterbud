const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, sanitizeString, CORS_HEADERS,
} = require('./_security');

const DAGLIG_AI_KVOTE = 30;

const SYSTEM_PROMPT = `Skriv en kort opfølgning på dansk fra en håndværker til en kunde. Max 4 linjer. Lyd som et menneske. Ingen klichéer som 'Håber alt er vel'. Bare direkte og venlig. Nævn opgaven og beløbet naturligt.`;

async function checkOgInkrementerKvote(store, userId) {
  const dagNoegle = new Date().toISOString().slice(0, 10);
  const key = `meta/${userId}/ai-opf-kvote/${dagNoegle}`;
  try {
    const raw = await store.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= DAGLIG_AI_KVOTE) return false;
    await store.set(key, String(count + 1));
    return true;
  } catch {
    return true;
  }
}

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`ai-opf:${user.sub}`, 5, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const store = getStore('mesterbud');

  // Pro-plan check
  try {
    const raw = await store.get(`profil/${user.sub}`);
    const profil = raw ? JSON.parse(raw) : {};
    if (profil.plan !== 'pro') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Kræver Pro-abonnement', kræverPro: true }) };
    }
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Kunne ikke verificere abonnement' }) };
  }

  const tilladt = await checkOgInkrementerKvote(store, user.sub);
  if (!tilladt) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: `Daglig AI-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }) };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  let kundenavn, firmanavn, opgavebeskrivelse, beloeb, datoSendt;

  if (body.tilbudsId) {
    // Hent tilbud fra `tilbud/{userId}/{tilbudsId}`
    const tilbudsId = sanitizeString(body.tilbudsId, 20);
    if (!/^MB-\d{4}-\d{3,6}$/.test(tilbudsId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID' }) };
    }
    try {
      const raw = await store.get(`tilbud/${user.sub}/${tilbudsId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Tilbud ikke fundet' }) };
      const t = JSON.parse(raw);
      kundenavn = t.modtager?.navn || '';
      const profilRaw = await store.get(`profil/${user.sub}`);
      const profil = profilRaw ? JSON.parse(profilRaw) : {};
      firmanavn = profil.virksomhed?.navn || '';
      opgavebeskrivelse = t.titel || t.noter || t.beskrivelse || '';
      beloeb = t.total;
      datoSendt = t.opdateret;
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl ved hentning af tilbud' }) };
    }
  } else {
    const { valid, errors, data } = validateSchema(body, {
      kundenavn:         { type: 'string', required: true, maxLen: 100 },
      firmanavn:         { type: 'string', maxLen: 100 },
      opgavebeskrivelse: { type: 'string', maxLen: 500 },
      beloeb:            { type: 'number', min: 0, max: 100_000_000 },
      datoSendt:         { type: 'string', maxLen: 30 },
    });
    if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };
    kundenavn = data.kundenavn;
    firmanavn = data.firmanavn;
    opgavebeskrivelse = data.opgavebeskrivelse;
    beloeb = data.beloeb;
    datoSendt = data.datoSendt;
  }

  const brugerInput = `Kundenavn: ${kundenavn}
Firmanavn: ${firmanavn || 'ukendt'}
Opgave: ${opgavebeskrivelse || 'håndværkeropgave'}
Beløb: ${beloeb ? Math.round(beloeb).toLocaleString('da-DK') + ' kr inkl. moms' : 'ukendt'}
Sendt dato: ${datoSendt ? new Date(datoSendt).toLocaleDateString('da-DK') : 'for nylig'}`;

  try {
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'o4-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: brugerInput },
          ],
          max_completion_tokens: 2000,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000)),
    ]);

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error.message);
    const besked = aiData.choices[0].message.content.trim();
    // Returner både 'besked' (spec) og 'tekst' (baglæns kompatibilitet med dashboard)
    return { statusCode: 200, headers, body: JSON.stringify({ besked, tekst: besked }) };
  } catch (e) {
    console.error('ai-opfoelgning fejl:', e.message);
    const msg = e.message === 'Timeout' ? 'AI-kald tog for lang tid – prøv igen' : 'Fejl ved generering af opfølgning';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

const OpenAI = require('openai');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, sanitizeString, CORS_HEADERS,
} = require('./_security');

const DAGLIG_AI_KVOTE = 30;

const SYSTEM_PROMPT = `Du er en dansk håndværker der følger op på et tilbud.
Skriv en kort, venlig og personlig opfølgningsmail på dansk (maks 4 linjer).
Lyd som et menneske – ikke som et system. Ingen klichéer.
Brug disse data: kundenavn, firmanavn, opgavebeskrivelse, tilbudsbeløb, dato sendt.
Returner KUN mailens brødtekst, ingen emnelinjer eller hilsener.`;

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

  // Burst: maks. 5/min pr. bruger
  const rl = checkRateLimit(`ai-opf:${user.sub}`, 5, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const store = getStore('mesterbud');

  // Pro-plan check
  try {
    const raw = await store.get(`profil/${user.sub}`);
    const profil = raw ? JSON.parse(raw) : {};
    if (profil.plan !== 'pro') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'pro_required', message: 'Denne funktion kræver Pro-abonnement' }) };
    }
  } catch {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Kunne ikke verificere abonnement' }) };
  }

  // Daglig kvote
  const tilladt = await checkOgInkrementerKvote(store, user.sub);
  if (!tilladt) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: `Daglig AI-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }) };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  // Understøt både direkte felter og tilbudsId-lookup
  let kundenavn, firmanavn, opgavebeskrivelse, beloeb, datoSendt;

  if (body.tilbudsId) {
    // Hent data fra blob
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
      opgavebeskrivelse = t.titel || t.noter || '';
      beloeb = t.total;
      datoSendt = t.opdateret;
    } catch {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Serverfejl' }) };
    }
  } else {
    const { valid, errors, data } = validateSchema(body, {
      kundenavn:        { type: 'string', required: true, maxLen: 100 },
      firmanavn:        { type: 'string', maxLen: 100 },
      opgavebeskrivelse:{ type: 'string', maxLen: 500 },
      beloeb:           { type: 'number', min: 0, max: 100_000_000 },
      datoSendt:        { type: 'string', maxLen: 30 },
    });
    if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };
    kundenavn = data.kundenavn;
    firmanavn = data.firmanavn;
    opgavebeskrivelse = data.opgavebeskrivelse;
    beloeb = data.beloeb;
    datoSendt = data.datoSendt;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPrompt = `Kundenavn: ${kundenavn}
Firmanavn: ${firmanavn || 'ukendt'}
Opgave: ${opgavebeskrivelse || 'håndværkeropgave'}
Beløb: ${beloeb ? Math.round(beloeb).toLocaleString('da-DK') + ' kr inkl. moms' : 'ukendt'}
Sendt dato: ${datoSendt ? new Date(datoSendt).toLocaleDateString('da-DK') : 'for nylig'}`;

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini', // Billigere model til korte tekster
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000))
    ]);

    const tekst = completion.choices[0].message.content.trim();
    return { statusCode: 200, headers, body: JSON.stringify({ tekst }) };
  } catch (e) {
    console.error('ai-opfoelgning fejl:', e);
    const msg = e.message === 'Timeout' ? 'AI-kald tog for lang tid – prøv igen' : 'Fejl ved opfølgning';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

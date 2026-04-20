const OpenAI = require('openai');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

// Daglig AI-kvote pr. bruger (Pro) – beskytter mod utilsigtede omkostninger
const DAGLIG_AI_KVOTE = 50;

const SYSTEM_PROMPT = `Du er ekspert i danske håndværkerpriser og tilbudsgivning.
Når du modtager en beskrivelse af en opgave, returnerer du KUN valid JSON i dette format:
{
  "linjer": [
    {
      "beskrivelse": "string",
      "antal": number,
      "enhed": "stk|time|m²|m|ls",
      "enhedspris": number
    }
  ],
  "opgavebeskrivelse": "string"
}
Brug realistiske danske markedspriser for 2026. Ingen forklaring, kun JSON.`;

async function checkOgInkrementerKvote(store, userId) {
  const dagNoegle = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `meta/${userId}/ai-kvote/${dagNoegle}`;
  try {
    const raw = await store.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= DAGLIG_AI_KVOTE) return false;
    await store.set(key, String(count + 1));
    return true;
  } catch {
    return true; // Ved fejl: tillad kald (fail-open for brugeroplevelse)
  }
}

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // In-memory burst rate limit: maks. 5 AI-kald/min pr. bruger
  const rl = checkRateLimit(`ai-generer:${user.sub}`, 5, 60_000);
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
  const kvoterTilladt = await checkOgInkrementerKvote(store, user.sub);
  if (!kvoterTilladt) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: `Daglig AI-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }),
    };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  const { valid, errors, data } = validateSchema(body, {
    transkription: { type: 'string', required: true, maxLen: 3000 },
  });
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  // Ingen API-nøgle klient-side – kun process.env
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'o4-mini', // o4-mini: bedre pris/ydelse til tilbud
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: data.transkription }
        ],
        response_format: { type: 'json_object' },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000))
    ]);

    const result = JSON.parse(completion.choices[0].message.content);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-generer-tilbud fejl:', e);
    const msg = e.message === 'Timeout' ? 'AI-kald tog for lang tid – prøv igen' : 'Fejl ved AI-generering';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

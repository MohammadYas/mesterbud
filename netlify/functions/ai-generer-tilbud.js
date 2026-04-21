const Anthropic = require('@anthropic-ai/sdk');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

const DAGLIG_AI_KVOTE = 50;

const SYSTEM_PROMPT = `Du er en erfaren dansk håndværker der laver tilbud. Ud fra beskrivelsen nedenfor genererer du præcise tilbudslinjer. Brug naturligt, fagligt dansk. Ingen marketing-sprog. Skriv beskrivelser som en håndværker selv ville skrive dem – kort og præcist. Returner KUN valid JSON, ingen forklaring:
{"linjer":[{"beskrivelse":"string","antal":number,"enhed":"stk|time|m²|m|ls","enhedspris":number}],"opgavebeskrivelse":"string"}
Brug realistiske danske markedspriser for 2025.`;

async function checkOgInkrementerKvote(store, userId) {
  const dagNoegle = new Date().toISOString().slice(0, 10);
  const key = `meta/${userId}/ai-kvote/${dagNoegle}`;
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

  const rl = checkRateLimit(`ai-generer:${user.sub}`, 5, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const store = getStore('mesterbud');

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
    beskrivelse: { type: 'string', required: true, maxLen: 3000 },
    branche:     { type: 'string', maxLen: 100 },
    // Baglæns kompatibilitet med ældre klienter der sender transkription
    transkription: { type: 'string', maxLen: 3000 },
  });
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  const inputTekst = data.beskrivelse || data.transkription || '';
  const brancheTekst = data.branche ? `\nBranche: ${data.branche}` : '';

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await Promise.race([
      anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: inputTekst + brancheTekst }
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000))
    ]);

    const tekst = message.content[0].text.trim();
    // Find JSON i svaret (Claude kan indimellem tilføje tekst)
    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Ingen gyldig JSON i svar');
    const result = JSON.parse(jsonMatch[0]);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-generer-tilbud fejl:', e.message);
    const msg = e.message === 'Timeout' ? 'AI-kald tog for lang tid – prøv igen' : 'Fejl ved AI-generering';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

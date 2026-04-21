const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

const DAGLIG_AI_KVOTE = 50;

const SYSTEM_PROMPT_BASE = `Du er en erfaren dansk håndværker der laver tilbud. Ud fra beskrivelsen nedenfor genererer du præcise tilbudslinjer. Brug naturligt, fagligt dansk. Ingen marketing-sprog. Skriv beskrivelser som en håndværker selv ville skrive dem – kort og præcist. Returner KUN valid JSON, ingen forklaring:
{"linjer":[{"beskrivelse":"string","antal":number,"enhed":"stk|time|m²|m|ls","enhedspris":number}],"opgavebeskrivelse":"string"}`;

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

  // Hent brugerens timepriser fra profil
  let brugerPriser = 'Brug standard danske markedspriser for 2025.';
  try {
    const profilRaw = await store.get(`profil/${user.sub}`);
    if (profilRaw) {
      const profil = JSON.parse(profilRaw);
      const tp = profil.indstillinger?.timepris;
      const av = profil.indstillinger?.avance || 15;
      if (tp) brugerPriser = `Brugerens timepris: ${tp} kr/time. Avance på materialer: ${av}%. Brug disse frem for standard markedspriser.`;
    }
  } catch {}

  const systemPrompt = `${SYSTEM_PROMPT_BASE}\n${brugerPriser}`;

  try {
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: inputTekst + brancheTekst },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2000,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000)),
    ]);

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error.message);
    const result = JSON.parse(aiData.choices[0].message.content);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-generer-tilbud fejl:', e.message);
    const msg = e.message === 'Timeout' ? 'AI-kald tog for lang tid – prøv igen' : 'Fejl ved AI-generering';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

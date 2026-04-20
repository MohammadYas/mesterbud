const OpenAI = require('openai');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse, CORS_HEADERS,
} = require('./_security');

// Vindanalyse er dyrt (mange tokens) – lav daglig grænse
const DAGLIG_AI_KVOTE = 10;
const MIN_TILBUD = 5;

async function checkOgInkrementerKvote(store, userId) {
  const dagNoegle = new Date().toISOString().slice(0, 10);
  const key = `meta/${userId}/ai-vind-kvote/${dagNoegle}`;
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

  // Burst: maks. 2/min (analyse er tung)
  const rl = checkRateLimit(`ai-vind:${user.sub}`, 2, 60_000);
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: `Daglig analyse-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }) };
  }

  try {
    // Hent alle tilbud
    const list = await store.list({ prefix: `tilbud/${user.sub}/` });
    const raws = await Promise.all(list.blobs.map(b => store.get(b.key)));
    const tilbud = raws.filter(Boolean).map(r => {
      try { return JSON.parse(r); } catch { return null; }
    }).filter(Boolean);

    if (tilbud.length < MIN_TILBUD) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          raad: null,
          message: `Du skal have mindst ${MIN_TILBUD} tilbud for at få analyse (du har ${tilbud.length})`,
          minimumTilbud: true,
        }),
      };
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Lav minimal dataoversigt (hold tokens nede)
    const oversigt = tilbud.map(t => ({
      status: t.status,
      total: t.total,
      dato: t.oprettet?.slice(0, 10),
      linjeAntal: (t.linjer || []).length,
    }));

    const systemPrompt = `Du er en dansk forretningsanalytiker specialiseret i håndværkerbranchen.
Analyser disse tilbudsdata og returner KUN valid JSON:
{
  "raad": [
    "konkret råd 1 (max 15 ord, brug tal fra data)",
    "konkret råd 2 (max 15 ord, brug tal fra data)",
    "konkret råd 3 (max 15 ord, brug tal fra data)"
  ]
}
Vær specifik og brug data. Ingen generelle råd. Kun JSON.`;

    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini', // Billigere til analyse
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(oversigt) }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000))
    ]);

    const result = JSON.parse(completion.choices[0].message.content);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-vindanalyse fejl:', e);
    const msg = e.message === 'Timeout' ? 'Analyse tog for lang tid – prøv igen' : 'Fejl ved analyse';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

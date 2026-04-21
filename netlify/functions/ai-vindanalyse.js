const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse, CORS_HEADERS,
} = require('./_security');

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

  const rl = checkRateLimit(`ai-vind:${user.sub}`, 2, 60_000);
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: `Daglig analyse-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }) };
  }

  try {
    // Hent alle tilbud for bruger
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
          fejl: 'for_få_tilbud',
          raad: null,
          message: `Du skal have mindst ${MIN_TILBUD} tilbud for at få analyse (du har ${tilbud.length})`,
          minimumTilbud: true,
        }),
      };
    }

    // Beregn statistik
    const sendte = tilbud.filter(t => t.status !== 'kladde');
    const accepterede = tilbud.filter(t => t.status === 'accepteret');
    const acceptRate = sendte.length > 0 ? Math.round((accepterede.length / sendte.length) * 100) : 0;
    const gennemsnit = tilbud.length > 0 ? Math.round(tilbud.reduce((s, t) => s + (t.total || 0), 0) / tilbud.length) : 0;

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
    "konkret råd 1 (max 2 sætninger, brug tal fra data)",
    "konkret råd 2 (max 2 sætninger, brug tal fra data)",
    "konkret råd 3 (max 2 sætninger, brug tal fra data)"
  ]
}
Statistik: acceptrate ${acceptRate}%, gennemsnitsbeløb ${gennemsnit.toLocaleString('da-DK')} kr, ${tilbud.length} tilbud i alt.
Vær konkret og brug de faktiske tal. Ingen generiske råd. Kun JSON.`;

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
            { role: 'user', content: JSON.stringify(oversigt) },
          ],
          max_tokens: 2000,
        }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000)),
    ]);

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error.message);
    const tekst = aiData.choices[0].message.content.trim();
    // Parse JSON fra svaret (o4-mini kan tilføje markdown)
    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Ingen gyldig JSON i svar');
    const result = JSON.parse(jsonMatch[0]);
    // Sikr at raad altid er et array
    if (!Array.isArray(result.raad)) result.raad = [];
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-vindanalyse fejl:', e.message);
    const msg = e.message === 'Timeout' ? 'Analyse tog for lang tid – prøv igen' : 'Fejl ved analyse af tilbud';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

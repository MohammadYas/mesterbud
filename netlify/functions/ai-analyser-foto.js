const Anthropic = require('@anthropic-ai/sdk');
const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse,
  validateSchema, parseBody, CORS_HEADERS,
} = require('./_security');

const DAGLIG_AI_KVOTE = 20;

const SYSTEM_PROMPT = `Du er ekspert i danske håndværkerpriser. Analyser dette billede af en opgave og returner KUN valid JSON:
{
  "linjer": [
    {
      "beskrivelse": "string",
      "antal": number,
      "enhed": "stk|time|m²|m|ls",
      "enhedspris": number
    }
  ],
  "opgavebeskrivelse": "string",
  "noter": "string (eventuelle forbehold baseret på billedet – tom streng hvis ingen)"
}
Brug realistiske danske markedspriser for 2025. Ingen forklaring, kun JSON.`;

const GYLDIGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64_LEN = 14_000_000;

async function checkOgInkrementerKvote(store, userId) {
  const dagNoegle = new Date().toISOString().slice(0, 10);
  const key = `meta/${userId}/ai-foto-kvote/${dagNoegle}`;
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

  const rl = checkRateLimit(`ai-foto:${user.sub}`, 3, 60_000);
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
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: `Daglig fotoanalyse-grænse på ${DAGLIG_AI_KVOTE} kald nået. Prøv igen i morgen.` }),
    };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

  // Understøt både 'billede' (spec) og 'base64' (baglæns kompatibilitet)
  const billedeData = body.billede || body.base64 || '';
  const { valid, errors, data } = validateSchema({
    billede:  billedeData,
    mimeType: body.mimeType,
  }, {
    billede:  { type: 'string', required: true, maxLen: MAX_BASE64_LEN },
    mimeType: { type: 'string', maxLen: 30 },
  });
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

  const mime = GYLDIGE_MIME.includes(data.mimeType) ? data.mimeType : 'image/jpeg';

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await Promise.race([
      anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mime,
                  data: data.billede,
                },
              },
              { type: 'text', text: SYSTEM_PROMPT },
            ],
          }
        ],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 25000))
    ]);

    const tekst = message.content[0].text.trim();
    const jsonMatch = tekst.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Ingen gyldig JSON i svar');
    const result = JSON.parse(jsonMatch[0]);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (e) {
    console.error('ai-analyser-foto fejl:', e.message);
    const msg = e.message === 'Timeout' ? 'AI-billedanalyse tog for lang tid – prøv igen' : 'Fejl ved billedanalyse';
    return { statusCode: 500, headers, body: JSON.stringify({ error: msg }) };
  }
};

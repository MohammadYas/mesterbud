const { getStore } = require('@netlify/blobs');
const { checkRateLimit, rateLimitResponse, CORS_HEADERS, parseBody } = require('./_security');
const { sendNotifikation } = require('./_notifikationer');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };

  const body = parseBody(event);
  const store = getStore('mesterbud');

  // ── Offentlig adgang via token (ingen JWT) ─────────────────────────────
  if (body?.mode === 'offentlig') {
    const { token, fakturaId } = body;
    if (!token || !fakturaId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler token eller fakturaId' }) };
    }
    try {
      const mappingRaw = await store.get(`meta/faktura-public/${fakturaId}`);
      if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const { userId } = JSON.parse(mappingRaw);
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const faktura = JSON.parse(raw);
      if (faktura.publicToken !== token) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
      }

      // Tracking: log åbning
      const nu = new Date().toISOString();
      if (!faktura.aabninger) faktura.aabninger = [];
      faktura.aabninger.push({ tidspunkt: nu, userAgent: (event.headers?.['user-agent'] || '').slice(0, 200) });

      // Første åbning
      if (!faktura.foersteSetDato) {
        faktura.foersteSetDato = nu;
        if (faktura.status === 'afventer_betaling') {
          faktura.status = 'set';
          faktura.opdateret = nu;
        }
        // Notifikation til brugeren
        try {
          const profilRaw = await store.get(`profil/${userId}`);
          if (profilRaw) {
            const profil = JSON.parse(profilRaw);
            const brugerEmail = profil.virksomhed?.email || profil.email;
            if (brugerEmail) {
              const totalStr = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0 }).format(faktura.total || 0) + ' kr.';
              await sendNotifikation({
                type: 'dokument_set',
                til: brugerEmail,
                data: {
                  dokumentType: 'faktura',
                  dokumentNr: fakturaId,
                  kundeNavn: faktura.modtager?.kontaktperson || faktura.modtager?.navn || 'Kunden',
                  firmaNavnKunde: faktura.modtager?.navn || '',
                  totalStr,
                },
                notifPraeferencer: profil.notifikationer,
              });
            }
          }
        } catch (e) { console.error('Notifikation fejlede (faktura set):', e.message); }
      }

      await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));

      // Fjern intern data fra svar
      const { publicToken: _pt, aabninger: _ab, ...fakturaPublic } = faktura;
      return { statusCode: 200, headers, body: JSON.stringify(fakturaPublic) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── Bekræft betaling fra kunde (ingen JWT) ─────────────────────────────
  if (body?.mode === 'bekraeft_betaling') {
    const { token, fakturaId } = body;
    if (!token || !fakturaId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler token eller fakturaId' }) };
    }
    try {
      const mappingRaw = await store.get(`meta/faktura-public/${fakturaId}`);
      if (!mappingRaw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const { userId } = JSON.parse(mappingRaw);
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      const faktura = JSON.parse(raw);
      if (faktura.publicToken !== token) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Ugyldigt link' }) };
      }
      if (faktura.status !== 'betalt') {
        faktura.status = 'betalt_af_kunde';
        faktura.betaletAfKunde = new Date().toISOString();
        await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));

        // Notifikation til brugeren
        try {
          const profilRaw = await store.get(`profil/${userId}`);
          if (profilRaw) {
            const profil = JSON.parse(profilRaw);
            const brugerEmail = profil.virksomhed?.email || profil.email;
            if (brugerEmail) {
              const totalStr = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0 }).format(faktura.total || 0) + ' kr.';
              await sendNotifikation({
                type: 'faktura_betalt_af_kunde',
                til: brugerEmail,
                data: {
                  dokumentNr: fakturaId,
                  kundeNavn: faktura.modtager?.kontaktperson || faktura.modtager?.navn || 'Kunden',
                  firmaNavnKunde: faktura.modtager?.navn || '',
                  totalStr,
                },
                notifPraeferencer: profil.notifikationer,
              });
            }
          }
        } catch (e) { console.error('Notifikation fejlede (betalt_af_kunde):', e.message); }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, firmanavn: faktura.afsender?.firmanavn }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── JWT-beskyttet ──────────────────────────────────────────────────────
  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`get-faktura:${user.sub}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;

  try {
    if (body?.mode === 'enkelt') {
      const { fakturaId } = body;
      if (!fakturaId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mangler fakturaId' }) };
      const raw = await store.get(`faktura/${userId}/${fakturaId}`);
      if (!raw) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Faktura ikke fundet' }) };
      return { statusCode: 200, headers, body: raw };
    }

    // mode: "alle"
    const list = await store.list({ prefix: `faktura/${userId}/` });
    const fakturaer = [];
    for (const blob of list.blobs) {
      try {
        const raw = await store.get(blob.key);
        if (raw) fakturaer.push(JSON.parse(raw));
      } catch {}
    }
    fakturaer.sort((a, b) => new Date(b.opdateret) - new Date(a.opdateret));
    return { statusCode: 200, headers, body: JSON.stringify(fakturaer) };
  } catch (e) {
    console.error('get-faktura fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

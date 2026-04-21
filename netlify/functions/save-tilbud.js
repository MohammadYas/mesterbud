const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, getClientIP, rateLimitResponse,
  validateSchema, parseBody, sanitizeString, CORS_HEADERS,
} = require('./_security');

// Tilladte enhedsværdier
const GYLDIGE_ENHEDER = ['stk', 'time', 'm²', 'm', 'm³', 'ls', 'm3', 'kg', 'dag', 'sæt'];

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  // Rate limit: 60 req/min pr. bruger
  const rl = checkRateLimit(`save-tilbud:${user.sub}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;
  const store = getStore('mesterbud');

  // DELETE
  if (event.httpMethod === 'DELETE') {
    try {
      const body = parseBody(event);
      if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };
      const id = sanitizeString(body.id, 30);
      if (!id || id.length < 1 || !/^[\w\-\.]+$/.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt tilbuds-ID' }) };
      }
      await store.delete(`tilbud/${userId}/${id}`);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metode ikke tilladt' }) };
  }

  try {
    const body = parseBody(event);
    if (!body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig JSON' }) };

    // Validér tilbuds-top-niveau
    const { valid, errors, data: top } = validateSchema(body, {
      id:          { type: 'string', maxLen: 30 },
      titel:       { type: 'string', maxLen: 200 },
      status:      { type: 'string', enum: ['kladde', 'sendt', 'accepteret', 'afvist'], default: 'kladde' },
      noter:       { type: 'string', maxLen: 2000 },
      gyldigDage:  { type: 'number', min: 1, max: 365, default: 30 },
      moms:        { type: 'boolean', default: true },
    });
    if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: errors.join(', ') }) };

    // Sanér modtager-felter
    const modtager = body.modtager || {};
    const cleanModtager = {
      navn:          sanitizeString(modtager.navn, 100),
      kontaktperson: sanitizeString(modtager.kontaktperson, 100),
      email:         sanitizeString(modtager.email, 254).toLowerCase(),
      telefon:       sanitizeString(modtager.telefon, 30),
      adresse:       sanitizeString(modtager.adresse, 200),
      cvr:           sanitizeString(modtager.cvr, 20),
      ean:           sanitizeString(modtager.ean, 20),
    };

    // Sanér linjer (maks. 100 linjer)
    const rawLinjer = Array.isArray(body.linjer) ? body.linjer.slice(0, 100) : [];
    const cleanLinjer = rawLinjer.map(l => ({
      beskrivelse: sanitizeString(l.beskrivelse, 300),
      antal:       Math.max(0, Math.min(Number(l.antal) || 0, 1_000_000)),
      enhed:       GYLDIGE_ENHEDER.includes(l.enhed) ? l.enhed : 'stk',
      enhedspris:  Math.max(0, Math.min(Number(l.enhedspris) || 0, 10_000_000)),
    })).filter(l => l.beskrivelse);

    // Beregn totaler server-side (stol ikke på klientens tal)
    // inkluderMoms bestemmes nedenfor (efter afsender sanering)
    const subtotal = cleanLinjer.reduce((sum, l) => sum + l.antal * l.enhedspris, 0);

    // ── Plankvote: Basis = maks. 10 tilbud/måned, Pro = ubegrænset ──
    const erNyt = !top.id;
    if (erNyt) {
      // Hent plan fra profil
      let plan = 'basis';
      try {
        const profilRaw = await store.get(`profil/${userId}`);
        if (profilRaw) plan = (JSON.parse(profilRaw).plan || 'basis');
      } catch {}

      if (plan !== 'pro') {
        const maaned = new Date().toISOString().slice(0, 7); // YYYY-MM
        const kvoteKey = `meta/${userId}/tilbud-maaned/${maaned}`;
        let maanedCount = 0;
        try {
          const raw = await store.get(kvoteKey);
          maanedCount = raw ? parseInt(raw, 10) : 0;
        } catch {}

        if (maanedCount >= 10) {
          return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
              error: 'Du har nået grænsen på 10 tilbud denne måned. Opgrader til Pro for ubegrænsede tilbud.',
              kvote: { grænse: 10, brugt: maanedCount, kræverPro: true },
            }),
          };
        }
        // Increment månedstæller
        await store.set(kvoteKey, String(maanedCount + 1));
      }
    }

    // Auto-generer tilbudsnummer hvis nyt
    let tilbudsId = top.id;
    if (!tilbudsId) {
      let counter = 0;
      try {
        const raw = await store.get(`meta/${userId}/counter`);
        counter = raw ? parseInt(raw, 10) : 0;
      } catch { counter = 0; }
      counter++;
      await store.set(`meta/${userId}/counter`, String(counter));
      const year = new Date().getFullYear();
      tilbudsId = `MB-${year}-${String(counter).padStart(3, '0')}`;
    }

    // Sanér afsender-felter
    const afsenderRaw = body.afsender || {};
    const cleanAfsender = {
      firmanavn: sanitizeString(afsenderRaw.firmanavn, 100),
      adresse:   sanitizeString(afsenderRaw.adresse, 200),
      cvr:       sanitizeString(afsenderRaw.cvr, 20),
      telefon:   sanitizeString(afsenderRaw.telefon, 30),
      email:     sanitizeString(afsenderRaw.email, 254).toLowerCase(),
    };

    // Bestem moms-flag (klient sender inkluderMoms boolean ELLER moms som beløb)
    const inkluderMoms = body.inkluderMoms !== undefined ? Boolean(body.inkluderMoms) : top.moms;
    const momsBeloeb = inkluderMoms ? subtotal * 0.25 : 0;
    const total = subtotal + momsBeloeb;

    const tilbud = {
      id: tilbudsId,
      userId,
      titel: top.titel || '',
      status: top.status,
      dato: sanitizeString(body.dato || '', 10),
      gyldigTil: sanitizeString(body.gyldigTil || '', 10),
      beskrivelse: sanitizeString(body.beskrivelse || '', 500),
      noter: sanitizeString(body.note || body.noter || '', 2000),
      betalingsbetingelser: sanitizeString(body.betalingsbetingelser || 'netto14', 30),
      gyldigDage: top.gyldigDage,
      inkluderMoms,
      afsender: cleanAfsender,
      modtager: cleanModtager,
      linjer: cleanLinjer,
      subtotal,
      momsBeloeb,
      total,
      opdateret: new Date().toISOString(),
      oprettet: body.oprettet || new Date().toISOString(),
      // Bevar kundeSvar og opfølgning hvis eksisterer
      ...(body.kundeResponse ? { kundeResponse: body.kundeResponse } : {}),
      ...(body.opfoelgningsendt ? { opfoelgningsendt: body.opfoelgningsendt } : {}),
      // Virksomhedsinfo snapshot (fra konto)
      ...(body.virksomhed ? { virksomhed: body.virksomhed } : {}),
    };

    await store.set(`tilbud/${userId}/${tilbudsId}`, JSON.stringify(tilbud));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, tilbud }) };
  } catch (e) {
    console.error('save-tilbud fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Intern serverfejl' }) };
  }
};

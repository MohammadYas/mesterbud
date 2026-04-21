const { getStore } = require('@netlify/blobs');
const {
  checkRateLimit, rateLimitResponse, CORS_HEADERS,
  parseBody, sanitizeString,
} = require('./_security');

const GYLDIGE_ENHEDER = ['stk', 'time', 'm²', 'm', 'ls', 'm3', 'kg', 'dag', 'sæt'];
const GYLDIGE_STATUSSER = ['kladde', 'afventer_betaling', 'forfalden', 'betalt', 'betalt_af_kunde'];

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const rl = checkRateLimit(`save-faktura:${user.sub}`, 60, 60_000);
  if (rl.limited) return rateLimitResponse(rl.retryAfter);

  const userId = user.sub;
  const store = getStore('mesterbud');

  // DELETE
  if (event.httpMethod === 'DELETE') {
    try {
      const body = parseBody(event);
      const id = sanitizeString(body?.id || '', 30);
      if (!id || !/^[\w\-\.]+$/.test(id)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldigt faktura-ID' }) };
      }
      await store.delete(`faktura/${userId}/${id}`);
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

    const existingId = sanitizeString(body.id || '', 30);
    const erNyt = !existingId;

    // Auto-generer fakturanummer
    let fakturaId = existingId;
    if (erNyt) {
      let counter = 0;
      try {
        const raw = await store.get(`meta/${userId}/faktura-counter`);
        counter = raw ? parseInt(raw, 10) : 0;
      } catch {}
      counter++;
      await store.set(`meta/${userId}/faktura-counter`, String(counter));
      const year = new Date().getFullYear();
      fakturaId = `MB-F-${year}-${String(counter).padStart(3, '0')}`;
    }

    // Sanitér afsender
    const afs = body.afsender || {};
    const cleanAfs = {
      firmanavn:  sanitizeString(afs.firmanavn  || '', 100),
      adresse:    sanitizeString(afs.adresse    || '', 200),
      cvr:        sanitizeString(afs.cvr        || '', 20),
      telefon:    sanitizeString(afs.telefon    || '', 30),
      email:      sanitizeString(afs.email      || '', 254).toLowerCase(),
      regNr:      sanitizeString(afs.regNr      || '', 10),
      kontoNr:    sanitizeString(afs.kontoNr    || '', 20),
      mobilePay:  sanitizeString(afs.mobilePay  || '', 20),
    };

    // Sanitér modtager
    const mod = body.modtager || {};
    const cleanMod = {
      navn:          sanitizeString(mod.navn          || '', 100),
      cvr:           sanitizeString(mod.cvr           || '', 20),
      kontaktperson: sanitizeString(mod.kontaktperson || '', 100),
      stilling:      sanitizeString(mod.stilling      || '', 100),
      adresse:       sanitizeString(mod.adresse       || '', 200),
      email:         sanitizeString(mod.email         || '', 254).toLowerCase(),
      telefon:       sanitizeString(mod.telefon       || '', 30),
      ean:           sanitizeString(mod.ean           || '', 20),
      reference:     sanitizeString(mod.reference     || '', 100),
    };

    // Sanitér linjer
    const rawLinjer = Array.isArray(body.linjer) ? body.linjer.slice(0, 100) : [];
    const cleanLinjer = rawLinjer.map(l => ({
      beskrivelse: sanitizeString(l.beskrivelse || '', 300),
      antal:       Math.max(0, Math.min(Number(l.antal) || 0, 1_000_000)),
      enhed:       GYLDIGE_ENHEDER.includes(l.enhed) ? l.enhed : 'stk',
      enhedspris:  Math.max(0, Math.min(Number(l.enhedspris) || 0, 10_000_000)),
    })).filter(l => l.beskrivelse);

    // Beregn totaler
    const subtotal = cleanLinjer.reduce((s, l) => s + l.antal * l.enhedspris, 0);
    const aconto   = Math.max(0, Math.min(Number(body.aconto) || 0, subtotal));
    const grundlag = Math.max(0, subtotal - aconto);
    const momsBeloeb = grundlag * 0.25;
    const total = grundlag + momsBeloeb;

    const status = GYLDIGE_STATUSSER.includes(body.status) ? body.status : 'kladde';

    const faktura = {
      id: fakturaId,
      userId,
      status,
      fakturadato:          sanitizeString(body.fakturadato    || '', 10),
      forfaldsdato:         sanitizeString(body.forfaldsdato   || '', 10),
      betalingsbetingelse:  ['netto8','netto14','netto30','straks'].includes(body.betalingsbetingelse) ? body.betalingsbetingelse : 'netto14',
      beskrivelse:          sanitizeString(body.beskrivelse    || '', 1000),
      note:                 sanitizeString(body.note           || '', 2000),
      afsender: cleanAfs,
      modtager: cleanMod,
      linjer: cleanLinjer,
      aconto,
      subtotal,
      momsBeloeb,
      total,
      konverteretFraTilbud: sanitizeString(body.konverteretFraTilbud || '', 30) || null,
      publicToken:  body.publicToken  || null,
      sendt:        body.sendt        || null,
      rykkerSendt:  body.rykkerSendt  || null,
      rykkerAntal:  Math.max(0, Number(body.rykkerAntal) || 0),
      betaletAfKunde: body.betaletAfKunde || null,
      opdateret: new Date().toISOString(),
      oprettet:  body.oprettet || new Date().toISOString(),
    };

    await store.set(`faktura/${userId}/${fakturaId}`, JSON.stringify(faktura));
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, faktura }) };
  } catch (e) {
    console.error('save-faktura fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Intern serverfejl' }) };
  }
};

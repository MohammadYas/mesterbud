/**
 * admin-get-activity.js
 * Henter aktivitetslog + tilbudsstatistik på tværs af alle brugere
 * POST body: {} (ingen parametre krævet)
 */

const { getStore } = require('@netlify/blobs');
const { adminGuard, ADMIN_HEADERS } = require('./_admin-auth');
const { getActivityLog } = require('./_admin-log');

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  const store = getStore('mesterbud');

  try {
    // ── Tilbudsstatistik på tværs af alle brugere ──────────────────────────
    const tilbudList = await store.list({ prefix: 'tilbud/' });
    let totalTilbud = 0;
    let statusCount = { kladde: 0, sendt: 0, accepteret: 0, afvist: 0 };
    let totalVaerdi = 0;
    let aiStemmeCount = 0;
    let aiFotoCount = 0;
    let aiOpfoelgningCount = 0;

    // AI-kvote blobs
    const kvoteList = await store.list({ prefix: 'meta/' });
    kvoteList.blobs.forEach(b => {
      if (b.key.includes('/ai-kvote/')) aiStemmeCount++;
      if (b.key.includes('/ai-foto-kvote/')) aiFotoCount++;
      if (b.key.includes('/ai-opf-kvote/')) aiOpfoelgningCount++;
      if (b.key.includes('/mail-kvote/')) aiOpfoelgningCount++;
    });

    // Top brugere
    const brugerStats = {}; // userId → { count, vaerdi, navn }

    const tilbudRaws = await Promise.all(
      tilbudList.blobs.slice(0, 1000).map(b => store.get(b.key).catch(() => null))
    );

    tilbudRaws.forEach((raw, i) => {
      if (!raw) return;
      try {
        const t = JSON.parse(raw);
        totalTilbud++;
        statusCount[t.status] = (statusCount[t.status] || 0) + 1;
        totalVaerdi += t.total || 0;

        const parts = tilbudList.blobs[i].key.split('/');
        const userId = parts[1];
        if (!brugerStats[userId]) brugerStats[userId] = { count: 0, vaerdi: 0 };
        brugerStats[userId].count++;
        brugerStats[userId].vaerdi += t.total || 0;

        if (t.opfoelgningsendt) aiOpfoelgningCount++;
      } catch {}
    });

    const acceptRate = (statusCount.sendt + statusCount.accepteret + statusCount.afvist) > 0
      ? Math.round((statusCount.accepteret / (statusCount.sendt + statusCount.accepteret + statusCount.afvist)) * 100)
      : 0;

    const snittilbudVaerdi = totalTilbud > 0 ? Math.round(totalVaerdi / totalTilbud) : 0;

    // Top 10 brugere
    const top10 = Object.entries(brugerStats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([userId, stats]) => ({ userId, ...stats, vaerdi: Math.round(stats.vaerdi) }));

    // ── Aktivitetslog – seneste 500 events ────────────────────────────────
    const events = await getActivityLog(500);

    // Filtrer kun seneste 7 dage
    const syv = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentEvents = events.filter(e => e.ts >= syv);

    return {
      statusCode: 200,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        tilbud: {
          total: totalTilbud,
          statusCount,
          acceptRate,
          snittilbudVaerdi,
          top10Brugere: top10,
        },
        ai: {
          stemme: aiStemmeCount,
          foto: aiFotoCount,
          opfoelgning: aiOpfoelgningCount,
        },
        recentEvents,
        allEvents: events.slice(0, 500),
      }),
    };
  } catch (e) {
    console.error('admin-get-activity fejl:', e);
    return {
      statusCode: 500,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ error: 'Fejl ved hentning af aktivitet' }),
    };
  }
};

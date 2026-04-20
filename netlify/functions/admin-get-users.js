/**
 * admin-get-users.js
 * Henter alle brugere fra Netlify Identity + beriget med blob-data
 * Pagineret: 50 pr. side
 * POST body: { page: 0, search: "", filter: "alle" }
 */

const { getStore } = require('@netlify/blobs');
const { adminGuard, ADMIN_HEADERS } = require('./_admin-auth');
const { parseBody, sanitizeString } = require('./_security');

const PAGE_SIZE = 50;

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  const body = parseBody(event) || {};
  const page = Math.max(0, parseInt(body.page) || 0);
  const search = sanitizeString(body.search || '', 100).toLowerCase();
  const filter = ['alle', 'trial', 'basis', 'pro', 'none'].includes(body.filter) ? body.filter : 'alle';

  const store = getStore('mesterbud');

  try {
    // ── Hent brugere fra Netlify Identity ─────────────────────────────────
    let identityUsers = [];
    let totalFromIdentity = 0;

    if (process.env.NETLIFY_API_TOKEN && process.env.NETLIFY_SITE_ID) {
      try {
        const netRes = await fetch(
          `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/identity/users?per_page=100&page=${page}`,
          { headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` } }
        );
        if (netRes.ok) {
          const d = await netRes.json();
          identityUsers = d.users || [];
          totalFromIdentity = d.total || identityUsers.length;
        }
      } catch (e) {
        console.error('Identity API fejl:', e.message);
      }
    }

    // ── Hent alle blob-profiler ────────────────────────────────────────────
    const profileList = await store.list({ prefix: 'profil/' });
    const profileMap = {}; // userId → profil
    await Promise.all(profileList.blobs.map(async b => {
      try {
        const raw = await store.get(b.key);
        if (raw) {
          const p = JSON.parse(raw);
          const userId = b.key.replace('profil/', '');
          profileMap[userId] = p;
        }
      } catch {}
    }));

    // ── Tæl tilbud pr. bruger ──────────────────────────────────────────────
    const tilbudList = await store.list({ prefix: 'tilbud/' });
    const tilbudCountMap = {}; // userId → { count, totalVaerdi }
    await Promise.all(tilbudList.blobs.map(async b => {
      const parts = b.key.split('/');
      if (parts.length < 3) return;
      const userId = parts[1];
      try {
        const raw = await store.get(b.key);
        if (!raw) return;
        const t = JSON.parse(raw);
        if (!tilbudCountMap[userId]) tilbudCountMap[userId] = { count: 0, totalVaerdi: 0 };
        tilbudCountMap[userId].count++;
        tilbudCountMap[userId].totalVaerdi += (t.total || 0);
      } catch {}
    }));

    // ── Kombiner data ──────────────────────────────────────────────────────
    let users;

    if (identityUsers.length > 0) {
      users = identityUsers.map(u => {
        const profil = profileMap[u.id] || {};
        const tilbudStats = tilbudCountMap[u.id] || { count: 0, totalVaerdi: 0 };
        return buildUserObj(u.id, u.email, u.user_metadata?.full_name, u.created_at, profil, tilbudStats);
      });
    } else {
      // Fallback: brug blob-profiler alene (ingen email)
      users = Object.entries(profileMap).map(([userId, profil]) => {
        const tilbudStats = tilbudCountMap[userId] || { count: 0, totalVaerdi: 0 };
        return buildUserObj(userId, profil.email || '—', profil.virksomhed?.navn, profil.oprettet, profil, tilbudStats);
      });
    }

    // ── Filter + søgning ───────────────────────────────────────────────────
    if (search) {
      users = users.filter(u =>
        u.email.toLowerCase().includes(search) ||
        (u.name || '').toLowerCase().includes(search)
      );
    }
    if (filter !== 'alle') {
      users = users.filter(u => u.plan === filter);
    }

    // ── Sorter: nyeste først ───────────────────────────────────────────────
    users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total = users.length;
    const paginated = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return {
      statusCode: 200,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ users: paginated, total, page, pageSize: PAGE_SIZE }),
    };
  } catch (e) {
    console.error('admin-get-users fejl:', e);
    return {
      statusCode: 500,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ error: 'Fejl ved hentning af brugerliste' }),
    };
  }
};

function buildUserObj(userId, email, name, createdAt, profil, tilbudStats) {
  const plan = profil.plan || 'trial';

  // Beregn status
  let status = 'aktiv';
  if (plan === 'none') {
    status = 'churned';
  } else if (profil.opdateret) {
    const dageSidenAktiv = (Date.now() - new Date(profil.opdateret).getTime()) / 86400000;
    if (dageSidenAktiv > 30) status = 'inaktiv';
  }

  return {
    id: userId,
    email: email || '—',
    name: name || profil.virksomhed?.navn || '',
    createdAt: createdAt || profil.oprettet || null,
    plan,
    status,
    tilbudCount: tilbudStats.count,
    totalTilbudVaerdi: Math.round(tilbudStats.totalVaerdi),
    lastActive: profil.opdateret || profil.oprettet || null,
    stripeCustomerId: profil.stripeCustomerId || null,
    virksomhed: profil.virksomhed?.navn || '',
  };
}

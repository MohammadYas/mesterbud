/**
 * admin-get-stats.js
 * Overblik: totalUsers, activeSubscriptions, mrr, tilbudToday,
 * recentEvents, userChartData (30 dage), revenueChartData (30 dage)
 */

const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');
const { adminGuard, ADMIN_HEADERS } = require('./_admin-auth');
const { getActivityLog } = require('./_admin-log');
const { parseBody } = require('./_security');

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  try {
    const store = getStore('mesterbud');
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── 1. Brugere fra Netlify Identity API ────────────────────────────────
    let totalUsers = 0;
    let usersCreatedByDay = {}; // { "2026-04-01": 3 }
    try {
      const netRes = await fetch(
        `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/identity/users?per_page=100`,
        { headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` } }
      );
      if (netRes.ok) {
        const netData = await netRes.json();
        const users = netData.users || [];
        totalUsers = netData.total || users.length;
        users.forEach(u => {
          const day = (u.created_at || '').slice(0, 10);
          if (day) usersCreatedByDay[day] = (usersCreatedByDay[day] || 0) + 1;
        });
      }
    } catch (e) {
      console.error('Netlify Identity API fejl:', e.message);
      // Fallback: tæl profil-blobs
      try {
        const list = await store.list({ prefix: 'profil/' });
        totalUsers = list.blobs.length;
      } catch {}
    }

    // ── 2. Stripe abonnementer & MRR ───────────────────────────────────────
    let activeSubscriptions = 0;
    let mrr = 0;
    let revenueByDay = {}; // { "2026-04-01": 299 }
    try {
      const subs = await stripe.subscriptions.list({ status: 'active', limit: 100 });
      activeSubscriptions = subs.data.length;
      subs.data.forEach(s => {
        const price = s.items.data[0]?.price;
        const amount = price ? (price.unit_amount / 100) : 0;
        mrr += amount;
      });

      // Betalinger seneste 30 dage til graf
      const since = Math.floor(Date.now() / 1000) - 30 * 86400;
      const charges = await stripe.charges.list({ limit: 100, created: { gte: since } });
      charges.data.filter(c => c.paid && !c.refunded).forEach(c => {
        const day = new Date(c.created * 1000).toISOString().slice(0, 10);
        revenueByDay[day] = (revenueByDay[day] || 0) + (c.amount / 100);
      });
    } catch (e) {
      console.error('Stripe fejl:', e.message);
    }

    // ── 3. Tilbud oprettet i dag ───────────────────────────────────────────
    let tilbudToday = 0;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const allProfiles = await store.list({ prefix: 'tilbud/' });
      const checkPromises = allProfiles.blobs.slice(0, 500).map(async b => {
        try {
          const raw = await store.get(b.key);
          if (!raw) return false;
          const t = JSON.parse(raw);
          return (t.oprettet || '').slice(0, 10) === today;
        } catch { return false; }
      });
      const results = await Promise.all(checkPromises);
      tilbudToday = results.filter(Boolean).length;
    } catch (e) {
      console.error('Tilbud-count fejl:', e.message);
    }

    // ── 4. Seneste hændelser fra aktivitetslog ─────────────────────────────
    const recentEvents = await getActivityLog(10);

    // ── 5. Byg 30-dages labels ─────────────────────────────────────────────
    const labels = [];
    const userPoints = [];
    const revenuePoints = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      labels.push(d.slice(5)); // MM-DD
      userPoints.push(usersCreatedByDay[d] || 0);
      revenuePoints.push(Math.round(revenueByDay[d] || 0));
    }

    return {
      statusCode: 200,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        totalUsers,
        activeSubscriptions,
        mrr: Math.round(mrr),
        tilbudToday,
        recentEvents,
        userChartData: { labels, data: userPoints },
        revenueChartData: { labels, data: revenuePoints },
      }),
    };
  } catch (e) {
    console.error('admin-get-stats fejl:', e);
    return {
      statusCode: 500,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ error: 'Serverfejl ved hentning af statistik' }),
    };
  }
};

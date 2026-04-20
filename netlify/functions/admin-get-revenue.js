/**
 * admin-get-revenue.js
 * MRR, ARR, churnRate, ARPU, 12-måneders graf, transaktionsliste
 */

const Stripe = require('stripe');
const { adminGuard, ADMIN_HEADERS } = require('./_admin-auth');

const BASIS_PRICE = parseInt(process.env.STRIPE_PRICE_BASIS_AMOUNT || '149');
const PRO_PRICE   = parseInt(process.env.STRIPE_PRICE_PRO_AMOUNT   || '299');

exports.handler = async (event, context) => {
  const denied = adminGuard(event, context);
  if (denied) return denied;

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    // ── Aktive abonnementer ────────────────────────────────────────────────
    const [activeSubs, canceledSubs] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.customer', 'data.items.data.price'] }),
      stripe.subscriptions.list({ status: 'canceled', limit: 100, created: { gte: Math.floor(Date.now() / 1000) - 30 * 86400 } }),
    ]);

    let mrr = 0;
    let basisCount = 0;
    let proCount = 0;
    let basisMrr = 0;
    let proMrr = 0;

    activeSubs.data.forEach(s => {
      const price = s.items.data[0]?.price;
      const amount = price ? (price.unit_amount / 100) : 0;
      const priceId = price?.id;
      mrr += amount;
      if (priceId === process.env.STRIPE_PRICE_BASIS) {
        basisCount++;
        basisMrr += amount;
      } else if (priceId === process.env.STRIPE_PRICE_PRO) {
        proCount++;
        proMrr += amount;
      } else {
        // Gæt på beløb
        if (amount <= BASIS_PRICE + 10) { basisCount++; basisMrr += amount; }
        else { proCount++; proMrr += amount; }
      }
    });

    const arr = Math.round(mrr * 12);
    const totalActive = activeSubs.data.length;
    const churnRate = totalActive > 0
      ? Math.round((canceledSubs.data.length / (totalActive + canceledSubs.data.length)) * 100 * 10) / 10
      : 0;
    const arpu = totalActive > 0 ? Math.round(mrr / totalActive) : 0;

    // ── 12-måneders omsætning fra charges ─────────────────────────────────
    const twelveMonthsAgo = Math.floor(Date.now() / 1000) - 365 * 86400;
    const charges = await stripe.charges.list({
      limit: 100,
      created: { gte: twelveMonthsAgo },
    });

    const revenueByMonth = {};
    charges.data.filter(c => c.paid && !c.refunded).forEach(c => {
      const d = new Date(c.created * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = (revenueByMonth[key] || 0) + (c.amount / 100);
    });

    const monthLabels = [];
    const monthData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const daDK = d.toLocaleDateString('da-DK', { month: 'short', year: '2-digit' });
      monthLabels.push(daDK);
      monthData.push(Math.round(revenueByMonth[key] || 0));
    }

    // ── Transaktionsliste (seneste 50) ─────────────────────────────────────
    const recentCharges = await stripe.charges.list({ limit: 50, expand: ['data.customer'] });
    const transactions = recentCharges.data.map(c => ({
      id: c.id,
      dato: new Date(c.created * 1000).toISOString(),
      beloeb: c.amount / 100,
      valuta: c.currency.toUpperCase(),
      status: c.paid ? (c.refunded ? 'refunderet' : 'betalt') : 'fejlet',
      email: (c.customer?.email || c.billing_details?.email || '—'),
      beskrivelse: c.description || '—',
    }));

    return {
      statusCode: 200,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({
        mrr: Math.round(mrr),
        arr,
        churnRate,
        arpu,
        basis: { count: basisCount, mrr: Math.round(basisMrr) },
        pro: { count: proCount, mrr: Math.round(proMrr) },
        monthlyChart: { labels: monthLabels, data: monthData },
        transactions,
      }),
    };
  } catch (e) {
    console.error('admin-get-revenue fejl:', e);
    return {
      statusCode: 500,
      headers: ADMIN_HEADERS,
      body: JSON.stringify({ error: 'Fejl ved hentning af økonomidata' }),
    };
  }
};

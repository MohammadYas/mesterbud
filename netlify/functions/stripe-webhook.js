const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('Webhook signatur fejl:', e.message);
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Ugyldig webhook signatur' }) };
  }

  const store = getStore('mesterbud');

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const netlifyUserId = session.metadata?.netlifyUserId;
        const plan = session.metadata?.plan || 'basis';

        if (!netlifyUserId) break;

        // Hent eksisterende profil
        const raw = await store.get(`profil/${netlifyUserId}`);
        const profil = raw ? JSON.parse(raw) : { oprettet: new Date().toISOString() };

        profil.plan = plan;
        profil.stripeCustomerId = session.customer;
        profil.stripeSubscriptionId = session.subscription;
        profil.stripeStatus = 'active';
        profil.planOpdateret = new Date().toISOString();

        // Hent trial-slut + næste betaling fra subscription
        if (session.subscription) {
          try {
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            if (sub.trial_end) {
              profil.trialSlutter = new Date(sub.trial_end * 1000).toISOString();
              profil.plan = plan; // behold plan under trial
            }
            profil.naesteBetaling = new Date(sub.current_period_end * 1000)
              .toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
          } catch (e) {}
        }

        await store.set(`profil/${netlifyUserId}`, JSON.stringify(profil));
        console.log(`Abonnement aktiveret for bruger: ${netlifyUserId}, plan: ${plan}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const customerId = sub.customer;

        // Find bruger via stripeCustomerId
        const list = await store.list({ prefix: 'profil/' });
        for (const blob of list.blobs) {
          const raw = await store.get(blob.key);
          if (!raw) continue;
          const profil = JSON.parse(raw);
          if (profil.stripeCustomerId === customerId) {
            profil.plan = 'none';
            profil.planOpdateret = new Date().toISOString();
            profil.naesteBetaling = null;
            await store.set(blob.key, JSON.stringify(profil));
            console.log(`Abonnement annulleret for: ${blob.key}`);
            break;
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;
        const customerId = sub.customer;
        const newPlanId = sub.items.data[0]?.price?.id;

        // Map price ID til plan navn
        const planMap = {
          [process.env.STRIPE_PRICE_BASIS]: 'basis',
          [process.env.STRIPE_PRICE_PRO]: 'pro',
        };
        const newPlan = planMap[newPlanId];
        if (!newPlan) break;

        const list = await store.list({ prefix: 'profil/' });
        for (const blob of list.blobs) {
          const raw = await store.get(blob.key);
          if (!raw) continue;
          const profil = JSON.parse(raw);
          if (profil.stripeCustomerId === customerId) {
            profil.plan = newPlan;
            profil.naesteBetaling = new Date(sub.current_period_end * 1000)
              .toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
            await store.set(blob.key, JSON.stringify(profil));
            break;
          }
        }
        break;
      }

      default:
        console.log('Ukendt webhook event:', stripeEvent.type);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };
  } catch (e) {
    console.error('Webhook behandlingsfejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};

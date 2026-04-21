/**
 * delete-account.js
 * POST – slet brugerens konto og alle tilknyttede data
 */
const { getStore } = require('@netlify/blobs');
const { CORS_HEADERS } = require('./_security');

exports.handler = async (event, context) => {
  const headers = { ...CORS_HEADERS };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Ikke autoriseret' }) };

  const userId = user.sub;
  const store = getStore('mesterbud');

  try {
    // Slet profil og meta
    await store.delete(`profil/${userId}`).catch(() => {});
    await store.delete(`meta/${userId}/counter`).catch(() => {});

    // Slet alle tilbud for brugeren
    try {
      const list = await store.list({ prefix: `tilbud/${userId}/` });
      for (const blob of list.blobs) {
        await store.delete(blob.key).catch(() => {});
      }
    } catch {}

    // Slet kvoter
    try {
      const metaList = await store.list({ prefix: `meta/${userId}/` });
      for (const blob of metaList.blobs) {
        await store.delete(blob.key).catch(() => {});
      }
    } catch {}

    // Slet bruger via Netlify Identity admin API
    if (process.env.NETLIFY_API_TOKEN && process.env.NETLIFY_SITE_ID) {
      const resp = await fetch(
        `https://api.netlify.com/api/v1/sites/${process.env.NETLIFY_SITE_ID}/identity/users/${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` }
        }
      );
      if (!resp.ok && resp.status !== 404) {
        console.error('Identity delete status:', resp.status);
        // Fortsæt alligevel – data er slettet
      }
    }

    console.log(`Konto slettet for bruger: ${userId}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (e) {
    console.error('delete-account fejl:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Sletning fejlede: ' + e.message }) };
  }
};

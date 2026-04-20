/**
 * _admin-log.js – Aktivitetslog til admin panel
 * Skriver til Netlify Blobs: admin/activity-log
 * Max 5MB – ældste poster slettes automatisk
 */

const { getStore } = require('@netlify/blobs');

const LOG_KEY = 'admin/activity-log';
const ERROR_LOG_KEY = 'admin/error-log';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ERRORS = 100;

/**
 * logActivity(type, msg, data)
 * Tilføjer event til aktivitetslog
 */
async function logActivity(type, msg, data = {}) {
  try {
    const store = getStore('mesterbud');
    const raw = await store.get(LOG_KEY);
    let events = raw ? JSON.parse(raw) : [];

    events.unshift({
      ts: new Date().toISOString(),
      type,
      msg,
      data,
    });

    // Trim til max 5MB
    let json = JSON.stringify(events);
    while (json.length > MAX_BYTES && events.length > 1) {
      events.pop();
      json = JSON.stringify(events);
    }

    await store.set(LOG_KEY, json);
  } catch (e) {
    console.error('logActivity fejl:', e.message);
  }
}

/**
 * logError(functionName, errorMsg)
 * Tilføjer fejl til fejllog
 */
async function logError(functionName, errorMsg) {
  try {
    const store = getStore('mesterbud');
    const raw = await store.get(ERROR_LOG_KEY);
    let errors = raw ? JSON.parse(raw) : [];

    errors.unshift({
      ts: new Date().toISOString(),
      function: functionName,
      error: String(errorMsg).slice(0, 500),
    });

    // Behold kun seneste MAX_ERRORS
    if (errors.length > MAX_ERRORS) errors = errors.slice(0, MAX_ERRORS);

    await store.set(ERROR_LOG_KEY, JSON.stringify(errors));
  } catch { /* Tavs fejl – undgå rekursiv logging */ }
}

/**
 * getActivityLog(limit)
 */
async function getActivityLog(limit = 500) {
  try {
    const store = getStore('mesterbud');
    const raw = await store.get(LOG_KEY);
    const events = raw ? JSON.parse(raw) : [];
    return events.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * getErrorLog()
 */
async function getErrorLog() {
  try {
    const store = getStore('mesterbud');
    const raw = await store.get(ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * clearErrorLog()
 */
async function clearErrorLog() {
  const store = getStore('mesterbud');
  await store.set(ERROR_LOG_KEY, '[]');
}

module.exports = { logActivity, logError, getActivityLog, getErrorLog, clearErrorLog, LOG_KEY, ERROR_LOG_KEY };

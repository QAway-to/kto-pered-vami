// Funnel analytics client. Sends only event names and short enum-like props, never dialog text.
// Acquisition source comes from UTM tags on the web or from the Mini App link: t.me/<bot>/<app>?startapp=<source>_<campaign>.

import { store } from './ui.js';

const ID_FORMAT = /^[A-Za-z0-9-]{8,64}$/; // must match the server check, or every event is rejected
const START_PARAM = /^([A-Za-z0-9-]{1,32})(?:_([A-Za-z0-9_-]{1,32}))?$/;

function anonymousId() {
  const saved = store.get('uid', null);
  if (typeof saved === 'string' && ID_FORMAT.test(saved)) return saved;
  // Older Telegram webviews lack randomUUID.
  const id = crypto.randomUUID?.()
    ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  store.set('uid', id);
  return id;
}

/** @returns {{source?: string, medium?: string, campaign?: string}} */
function currentTouch() {
  const q = new URLSearchParams(window.location.search);
  const utm = { source: q.get('utm_source'), medium: q.get('utm_medium'), campaign: q.get('utm_campaign') };
  if (utm.source) return Object.fromEntries(Object.entries(utm).filter(([, v]) => v));
  const start = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  const m = typeof start === 'string' ? start.match(START_PARAM) : null;
  if (m) return { source: m[1], medium: 'telegram', ...(m[2] ? { campaign: m[2] } : {}) };
  return {};
}

// First touch wins: a returning user keeps the channel that brought them in.
const attribution = store.get('attribution', null) ?? currentTouch();
if (Object.keys(attribution).length) store.set('attribution', attribution);

const platform = window.Telegram?.WebApp?.initData ? 'telegram' : 'web';
const distinctId = anonymousId();

/**
 * Records a funnel event. Never throws and never blocks the UI.
 * @param {string} event
 * @param {Record<string, string|number|boolean>} [props]
 */
export function track(event, props = {}) {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, distinctId, props: { platform, ...attribution, ...props } }),
      keepalive: true,
    }).catch(() => { /* analytics is best-effort */ });
  } catch { /* analytics is best-effort */ }
}

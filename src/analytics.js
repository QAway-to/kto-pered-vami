// Product analytics: the browser posts whitelisted events to /api/track and the server forwards them to PostHog.
// Proxying keeps ad blockers from dropping the funnel and guarantees no dialog text ever leaves the server.

export const EVENTS = Object.freeze([
  'app_opened',
  'archetype_viewed',
  'test_started',
  'test_completed',
  'case_answered',
  'spar_started',
  'spar_completed',
  'lab_started',
  'lab_completed',
  'login_completed',
  'paywall_shown',
  'subscription_confirmed',
]);

export const PROP_KEYS = Object.freeze([
  'platform', 'source', 'medium', 'campaign',
  'archetype', 'guess', 'correct', 'known', 'scenario', 'turns', 'a', 'b', 'winner', 'method',
]);

const DISTINCT_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_VALUE_CHARS = 64;
const FIRST_TOUCH_KEYS = ['source', 'medium', 'campaign'];
// Attribution is free-form user input that sticks to the person forever, so it is held to a slug alphabet.
const SLUG = /^[A-Za-z0-9_.-]+$/;

/**
 * Validates a tracking request from the browser.
 * @param {unknown} body
 * @returns {{ok: true, value: {event: string, distinctId: string, props: Record<string, string|number|boolean>}} | {ok: false, error: string}}
 */
export function validateTrack(body) {
  const { event, distinctId, props = {} } = body ?? {};
  if (!EVENTS.includes(event)) return { ok: false, error: 'Неизвестное событие' };
  if (typeof distinctId !== 'string' || !DISTINCT_ID.test(distinctId)) return { ok: false, error: 'Некорректный id' };
  if (typeof props !== 'object' || props === null || Array.isArray(props)) return { ok: false, error: 'Некорректные свойства' };

  const clean = {};
  for (const [k, v] of Object.entries(props)) {
    if (!PROP_KEYS.includes(k)) continue; // unknown keys are dropped, not rejected, so old clients keep working
    if (FIRST_TOUCH_KEYS.includes(k) && !(typeof v === 'string' && SLUG.test(v))) continue;
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) clean[k] = v;
    else if (typeof v === 'string' && v.length > 0) clean[k] = v.slice(0, MAX_VALUE_CHARS);
  }
  return { ok: true, value: { event, distinctId, props: clean } };
}

/**
 * Creates a PostHog forwarder, or null when no key is configured (analytics is then a silent no-op).
 * @param {{apiKey?: string, host?: string, fetchImpl?: typeof fetch, timeoutMs?: number}} options
 * @returns {{capture: (e: {event: string, distinctId: string, props: Record<string, unknown>, ip?: string}) => Promise<void>} | null}
 */
export function createAnalytics({
  apiKey, host = 'https://eu.i.posthog.com', fetchImpl = fetch, timeoutMs = 3000,
}) {
  if (!apiKey) return null;
  const url = `${host.replace(/\/$/, '')}/i/v0/e/`;

  return {
    async capture({ event, distinctId, props, ip }) {
      // First-touch attribution lives on the person, so every later event can be split by acquisition channel.
      const firstTouch = Object.fromEntries(
        FIRST_TOUCH_KEYS.filter((k) => props[k] != null).map((k) => [`initial_${k}`, props[k]]),
      );
      const properties = {
        ...props,
        ...(ip ? { $ip: ip } : {}),
        ...(Object.keys(firstTouch).length ? { $set_once: firstTouch } : {}),
      };
      try {
        const res = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey, event, distinct_id: distinctId, properties, timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) console.warn(`PostHog rejected ${event}: HTTP ${res.status}`);
      } catch (err) {
        console.warn(`PostHog unreachable for ${event}: ${err.message}`);
      }
    },
  };
}

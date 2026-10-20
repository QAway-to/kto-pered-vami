// Minimal fixed-window in-memory rate limiting (single instance is enough for an MVP on Render).

/**
 * Rate-limit key for a client: IPv6 addresses collapse to their /64, since one host usually owns the whole /64.
 * @param {string|undefined} ip
 * @returns {string}
 */
export function ipKey(ip) {
  if (!ip) return 'unknown';
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) return v4mapped[1];
  if (!ip.includes(':')) return ip;
  const [head] = ip.split('::');
  const groups = head.split(':').filter(Boolean);
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/**
 * Fixed-window counter. `take` spends one unit for a key and says whether it was within the limit,
 * so callers can spend only after cheaper checks (auth, validation) have passed.
 * @param {{windowMs: number, max: number, now?: () => number}} options
 */
export function createCounter({ windowMs, max, now = Date.now }) {
  let hits = new Map();
  let windowStart = now();
  const roll = () => {
    const t = now();
    if (t - windowStart >= windowMs) {
      hits = new Map();
      windowStart = t;
    }
    return t;
  };
  return {
    /** @param {string|number} [key] */
    take(key = 'global') {
      roll();
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return count <= max;
    },
    /** Seconds until the current window resets. */
    retryAfter: () => Math.ceil((windowStart + windowMs - roll()) / 1000),
  };
}

/**
 * Express middleware on top of `createCounter`.
 * @param {{windowMs: number, max: number, now?: () => number, key?: (req: import('express').Request) => string, status?: number, message?: string}} options
 * @returns {import('express').RequestHandler}
 */
export function createRateLimiter({
  windowMs,
  max,
  now = Date.now,
  key = (req) => ipKey(req.ip),
  status = 429,
  message = 'Слишком много запросов. Подождите минуту.',
}) {
  const counter = createCounter({ windowMs, max, now });
  return function rateLimit(req, res, next) {
    if (counter.take(key(req))) return next();
    res.setHeader('Retry-After', counter.retryAfter());
    return res.status(status).json({ success: false, data: null, error: message });
  };
}

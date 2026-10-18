// Minimal fixed-window in-memory rate limiter (single instance is enough for an MVP on Render).

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
  let hits = new Map();
  let windowStart = now();

  return function rateLimit(req, res, next) {
    const t = now();
    if (t - windowStart >= windowMs) {
      hits = new Map();
      windowStart = t;
    }
    const k = key(req);
    const count = (hits.get(k) ?? 0) + 1;
    hits.set(k, count);
    if (count > max) {
      res.setHeader('Retry-After', Math.ceil((windowStart + windowMs - t) / 1000));
      return res.status(status).json({ success: false, data: null, error: message });
    }
    return next();
  };
}

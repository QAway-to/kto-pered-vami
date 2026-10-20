// Auth building blocks: signed tokens (sessions and training tickets), bot login handshakes,
// channel-membership cache and trial counters. In-memory state is fine for one Render instance;
// a restart only drops pending logins, cached checks and trial counters.

import crypto from 'node:crypto';
import { isMemberStatus } from './telegram.js';

export const SESSION_TTL_MS = 30 * 24 * 3_600_000;
export const TICKET_TTL_MS = 2 * 3_600_000;
export const LOGIN_TTL_MS = 5 * 60_000;
export const TRIAL_LIMITS = Object.freeze({ profiling: 1, arena: 1 });

const randomToken = () => crypto.randomBytes(32).toString('base64url'); // 43 chars, fits a /start payload
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

/**
 * HMAC-signed tokens: `base64url(json).base64url(hmac)`. The `t` field separates token kinds,
 * so a training ticket can never be used as a session and vice versa.
 * @param {string} secret
 */
export function createSigner(secret) {
  const key = crypto.createHmac('sha256', 'kpv-signing-key').update(secret).digest();
  const mac = (body) => crypto.createHmac('sha256', key).update(body).digest();

  return {
    /** @param {Record<string, unknown> & {t: string, x: number}} payload */
    sign(payload) {
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      return `${body}.${mac(body).toString('base64url')}`;
    },
    /**
     * @param {unknown} token
     * @param {string} type
     * @param {number} [now]
     */
    verify(token, type, now = Date.now()) {
      if (typeof token !== 'string' || token.length > 2048) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [body, sig] = parts;
      const given = Buffer.from(sig, 'base64url');
      const expected = mac(body);
      if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
      let payload;
      try {
        payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      if (!payload || payload.t !== type || typeof payload.x !== 'number' || payload.x <= now) return null;
      return payload;
    },
  };
}

/** Session token for a Telegram user. */
export function issueSession(signer, user, now = Date.now()) {
  return signer.sign({ t: 'session', u: user.id, n: user.username, f: user.firstName, x: now + SESSION_TTL_MS });
}

/** @returns {{id: number, username: string|null, firstName: string}|null} */
export function readSession(signer, token, now = Date.now()) {
  const p = signer.verify(token, 'session', now);
  return p && Number.isSafeInteger(p.u) ? { id: p.u, username: p.n ?? null, firstName: p.f ?? '' } : null;
}

/** Ticket that lets one user continue one specific training (profiling dialog or arena run). */
export function issueTicket(signer, { userId, kind, ref }, now = Date.now()) {
  return signer.sign({ t: 'ticket', u: userId, k: kind, r: ref, x: now + TICKET_TTL_MS });
}

export function checkTicket(signer, token, { userId, kind, ref }, now = Date.now()) {
  const p = signer.verify(token, 'ticket', now);
  return Boolean(p && p.u === userId && p.k === kind && p.r === ref);
}

/**
 * Browser login through the bot: the site asks for a one-time token, the user opens the bot with it and
 * confirms by picking the two-digit code shown on the site (number matching makes a forwarded login link
 * useless for phishing). The site then claims the session with the nonce only it knows.
 */
export function createLoginStore({ ttlMs = LOGIN_TTL_MS, max = 20_000, perKey = 5, now = Date.now } = {}) {
  /** @type {Map<string, {nonce: Buffer, code: number, key: string, device: string, at: number, user: any}>} */
  const pending = new Map();

  const sweep = () => {
    const t = now();
    for (const [k, v] of pending) if (t - v.at > ttlMs) pending.delete(k);
  };
  const fresh = (token) => {
    if (typeof token !== 'string') return null;
    const e = pending.get(token);
    if (!e) return null;
    if (now() - e.at > ttlMs) {
      pending.delete(token);
      return null;
    }
    return e;
  };

  return {
    /**
     * @param {string} [key] - requester (IP) for the per-requester cap
     * @param {string} [device] - short browser/OS label shown in the bot
     * @returns {{token: string, nonce: string, code: number}|null} null when too many logins are pending
     */
    start(key = 'unknown', device = 'неизвестное устройство') {
      sweep();
      if (pending.size >= max) return null;
      let mine = 0;
      for (const v of pending.values()) if (v.key === key && !v.user) mine += 1;
      if (mine >= perKey) return null;
      const token = randomToken();
      const nonce = randomToken();
      const code = crypto.randomInt(10, 100);
      pending.set(token, { nonce: sha256(nonce), code, key, device, at: now(), user: null });
      return { token, nonce, code };
    },
    /** The code to match and the requesting device while the token waits for confirmation, else null. */
    pendingLogin(token) {
      const e = fresh(token);
      return e && !e.user ? { code: e.code, device: e.device } : null;
    },
    /**
     * Records who confirmed. A wrong code burns the token, so codes cannot be guessed.
     * @returns {'ok'|'wrong'|'expired'}
     */
    confirm(token, user, code) {
      const e = fresh(token);
      if (!e || e.user) return 'expired';
      if (code !== e.code) {
        pending.delete(token);
        return 'wrong';
      }
      e.user = user;
      return 'ok';
    },
    /**
     * @returns {{status: 'ok', user: any} | {status: 'pending'} | {status: 'expired'}}
     */
    claim(token, nonce) {
      const e = fresh(token);
      if (!e || typeof nonce !== 'string' || !crypto.timingSafeEqual(e.nonce, sha256(nonce))) return { status: 'expired' };
      if (!e.user) return { status: 'pending' };
      pending.delete(token); // one-time
      return { status: 'ok', user: e.user };
    },
  };
}

/** Channel membership via the bot, cached so every request does not hit Telegram. */
export function createMembership({
  bot, chatId, ttlMs = 5 * 60_000, negativeTtlMs = 60_000, freshEveryMs = 15_000, max = 20_000, now = Date.now, log = console,
}) {
  const cache = new Map();
  return {
    async isSubscriber(userId, { fresh = false } = {}) {
      const hit = cache.get(userId);
      // A forced re-check ("I joined, check again") is honoured at most every few seconds per user,
      // so it cannot be used to push the bot into Telegram's rate limits.
      const forced = fresh && (!hit || now() - hit.checkedAt >= freshEveryMs);
      if (!forced && hit && hit.until > now()) return hit.value;
      let value;
      try {
        value = isMemberStatus(await bot.getChatMember(chatId, userId));
      } catch (err) {
        log.error(`Membership check failed: ${err.message}`);
        value = hit?.value ?? false; // keep the last known answer through a Telegram hiccup
      }
      if (cache.size >= max) cache.clear();
      cache.set(userId, { value, checkedAt: now(), until: now() + (value ? ttlMs : negativeTtlMs) });
      return value;
    },
  };
}

/** Free tries per user for the AI trainings. */
export function createTrials({ limits = TRIAL_LIMITS, max = 50_000 } = {}) {
  const used = new Map();
  const get = (id) => used.get(id) ?? Object.fromEntries(Object.keys(limits).map((k) => [k, 0]));
  return {
    left(id) {
      const u = get(id);
      return Object.fromEntries(Object.entries(limits).map(([k, n]) => [k, Math.max(0, n - u[k])]));
    },
    consume(id, kind) {
      const u = get(id);
      if (!(kind in limits) || u[kind] >= limits[kind]) return false;
      if (used.size >= max && !used.has(id)) used.clear();
      used.set(id, { ...u, [kind]: u[kind] + 1 });
      return true;
    },
    refund(id, kind) {
      const u = get(id);
      if (u[kind] > 0) used.set(id, { ...u, [kind]: u[kind] - 1 });
    },
  };
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

/** Webhook secret derived from the session secret (Telegram allows A-Z a-z 0-9 _ -). */
export function deriveWebhookSecret(sessionSecret) {
  return crypto.createHmac('sha256', sessionSecret).update('telegram-webhook').digest('base64url');
}

/**
 * Short "browser, OS" label from a User-Agent, so the bot can say where a login request came from.
 * @param {unknown} ua
 */
export function deviceLabel(ua) {
  if (typeof ua !== 'string' || !ua) return 'неизвестное устройство';
  const browser = [['YaBrowser', 'Яндекс Браузер'], ['Edg/', 'Edge'], ['OPR/', 'Opera'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari']]
    .find(([needle]) => ua.includes(needle))?.[1] ?? 'браузер';
  const os = [['Android', 'Android'], ['iPhone', 'iPhone'], ['iPad', 'iPad'], ['Windows', 'Windows'], ['Mac OS X', 'macOS'], ['Linux', 'Linux']]
    .find(([needle]) => ua.includes(needle))?.[1];
  return os ? `${browser}, ${os}` : browser;
}

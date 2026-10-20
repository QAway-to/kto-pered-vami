// Telegram: Mini App initData verification and a minimal Bot API client.
// The bot token never appears in logs or error messages.

import crypto from 'node:crypto';

const MAX_INIT_DATA = 4096;

/**
 * Verifies Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * @param {unknown} initData - raw query string from Telegram.WebApp.initData
 * @param {string} botToken
 * @param {{maxAgeSec?: number, now?: () => number}} [opts]
 * @returns {{id: number, username: string|null, firstName: string}|null}
 */
export function verifyInitData(initData, botToken, { maxAgeSec = 86_400, now = Date.now } = {}) {
  if (typeof initData !== 'string' || initData.length === 0 || initData.length > MAX_INIT_DATA) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now() / 1000 - authDate > maxAgeSec) return null;

  let user;
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    return null;
  }
  return toUser(user);
}

/**
 * Normalises a Telegram user object.
 * @param {any} user
 * @returns {{id: number, username: string|null, firstName: string}|null}
 */
export function toUser(user) {
  if (!user || !Number.isSafeInteger(user.id) || user.is_bot === true) return null;
  const clean = (v, max) => (typeof v === 'string' ? v.slice(0, max) : null);
  return { id: user.id, username: clean(user.username, 64), firstName: clean(user.first_name, 128) ?? '' };
}

/** Telegram Bot API failure; `code` is Telegram's error_code (or HTTP status). */
export class TelegramError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TelegramError';
    this.code = code;
  }
}

/**
 * Minimal Bot API client.
 * @param {{token: string, fetchImpl?: typeof fetch, timeoutMs?: number}} options
 */
export function createBotApi({ token, fetchImpl = fetch, timeoutMs = 10_000 }) {
  async function call(method, payload = {}) {
    let res;
    try {
      res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new TelegramError(`${method}: network error (${err?.name ?? 'Error'})`, 0);
    }
    let data;
    try {
      data = await res.json();
    } catch {
      throw new TelegramError(`${method}: invalid response`, res.status);
    }
    if (!data?.ok) throw new TelegramError(`${method}: ${data?.description ?? 'error'}`, data?.error_code ?? res.status);
    return data.result;
  }

  return {
    getMe: () => call('getMe'),
    getChatMember: (chatId, userId) => call('getChatMember', { chat_id: chatId, user_id: userId }),
    sendMessage: (chatId, text, extra = {}) => call('sendMessage', { chat_id: chatId, text, ...extra }),
    answerCallbackQuery: (id, text) => call('answerCallbackQuery', { callback_query_id: id, text }),
    setWebhook: (url, secretToken) => call('setWebhook', {
      url, secret_token: secretToken, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
    }),
  };
}

/** True for a chat member who currently belongs to the chat. */
export function isMemberStatus(member) {
  const status = member?.status;
  return status === 'creator' || status === 'administrator' || status === 'member'
    || (status === 'restricted' && member.is_member === true);
}

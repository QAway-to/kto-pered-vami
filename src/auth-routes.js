// Telegram auth for the HTTP API: login routes, the bot webhook and the access gate for AI trainings.

import crypto from 'node:crypto';
import express from 'express';
import {
  createSigner, issueSession, readSession, issueTicket, checkTicket,
  createLoginStore, createMembership, createTrials, safeEqual, deriveWebhookSecret, deviceLabel, LOGIN_TTL_MS,
} from './auth.js';
import { verifyInitData, toUser } from './telegram.js';
import { createCounter, ipKey } from './rateLimit.js';

const ok = (data) => ({ success: true, data, error: null });
const fail = (error, code = null) => ({ success: false, data: null, error, code });

const LOGIN_PAYLOAD = /^\/start login_([A-Za-z0-9_-]{43})$/;
const LOGIN_CALLBACK = /^login:([A-Za-z0-9_-]{43}):(\d{2})$/;

/**
 * @typedef {{
 *   mode: 'telegram', bot: ReturnType<import('./telegram.js').createBotApi>, botToken: string, botUsername: string,
 *   chatId: string|number, channelUrl: string|null, sessionSecret: string, publicUrl: string|null, now?: () => number,
 * }} TelegramAuthConfig
 * @typedef {{mode: 'open'} | {mode: 'unavailable', reason: string} | TelegramAuthConfig} AuthConfig
 */

/**
 * Builds the auth runtime. `open` = no login (local dev and tests); `unavailable` = misconfigured, AI is closed.
 * @param {AuthConfig|null|undefined} config
 */
export function createAuth(config) {
  if (!config || config.mode === 'open') return { mode: 'open' };
  if (config.mode === 'unavailable') return { mode: 'unavailable', reason: config.reason };
  const now = config.now ?? Date.now;
  return {
    ...config,
    now,
    signer: createSigner(config.sessionSecret),
    logins: createLoginStore({ now }),
    membership: createMembership({ bot: config.bot, chatId: config.chatId, now }),
    trials: createTrials(),
    webhookSecret: deriveWebhookSecret(config.sessionSecret),
  };
}

/** Bearer session from the request, or null. */
function sessionUser(auth, req) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return token ? readSession(auth.signer, token, auth.now()) : null;
}

/**
 * Access gate for AI trainings. In `open` mode everything is allowed without tickets.
 * `start` checks subscription or spends a trial and issues a ticket; `resume` requires that ticket.
 */
export function createGate(auth, { perUser = { windowMs: 10 * 60_000, max: 80 } } = {}) {
  const deny = (res, status, message, code) => res.status(status).json(fail(message, code));
  // Per-account cap on AI calls (one experiment is 11 calls), on top of the per-IP and global limits.
  const userCalls = createCounter(perUser);

  async function identify(req, res) {
    if (auth.mode === 'open') return { open: true };
    if (auth.mode === 'unavailable') {
      deny(res, 503, 'Вход временно недоступен. Тест и флаги работают.', 'auth_unavailable');
      return null;
    }
    const user = sessionUser(auth, req);
    if (!user) {
      deny(res, 401, 'Войдите через Telegram, чтобы продолжить.', 'auth_required');
      return null;
    }
    if (!userCalls.take(user.id)) {
      res.setHeader('Retry-After', userCalls.retryAfter());
      deny(res, 429, 'Слишком много тренировок подряд. Сделайте паузу на несколько минут.', 'user_rate_limited');
      return null;
    }
    return { user };
  }

  return {
    /**
     * @returns {Promise<{ticket: string|null, refund: () => void}|null>} null = response already sent
     */
    async start(req, res, kind, ref) {
      const who = await identify(req, res);
      if (!who) return null;
      if (who.open) return { ticket: null, refund: () => {} };
      const { user } = who;
      const subscriber = await auth.membership.isSubscriber(user.id);
      let trial = false;
      if (!subscriber) {
        if (!auth.trials.consume(user.id, kind)) {
          deny(res, 402, 'Пробный доступ закончился. Полный доступ — для участников канала.', 'subscription_required');
          return null;
        }
        trial = true;
      }
      return {
        ticket: issueTicket(auth.signer, { userId: user.id, kind, ref }, auth.now()),
        refund: () => { if (trial) auth.trials.refund(user.id, kind); },
      };
    },
    /** @returns {Promise<boolean>} false = response already sent */
    async resume(req, res, kind, ref, ticket) {
      const who = await identify(req, res);
      if (!who) return false;
      if (who.open) return true;
      if (!checkTicket(auth.signer, ticket, { userId: who.user.id, kind, ref }, auth.now())) {
        deny(res, 403, 'Тренировка устарела. Начните заново.', 'ticket_invalid');
        return false;
      }
      return true;
    },
  };
}

/** Public auth settings for the browser. */
export function publicAuthConfig(auth) {
  if (auth.mode !== 'telegram') return { authMode: auth.mode, botUsername: null, channelUrl: null };
  return { authMode: 'telegram', botUsername: auth.botUsername, channelUrl: auth.channelUrl };
}

/**
 * /api/auth/*, /api/me and /api/config. Mounted inside the rate-limited, JSON-parsing API router.
 * @param {ReturnType<typeof createAuth>} auth
 */
export function authRouter(auth) {
  const r = express.Router();

  r.get('/config', (req, res) => res.json(ok(publicAuthConfig(auth))));

  r.use(['/auth', '/me'], (req, res, next) => {
    if (auth.mode === 'telegram') return next();
    return res.status(404).json(fail('Вход не настроен', 'auth_off'));
  });

  r.post('/auth/telegram', (req, res) => {
    const user = verifyInitData(req.body?.initData, auth.botToken, { now: auth.now });
    if (!user) return res.status(401).json(fail('Не удалось подтвердить вход из Telegram', 'init_data_invalid'));
    return res.json(ok({ token: issueSession(auth.signer, user, auth.now()), user }));
  });

  r.post('/auth/bot/start', (req, res) => {
    const started = auth.logins.start(ipKey(req.ip), deviceLabel(req.get('user-agent')));
    if (!started) return res.status(503).json(fail('Слишком много входов одновременно. Попробуйте через минуту.'));
    return res.json(ok({
      token: started.token,
      nonce: started.nonce,
      code: started.code,
      link: `https://t.me/${auth.botUsername}?start=login_${started.token}`,
      expiresIn: Math.floor(LOGIN_TTL_MS / 1000),
    }));
  });

  r.post('/auth/bot/claim', (req, res) => {
    const result = auth.logins.claim(req.body?.token, req.body?.nonce);
    if (result.status === 'pending') return res.status(202).json(ok({ pending: true }));
    if (result.status === 'expired') return res.status(410).json(fail('Ссылка для входа устарела. Начните заново.', 'login_expired'));
    return res.json(ok({ token: issueSession(auth.signer, result.user, auth.now()), user: result.user }));
  });

  r.get('/me', async (req, res) => {
    const user = sessionUser(auth, req);
    if (!user) return res.status(401).json(fail('Войдите через Telegram', 'auth_required'));
    const subscriber = await auth.membership.isSubscriber(user.id, { fresh: req.query.fresh === '1' });
    return res.json(ok({ user, subscriber, trial: auth.trials.left(user.id), channelUrl: auth.channelUrl }));
  });

  return r;
}

/** Rejects webhook calls without Telegram's secret header before the body is parsed. */
export function webhookGuard(auth) {
  return (req, res, next) => {
    if (auth.mode !== 'telegram') return res.status(404).end();
    if (!safeEqual(req.get('x-telegram-bot-api-secret-token'), auth.webhookSecret)) return res.status(401).end();
    return next();
  };
}

/**
 * Bot webhook handler, mounted after `webhookGuard` and outside the API rate limiter.
 * Always answers 200 quickly so Telegram does not retry.
 * @param {ReturnType<typeof createAuth>} auth
 * @param {{log?: Console}} [opts]
 */
export function telegramWebhook(auth, { log = console } = {}) {
  return async (req, res) => {
    if (auth.mode !== 'telegram') return res.status(404).end();
    res.status(200).end();
    try {
      await handleUpdate(auth, req.body ?? {});
    } catch (err) {
      log.error(`Telegram update failed: ${err.message}`);
    }
  };
}

async function handleUpdate(auth, update) {
  const { bot } = auth;
  const msg = update.message;
  if (msg && msg.chat?.type === 'private' && typeof msg.text === 'string') {
    const login = msg.text.match(LOGIN_PAYLOAD);
    if (login) {
      const pendingLogin = auth.logins.pendingLogin(login[1]);
      if (pendingLogin === null) {
        await bot.sendMessage(msg.chat.id, 'Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти» ещё раз.');
        return;
      }
      const buttons = codeChoices(pendingLogin.code).map((c) => ({ text: String(c), callback_data: `login:${login[1]}:${c}` }));
      await bot.sendMessage(
        msg.chat.id,
        `Вход в «Кто перед вами» под вашим Telegram-аккаунтом.\nУстройство: ${pendingLogin.device}.\n\nНажмите код, который сейчас показан на сайте на этом устройстве. Если вы не нажимали «Войти» сами или вам прислали код другие люди — ничего не нажимайте: кто-то пытается войти под вашим аккаунтом.`,
        { reply_markup: { inline_keyboard: [buttons] } },
      );
      return;
    }
    if (msg.text.startsWith('/start')) {
      const button = auth.publicUrl ? { reply_markup: { inline_keyboard: [[{ text: 'Открыть «Кто перед вами»', web_app: { url: auth.publicUrl } }]] } } : {};
      await bot.sendMessage(msg.chat.id, 'Тренажёр, который учит понимать, кто перед вами: архетипы, флаги манипуляций, профайлинг и арена.', button);
    }
    return;
  }

  const cb = update.callback_query;
  if (cb && typeof cb.data === 'string') {
    const login = cb.data.match(LOGIN_CALLBACK);
    if (!login) return;
    // Only the person in whose private chat the prompt appeared can confirm it.
    const user = toUser(cb.from);
    const sameChat = cb.message?.chat?.type === 'private' && cb.message.chat.id === cb.from?.id;
    const result = user && sameChat ? auth.logins.confirm(login[1], user, Number(login[2])) : 'expired';
    const answers = { ok: 'Вход подтверждён', wrong: 'Код не совпал — вход отменён', expired: 'Ссылка устарела' };
    await bot.answerCallbackQuery(cb.id, answers[result]);
    if (result === 'ok') await bot.sendMessage(cb.from.id, 'Готово. Вернитесь на сайт — вход выполнен.');
    if (result === 'wrong') await bot.sendMessage(cb.from.id, 'Код не совпал, вход отменён. Если это были вы — начните вход на сайте заново.');
  }
}

/** The real code plus two different decoys, in uniformly random order (Fisher–Yates). */
function codeChoices(code) {
  const set = new Set([code]);
  while (set.size < 3) set.add(crypto.randomInt(10, 100));
  const list = [...set];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

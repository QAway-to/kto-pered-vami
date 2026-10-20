import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { verifyInitData, isMemberStatus, createBotApi, TelegramError } from '../src/telegram.js';
import {
  createSigner, issueSession, readSession, issueTicket, checkTicket,
  createLoginStore, createMembership, createTrials, deriveWebhookSecret,
} from '../src/auth.js';

const BOT_TOKEN = '123456:TEST-token';
const SECRET = 'x'.repeat(40);
const NOW = 1_800_000_000_000;

/** Builds initData signed the way Telegram does. */
function signInitData(user, { token = BOT_TOKEN, authDate = Math.floor(NOW / 1000) } = {}) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify(user) });
  const dcs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

const alice = { id: 111, username: 'alice', first_name: 'Алиса' };
const bob = { id: 222, username: 'bob', first_name: 'Боб' };

/** Fake bot: members are the ids in `members`; every call is recorded. */
function fakeBot(members = new Set([alice.id])) {
  const calls = [];
  return {
    calls,
    getMe: async () => ({ username: 'kto_bot' }),
    getChatMember: async (chatId, userId) => { calls.push(['getChatMember', userId]); return { status: members.has(userId) ? 'member' : 'left' }; },
    sendMessage: async (chatId, text, extra) => { calls.push(['sendMessage', chatId, text, extra]); return {}; },
    answerCallbackQuery: async (id, text) => { calls.push(['answerCallbackQuery', text]); return true; },
  };
}

function fakeLlm(reply = 'Привет.') {
  return { name: 'fake', model: 'fake', complete: async () => (typeof reply === 'function' ? reply() : reply) };
}

function telegramApp({ bot = fakeBot(), llm = fakeLlm() } = {}) {
  const app = createApp({
    llm,
    rateLimit: { windowMs: 60_000, max: 1000 },
    labRateLimit: { windowMs: 60_000, max: 1000 },
    auth: { mode: 'telegram', bot, botToken: BOT_TOKEN, botUsername: 'kto_bot', chatId: -100123, channelUrl: 'https://t.me/+invite', sessionSecret: SECRET, publicUrl: 'https://kto.example', now: () => NOW },
  });
  return { app, bot };
}

async function login(app, user = alice) {
  const res = await request(app).post('/api/auth/telegram').send({ initData: signInitData(user) }).expect(200);
  return res.body.data.token;
}

const scene = { scenario: 'first-meeting', intro: 0 };
const opening = (personaId = 'secure') => ({ ...scene, personaId, messages: [] });

/* ---------- unit ---------- */

test('verifyInitData accepts a genuine payload and rejects tampering, wrong bot and stale data', () => {
  const good = signInitData(alice);
  assert.deepEqual(verifyInitData(good, BOT_TOKEN, { now: () => NOW }), { id: 111, username: 'alice', firstName: 'Алиса' });
  assert.equal(verifyInitData(good.replace('alice', 'mallory'), BOT_TOKEN, { now: () => NOW }), null);
  assert.equal(verifyInitData(signInitData(alice, { token: '999:other' }), BOT_TOKEN, { now: () => NOW }), null);
  assert.equal(verifyInitData(good, BOT_TOKEN, { now: () => NOW + 2 * 86_400_000 }), null);
  for (const bad of [undefined, '', 'hash=zz', 'a'.repeat(5000), signInitData({ id: 'x' })]) {
    assert.equal(verifyInitData(bad, BOT_TOKEN, { now: () => NOW }), null);
  }
  assert.equal(verifyInitData(signInitData({ id: 5, is_bot: true }), BOT_TOKEN, { now: () => NOW }), null);
});

test('signed tokens: round trip, kind separation, tampering and expiry', () => {
  const s = createSigner(SECRET);
  const session = issueSession(s, { id: 1, username: 'a', firstName: 'A' }, NOW);
  assert.deepEqual(readSession(s, session, NOW), { id: 1, username: 'a', firstName: 'A' });
  assert.equal(readSession(s, session, NOW + 31 * 86_400_000), null);
  assert.equal(readSession(createSigner('y'.repeat(40)), session, NOW), null);
  const [body, sig] = session.split('.');
  const forged = Buffer.from(JSON.stringify({ t: 'session', u: 2, x: NOW + 1e9 })).toString('base64url');
  assert.equal(readSession(s, `${forged}.${sig}`, NOW), null);
  assert.equal(readSession(s, `${body}.${sig}.x`, NOW), null);
  const ticket = issueTicket(s, { userId: 1, kind: 'arena', ref: 'r' }, NOW);
  assert.equal(readSession(s, ticket, NOW), null, 'a ticket is not a session');
  assert.equal(checkTicket(s, session, { userId: 1, kind: 'arena', ref: 'r' }, NOW), false, 'a session is not a ticket');
  assert.equal(checkTicket(s, ticket, { userId: 1, kind: 'arena', ref: 'r' }, NOW), true);
  assert.equal(checkTicket(s, ticket, { userId: 2, kind: 'arena', ref: 'r' }, NOW), false);
  assert.equal(checkTicket(s, ticket, { userId: 1, kind: 'profiling', ref: 'r' }, NOW), false);
  assert.equal(checkTicket(s, ticket, { userId: 1, kind: 'arena', ref: 'other' }, NOW), false);
});

test('login store: code matching, one-time claim, per-requester cap, expiry', () => {
  let t = NOW;
  const store = createLoginStore({ now: () => t, ttlMs: 1000, max: 10, perKey: 2 });
  const { token, nonce, code } = store.start('1.1.1.1');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(code >= 10 && code <= 99);
  assert.equal(store.pendingLogin(token).code, code);
  assert.deepEqual(store.claim(token, nonce), { status: 'pending' });
  assert.deepEqual(store.claim(token, 'wrong'), { status: 'expired' });
  assert.equal(store.confirm(token, { id: 1 }, code), 'ok');
  assert.equal(store.confirm(token, { id: 2 }, code), 'expired', 'first confirmation wins');
  assert.deepEqual(store.claim(token, nonce), { status: 'ok', user: { id: 1 } });
  assert.deepEqual(store.claim(token, nonce), { status: 'expired' }, 'one-time');

  const guessed = store.start('1.1.1.1');
  assert.equal(store.confirm(guessed.token, { id: 1 }, guessed.code === 10 ? 11 : 10), 'wrong');
  assert.equal(store.pendingLogin(guessed.token), null, 'a wrong code burns the token');

  store.start('2.2.2.2');
  store.start('2.2.2.2');
  assert.equal(store.start('2.2.2.2'), null, 'per-requester cap');
  assert.ok(store.start('3.3.3.3'), 'other requesters are unaffected');
  t += 1001;
  assert.ok(store.start('2.2.2.2'), 'expired entries are swept');
});

test('membership: statuses, caching, forced refresh and Telegram errors', async () => {
  assert.equal(isMemberStatus({ status: 'creator' }), true);
  assert.equal(isMemberStatus({ status: 'restricted', is_member: true }), true);
  assert.equal(isMemberStatus({ status: 'restricted', is_member: false }), false);
  assert.equal(isMemberStatus({ status: 'kicked' }), false);
  let t = NOW;
  let status = 'member';
  let fail = false;
  let calls = 0;
  const bot = { getChatMember: async () => { calls += 1; if (fail) throw new Error('down'); return { status }; } };
  const m = createMembership({ bot, chatId: 1, now: () => t, log: { error() {} } });
  assert.equal(await m.isSubscriber(1), true);
  status = 'left';
  assert.equal(await m.isSubscriber(1), true, 'cached');
  assert.equal(await m.isSubscriber(1, { fresh: true }), true, 'forced re-checks are throttled');
  t += 15_000;
  assert.equal(await m.isSubscriber(1, { fresh: true }), false);
  status = 'member';
  fail = true;
  t += 120_000;
  assert.equal(await m.isSubscriber(1), false, 'keeps last known answer on errors');
  assert.equal(calls, 3);
  t += 1;
  for (let i = 0; i < 5; i += 1) await m.isSubscriber(1, { fresh: true });
  assert.equal(calls, 3, 'hammering fresh=1 does not reach Telegram');
});

test('trials: one free try per kind, refundable', () => {
  const trials = createTrials();
  assert.deepEqual(trials.left(1), { profiling: 1, arena: 1 });
  assert.equal(trials.consume(1, 'profiling'), true);
  assert.equal(trials.consume(1, 'profiling'), false);
  trials.refund(1, 'profiling');
  assert.equal(trials.consume(1, 'profiling'), true);
  assert.equal(trials.consume(1, 'unknown'), false);
  assert.deepEqual(trials.left(1), { profiling: 0, arena: 1 });
});

test('bot client never leaks the token in errors', async () => {
  const bot = createBotApi({ token: BOT_TOKEN, fetchImpl: async () => new Response(JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: chat not found' })) });
  await assert.rejects(bot.getChatMember(1, 2), (e) => e instanceof TelegramError && e.code === 400 && !e.message.includes(BOT_TOKEN));
  const down = createBotApi({ token: BOT_TOKEN, fetchImpl: async () => { throw new Error(`fetch https://api.telegram.org/bot${BOT_TOKEN}`); } });
  await assert.rejects(down.getMe(), (e) => !e.message.includes(BOT_TOKEN));
});

/* ---------- HTTP ---------- */

test('config, Mini App login and /me', async () => {
  const { app } = telegramApp();
  const cfg = await request(app).get('/api/config').expect(200);
  assert.deepEqual(cfg.body.data, { authMode: 'telegram', botUsername: 'kto_bot', channelUrl: 'https://t.me/+invite' });
  await request(app).post('/api/auth/telegram').send({ initData: 'hash=00' }).expect(401);
  const token = await login(app);
  const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(me.body.data.user.username, 'alice');
  assert.equal(me.body.data.subscriber, true);
  await request(app).get('/api/me').expect(401);
  await request(app).get('/api/me').set('Authorization', 'Bearer junk').expect(401);
});

test('AI trainings need a session', async () => {
  const { app } = telegramApp();
  const res = await request(app).post('/api/chat').send(opening()).expect(401);
  assert.equal(res.body.code, 'auth_required');
  await request(app).post('/api/lab/turn').send({ a: 'secure', b: 'hsp', ...scene, transcript: [] }).expect(401);
});

test('subscriber: profiling start issues a ticket that continuing and debrief require', async () => {
  const { app } = telegramApp();
  const auth = `Bearer ${await login(app)}`;
  const start = await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(200);
  const { ticket } = start.body.data;
  assert.ok(ticket);
  const messages = [{ role: 'assistant', content: 'Привет.' }, { role: 'user', content: 'Привет!' }];
  await request(app).post('/api/chat').set('Authorization', auth).send({ ...scene, personaId: 'secure', messages }).expect(403);
  await request(app).post('/api/chat').set('Authorization', auth).send({ ...scene, personaId: 'secure', messages, ticket }).expect(200);
  await request(app).post('/api/chat').set('Authorization', auth).send({ ...scene, personaId: 'hsp', messages, ticket }).expect(403);
  await request(app).post('/api/debrief').set('Authorization', auth).send({ ...scene, personaId: 'secure', messages, guess: 'secure', ticket }).expect(200);
  await request(app).post('/api/debrief').set('Authorization', auth).send({ ...scene, personaId: 'secure', messages, guess: 'secure' }).expect(403);
});

test('a ticket belongs to its user', async () => {
  const { app } = telegramApp({ bot: fakeBot(new Set([alice.id, bob.id])) });
  const aliceAuth = `Bearer ${await login(app, alice)}`;
  const bobAuth = `Bearer ${await login(app, bob)}`;
  const { ticket } = (await request(app).post('/api/chat').set('Authorization', aliceAuth).send(opening()).expect(200)).body.data;
  const messages = [{ role: 'assistant', content: 'Привет.' }, { role: 'user', content: 'Привет!' }];
  await request(app).post('/api/chat').set('Authorization', bobAuth).send({ ...scene, personaId: 'secure', messages, ticket }).expect(403);
});

test('non-subscriber gets one free profiling and one free arena, then 402', async () => {
  const { app } = telegramApp();
  const auth = `Bearer ${await login(app, bob)}`;
  await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(200);
  const second = await request(app).post('/api/chat').set('Authorization', auth).send(opening('hsp')).expect(402);
  assert.equal(second.body.code, 'subscription_required');
  const arena = { a: 'secure', b: 'hsp', ...scene, transcript: [] };
  const first = await request(app).post('/api/lab/turn').set('Authorization', auth).send(arena).expect(200);
  assert.ok(first.body.data.ticket);
  await request(app).post('/api/lab/turn').set('Authorization', auth).send(arena).expect(402);
  const me = await request(app).get('/api/me').set('Authorization', auth).expect(200);
  assert.deepEqual(me.body.data.trial, { profiling: 0, arena: 0 });
  assert.equal(me.body.data.subscriber, false);
});

test('a failed AI opening line refunds the free try', async () => {
  let failing = true;
  const llm = fakeLlm(() => { if (failing) { const { LlmError } = llmModule; throw new LlmError('down', 500); } return 'ok'; });
  const { app } = telegramApp({ llm });
  const auth = `Bearer ${await login(app, bob)}`;
  await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(502);
  failing = false;
  await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(200);
});
const llmModule = await import('../src/llm.js');

test('arena verdict requires the run ticket', async () => {
  const { app } = telegramApp({ llm: fakeLlm('{"winner":"a","outcome":"continue","scoreA":6,"scoreB":4,"title":"t"}') });
  const auth = `Bearer ${await login(app)}`;
  const base = { a: 'secure', b: 'hsp', ...scene };
  const { ticket } = (await request(app).post('/api/lab/turn').set('Authorization', auth).send({ ...base, transcript: [] }).expect(200)).body.data;
  const transcript = Array.from({ length: 10 }, (_, i) => ({ speaker: i % 2 ? 'b' : 'a', text: `line ${i}` }));
  await request(app).post('/api/lab/verdict').set('Authorization', auth).send({ ...base, transcript }).expect(403);
  await request(app).post('/api/lab/verdict').set('Authorization', auth).send({ ...base, transcript, ticket }).expect(200);
});

test('browser login through the bot: code matching in the private chat, claim once', async () => {
  const { app, bot } = telegramApp();
  const secret = deriveWebhookSecret(SECRET);
  const hook = (body) => request(app).post('/api/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', secret).send(body).expect(200)
    .then(() => new Promise((r) => setImmediate(r)));
  const { token, nonce, code, link } = (await request(app).post('/api/auth/bot/start')
    .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36').expect(200)).body.data;
  assert.equal(link, `https://t.me/kto_bot?start=login_${token}`);
  await request(app).post('/api/auth/bot/claim').send({ token, nonce }).expect(202);

  await hook({ message: { chat: { id: alice.id, type: 'private' }, from: alice, text: `/start login_${token}` } });
  const prompt = bot.calls.find((c) => c[0] === 'sendMessage');
  const buttons = prompt[3].reply_markup.inline_keyboard[0];
  assert.equal(buttons.length, 3);
  assert.match(prompt[2], /Устройство: Chrome, Windows/);
  assert.ok(buttons.some((b) => b.callback_data === `login:${token}:${code}`), 'the real code is offered');
  assert.equal(new Set(buttons.map((b) => b.text)).size, 3, 'decoys differ');

  // A callback from someone else's chat must not confirm.
  await hook({ callback_query: { id: 'cb0', from: bob, data: `login:${token}:${code}`, message: { chat: { id: alice.id, type: 'private' } } } });
  await request(app).post('/api/auth/bot/claim').send({ token, nonce }).expect(202);

  await hook({ callback_query: { id: 'cb1', from: alice, data: `login:${token}:${code}`, message: { chat: { id: alice.id, type: 'private' } } } });
  await request(app).post('/api/auth/bot/claim').send({ token, nonce: 'stolen' }).expect(410);
  const claimed = await request(app).post('/api/auth/bot/claim').send({ token, nonce }).expect(200);
  assert.equal(claimed.body.data.user.username, 'alice');
  await request(app).post('/api/auth/bot/claim').send({ token, nonce }).expect(410);
  const me = await request(app).get('/api/me').set('Authorization', `Bearer ${claimed.body.data.token}`).expect(200);
  assert.equal(me.body.data.user.id, alice.id);
});

test('picking a wrong code in the bot cancels the login', async () => {
  const { app } = telegramApp();
  const secret = deriveWebhookSecret(SECRET);
  const { token, nonce, code } = (await request(app).post('/api/auth/bot/start').expect(200)).body.data;
  const wrong = code === 10 ? 11 : 10;
  await request(app).post('/api/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', secret)
    .send({ callback_query: { id: 'cb', from: alice, data: `login:${token}:${wrong}`, message: { chat: { id: alice.id, type: 'private' } } } }).expect(200);
  await new Promise((r) => setImmediate(r));
  await request(app).post('/api/auth/bot/claim').send({ token, nonce }).expect(410);
});

test('webhook rejects a missing secret before parsing the body', async () => {
  const { app } = telegramApp();
  await request(app).post('/api/telegram/webhook').set('Content-Type', 'application/json').send('{not json').expect(401);
});

test('anonymous and rejected requests do not spend the global AI budget', async () => {
  const app = createApp({
    llm: fakeLlm(),
    aiCallsPerHour: 1,
    rateLimit: { windowMs: 60_000, max: 1000 },
    auth: { mode: 'telegram', bot: fakeBot(), botToken: BOT_TOKEN, botUsername: 'kto_bot', chatId: -1, channelUrl: null, sessionSecret: SECRET, publicUrl: null, now: () => NOW },
  });
  for (let i = 0; i < 5; i += 1) await request(app).post('/api/chat').send(opening()).expect(401);
  const auth = `Bearer ${await login(app)}`;
  await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(200);
  await request(app).post('/api/chat').set('Authorization', auth).send(opening()).expect(503);
});

test('misconfigured auth keeps AI closed; open mode needs no login', async () => {
  const closed = createApp({ llm: fakeLlm(), auth: { mode: 'unavailable', reason: 'x' } });
  const res = await request(closed).post('/api/chat').send(opening()).expect(503);
  assert.equal(res.body.code, 'auth_unavailable');
  assert.equal((await request(closed).get('/api/config').expect(200)).body.data.authMode, 'unavailable');
  await request(closed).post('/api/auth/bot/start').expect(404);
  const open = createApp({ llm: fakeLlm() });
  const opened = await request(open).post('/api/chat').send(opening()).expect(200);
  assert.equal(opened.body.data.ticket, undefined);
});

test('deviceLabel names common browsers and systems', async () => {
  const { deviceLabel } = await import('../src/auth.js');
  assert.equal(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1'), 'Safari, iPhone');
  assert.equal(deviceLabel('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36 YaBrowser/24.1'), 'Яндекс Браузер, Android');
  assert.equal(deviceLabel(undefined), 'неизвестное устройство');
});

test('bot tells the admin the chat ID when added to a channel', async () => {
  const { app, bot } = telegramApp();
  const secret = deriveWebhookSecret(SECRET);
  await request(app).post('/api/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', secret).send({
    my_chat_member: {
      chat: { id: -1001234567890, type: 'channel', title: 'Sadovsky Club' },
      from: alice,
      new_chat_member: { status: 'administrator', user: { id: 1, is_bot: true } },
    },
  }).expect(200);
  await new Promise((r) => setImmediate(r));
  const dm = bot.calls.find((c) => c[0] === 'sendMessage');
  assert.equal(dm[1], alice.id);
  assert.match(dm[2], /-1001234567890/);
  assert.match(dm[2], /TELEGRAM_CHAT_ID/);
});

test('/chatid in a group replies with the chat ID', async () => {
  const { app, bot } = telegramApp();
  await request(app).post('/api/telegram/webhook').set('X-Telegram-Bot-Api-Secret-Token', deriveWebhookSecret(SECRET)).send({
    message: { chat: { id: -1009876543210, type: 'supergroup', title: 'Club' }, from: alice, text: '/chatid@kto_bot' },
  }).expect(200);
  await new Promise((r) => setImmediate(r));
  const reply = bot.calls.find((c) => c[0] === 'sendMessage');
  assert.equal(reply[1], -1009876543210);
  assert.match(reply[2], /-1009876543210/);
});

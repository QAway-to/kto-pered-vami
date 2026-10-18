import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PERSONAS } from '../src/personas.js';
import {
  createDeepSeekProvider, createProviderFromEnv, LlmError, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL,
} from '../src/llm.js';

function fakeFetch(respond) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return respond(url, init);
  };
  return { calls, impl };
}

const jsonResponse = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const completion = (content, finish = 'stop') => jsonResponse(200, { choices: [{ message: { role: 'assistant', content, reasoning_content: 'hidden' }, finish_reason: finish }] });
const params = (mode) => ({ system: 'SYS', messages: [{ role: 'user', content: 'hi' }], mode, maxTokens: 100 });

test('DeepSeek chat mode: no thinking, system first, bearer auth, returns content only', async () => {
  const f = fakeFetch(() => completion('  Привет  '));
  const llm = createDeepSeekProvider({ apiKey: 'k', fetchImpl: f.impl });
  assert.equal(await llm.complete(params('chat')), 'Привет');
  const [call] = f.calls;
  assert.equal(call.url, `${DEEPSEEK_BASE_URL}/chat/completions`);
  assert.equal(call.init.headers.Authorization, 'Bearer k');
  assert.equal(call.body.model, DEEPSEEK_MODEL);
  assert.deepEqual(call.body.thinking, { type: 'disabled' });
  assert.deepEqual(call.body.messages[0], { role: 'system', content: 'SYS' });
  assert.equal(call.body.max_tokens, 100);
});

test('DeepSeek analysis mode enables thinking', async () => {
  const f = fakeFetch(() => completion('Разбор'));
  const llm = createDeepSeekProvider({ apiKey: 'k', fetchImpl: f.impl });
  await llm.complete(params('analysis'));
  assert.deepEqual(f.calls[0].body.thinking, { type: 'enabled' });
  assert.equal(f.calls[0].body.reasoning_effort, 'high');
});

test('DeepSeek returns null on content filter or empty reply', async () => {
  const filtered = createDeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch(() => completion('x', 'content_filter')).impl });
  assert.equal(await filtered.complete(params('chat')), null);
  const empty = createDeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch(() => jsonResponse(200, { choices: [] })).impl });
  assert.equal(await empty.complete(params('chat')), null);
});

test('DeepSeek errors become LlmError with status', async () => {
  const http = createDeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch(() => jsonResponse(429, { error: 'busy' })).impl });
  await assert.rejects(http.complete(params('chat')), (e) => e instanceof LlmError && e.status === 429);
  const net = createDeepSeekProvider({ apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(net.complete(params('chat')), (e) => e instanceof LlmError && e.status === 0);
  const bad = createDeepSeekProvider({ apiKey: 'k', fetchImpl: async () => new Response('not json', { status: 200 }) });
  await assert.rejects(bad.complete(params('chat')), (e) => e instanceof LlmError);
});

test('createProviderFromEnv picks provider by AI_PROVIDER or available key', () => {
  const pick = (env) => createProviderFromEnv(env).llm?.name ?? null;
  assert.equal(pick({}), null);
  assert.equal(pick({ DEEPSEEK_API_KEY: 'd' }), 'deepseek');
  assert.equal(pick({ ANTHROPIC_API_KEY: 'a' }), 'anthropic');
  assert.equal(pick({ DEEPSEEK_API_KEY: 'd', ANTHROPIC_API_KEY: 'a' }), 'deepseek');
  assert.equal(pick({ AI_PROVIDER: ' Anthropic ', DEEPSEEK_API_KEY: 'd', ANTHROPIC_API_KEY: 'a' }), 'anthropic');
});

test('createProviderFromEnv explains why no provider was created', () => {
  assert.match(createProviderFromEnv({}).reason, /No AI key/);
  assert.match(createProviderFromEnv({ AI_PROVIDER: 'deepseek', ANTHROPIC_API_KEY: 'a' }).reason, /DEEPSEEK_API_KEY is not set/);
  assert.match(createProviderFromEnv({ AI_PROVIDER: 'anthropic', DEEPSEEK_API_KEY: 'd' }).reason, /ANTHROPIC_API_KEY is not set/);
  assert.match(createProviderFromEnv({ AI_PROVIDER: 'gpt', DEEPSEEK_API_KEY: 'd' }).reason, /Unknown AI_PROVIDER "gpt"/);
});

test('DeepSeek body-read timeout is reported as a network failure', async () => {
  const slow = { ok: true, status: 200, json: async () => { throw new DOMException('timed out', 'TimeoutError'); } };
  const llm = createDeepSeekProvider({ apiKey: 'k', fetchImpl: async () => slow });
  await assert.rejects(llm.complete(params('analysis')), (e) => e instanceof LlmError && e.status === 0);
});

test('end to end: /api/chat via DeepSeek, upstream 429 maps to 503', async () => {
  const transcript = [{ role: 'assistant', content: PERSONAS.robot.opening }, { role: 'user', content: 'Проект на 2 недели' }];
  const okApp = createApp({ llm: createDeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch(() => completion('Какие сроки?')).impl }) });
  const res = await request(okApp).post('/api/chat').send({ personaId: 'robot', messages: transcript }).expect(200);
  assert.equal(res.body.data.reply, 'Какие сроки?');
  const busyApp = createApp({ llm: createDeepSeekProvider({ apiKey: 'k', fetchImpl: fakeFetch(() => jsonResponse(429, {})).impl }) });
  await request(busyApp).post('/api/chat').send({ personaId: 'robot', messages: transcript }).expect(503);
});

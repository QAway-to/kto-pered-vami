import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createAnalytics, validateTrack } from '../src/analytics.js';

const ID = 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff';

function fakeAnalytics() {
  const captured = [];
  return { captured, capture: async (e) => { captured.push(e); } };
}

test('validateTrack accepts a known event and keeps only whitelisted primitive props', () => {
  const r = validateTrack({
    event: 'spar_completed',
    distinctId: ID,
    props: { correct: true, turns: 4, archetype: 'psychopath', transcript: 'secret text', nested: { x: 1 }, scenario: 'x'.repeat(200) },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value.props).sort(), ['archetype', 'correct', 'scenario', 'turns']);
  assert.equal(r.value.props.scenario.length, 64);
});

test('validateTrack drops attribution values outside the slug alphabet', () => {
  const r = validateTrack({ event: 'app_opened', distinctId: ID, props: { source: 'tik tok<script>', campaign: 'reels_1', medium: 42 } });
  assert.deepEqual(r.value.props, { campaign: 'reels_1' });
});

test('validateTrack rejects unknown events, bad ids and non-object props', () => {
  assert.equal(validateTrack({ event: 'hack', distinctId: ID }).ok, false);
  assert.equal(validateTrack({ event: 'app_opened', distinctId: 'short' }).ok, false);
  assert.equal(validateTrack({ event: 'app_opened', distinctId: '<script>alert(1)</script>' }).ok, false);
  assert.equal(validateTrack({ event: 'app_opened', distinctId: ID, props: [1, 2] }).ok, false);
  assert.equal(validateTrack(null).ok, false);
});

test('POST /api/track forwards a valid event and answers 204, even without an LLM', async () => {
  const analytics = fakeAnalytics();
  const app = createApp({ llm: null, analytics });
  await request(app).post('/api/track').send({ event: 'test_completed', distinctId: ID, props: { archetype: 'secure' } }).expect(204);
  assert.equal(analytics.captured.length, 1);
  assert.equal(analytics.captured[0].event, 'test_completed');
  assert.deepEqual(analytics.captured[0].props, { archetype: 'secure' });
});

test('POST /api/track rejects invalid events and is a no-op without analytics', async () => {
  const analytics = fakeAnalytics();
  await request(createApp({ llm: null, analytics })).post('/api/track').send({ event: 'nope', distinctId: ID }).expect(400);
  assert.equal(analytics.captured.length, 0);
  await request(createApp({ llm: null })).post('/api/track').send({ event: 'app_opened', distinctId: ID }).expect(204);
});

test('POST /api/track has its own rate limit', async () => {
  const app = createApp({ llm: null, trackRateLimit: { windowMs: 60_000, max: 2 } });
  const send = () => request(app).post('/api/track').send({ event: 'app_opened', distinctId: ID });
  await send().expect(204);
  await send().expect(204);
  await send().expect(429);
});

test('createAnalytics returns null without a key', () => {
  assert.equal(createAnalytics({}), null);
});

test('createAnalytics posts to PostHog with first-touch attribution and swallows failures', async () => {
  const calls = [];
  const analytics = createAnalytics({
    apiKey: 'phc_test',
    host: 'https://ph.example/',
    fetchImpl: async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true }; },
  });
  await analytics.capture({ event: 'app_opened', distinctId: ID, props: { platform: 'telegram', source: 'tiktok', campaign: 'reels1' }, ip: '1.2.3.4' });
  assert.equal(calls[0].url, 'https://ph.example/i/v0/e/');
  assert.equal(calls[0].body.api_key, 'phc_test');
  assert.equal(calls[0].body.distinct_id, ID);
  assert.deepEqual(calls[0].body.properties.$set_once, { initial_source: 'tiktok', initial_campaign: 'reels1' });
  assert.equal(calls[0].body.properties.$ip, '1.2.3.4');

  const failing = createAnalytics({ apiKey: 'k', fetchImpl: async () => { throw new Error('down'); } });
  await assert.doesNotReject(failing.capture({ event: 'app_opened', distinctId: ID, props: {} }));
});

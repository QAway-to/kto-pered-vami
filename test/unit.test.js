import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreAnswers, QUESTIONS, TYPE_KEYS } from '../public/js/disc.js';
import { CASES } from '../public/js/cases.js';
import { validateMessages, isPersonaId, MAX_MESSAGES, MAX_MESSAGE_CHARS } from '../src/validate.js';
import { PERSONAS, publicPersona } from '../src/personas.js';
import { createRateLimiter } from '../src/rateLimit.js';

test('scoreAnswers picks primary and secondary types', () => {
  const r = scoreAnswers(['D', 'D', 'D', 'C', 'C', 'I']);
  assert.equal(r.primary, 'D');
  assert.equal(r.secondary, 'C');
  assert.deepEqual(r.counts, { D: 3, I: 1, S: 0, C: 2 });
  assert.equal(r.percents.D, 50);
});

test('scoreAnswers handles empty input and ties deterministically', () => {
  assert.deepEqual(scoreAnswers([]).primary, null);
  assert.equal(scoreAnswers(['S', 'I']).primary, 'I');
  assert.equal(scoreAnswers(['S']).secondary, null);
});

test('scoreAnswers rejects bad input', () => {
  assert.throws(() => scoreAnswers('D'), TypeError);
  assert.throws(() => scoreAnswers(['X']), RangeError);
});

test('content is complete: every question covers all four types, cases have valid answers', () => {
  for (const q of QUESTIONS) assert.deepEqual(Object.keys(q.a).sort(), [...TYPE_KEYS].sort());
  for (const c of CASES) assert.ok(TYPE_KEYS.includes(c.answer));
  assert.deepEqual(Object.keys(PERSONAS).sort(), [...TYPE_KEYS].sort());
});

test('publicPersona never leaks the system prompt', () => {
  const p = publicPersona('C');
  assert.deepEqual(Object.keys(p).sort(), ['intro', 'name', 'opening']);
});

test('validateMessages accepts an alternating transcript and trims', () => {
  const r = validateMessages([{ role: 'assistant', content: 'Привет' }, { role: 'user', content: '  Здравствуйте ' }]);
  assert.equal(r.ok, true);
  assert.equal(r.value[1].content, 'Здравствуйте');
});

test('validateMessages rejects malformed transcripts', () => {
  const cases = [
    null,
    [],
    [{ role: 'system', content: 'x' }],
    [{ role: 'user', content: '' }],
    [{ role: 'user', content: 5 }],
    ['oops'],
    [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }],
    [{ role: 'user', content: 'x'.repeat(MAX_MESSAGE_CHARS + 1) }],
    Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: 'x' })),
  ];
  for (const m of cases) assert.equal(validateMessages(m).ok, false, JSON.stringify(m)?.slice(0, 60));
});

test('isPersonaId', () => {
  assert.equal(isPersonaId('D'), true);
  assert.equal(isPersonaId('X'), false);
  assert.equal(isPersonaId(1), false);
});

test('rate limiter blocks after max and resets with the window', () => {
  let now = 0;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => now });
  const run = () => {
    const res = { code: 200, headers: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k] = v; }, json() { return this; } };
    let passed = false;
    limiter({ ip: '1.1.1.1' }, res, () => { passed = true; });
    return { passed, res };
  };
  assert.equal(run().passed, true);
  assert.equal(run().passed, true);
  const blocked = run();
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.code, 429);
  now = 1000;
  assert.equal(run().passed, true);
});

test('ipKey collapses IPv6 to /64 and unwraps v4-mapped addresses', async () => {
  const { ipKey } = await import('../src/rateLimit.js');
  assert.equal(ipKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(ipKey('2001:db8:1:2:bbbb::9'), '2001:db8:1:2::/64');
  assert.equal(ipKey('::ffff:10.0.0.1'), '10.0.0.1');
  assert.equal(ipKey('10.0.0.1'), '10.0.0.1');
  assert.equal(ipKey(undefined), 'unknown');
});

test('validateMessages enforces the total size cap', () => {
  const big = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: 'x'.repeat(i % 2 ? 1000 : 1000) }));
  assert.equal(validateMessages(big).ok, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, ARCHETYPE_IDS, archetypeImage } from '../public/js/archetypes.js';
import { QUESTIONS, DIM_KEYS, PROTOTYPES, scoreDimensions, rankArchetypes } from '../public/js/quiz.js';
import { CASES } from '../public/js/cases.js';
import { validateMessages, isPersonaId, MAX_MESSAGES, MAX_MESSAGE_CHARS } from '../src/validate.js';
import { PERSONAS, PERSONA_IDS, publicPersona } from '../src/personas.js';
import { createRateLimiter } from '../src/rateLimit.js';

const idealAnswers = (id) => QUESTIONS.map((q) => (
  PROTOTYPES[id].high.includes(q.dim) ? 5 : PROTOTYPES[id].low.includes(q.dim) ? 1 : 3));

test('there are at least 10 archetypes, each fully described with sources', () => {
  assert.ok(ARCHETYPE_IDS.length >= 10);
  for (const id of ARCHETYPE_IDS) {
    const a = ARCHETYPES[id];
    for (const field of ['name', 'tagline', 'emoji', 'color', 'construct', 'science', 'howTo']) {
      assert.ok(typeof a[field] === 'string' && a[field].length > 0, `${id}.${field}`);
    }
    assert.ok(a.signs.length >= 3 && a.flags.length >= 3 && a.refs.length >= 1, id);
  }
});

test('every archetype has a persona, a prototype and at least one case', () => {
  assert.deepEqual([...PERSONA_IDS].sort(), [...ARCHETYPE_IDS].sort());
  assert.deepEqual(Object.keys(PROTOTYPES).sort(), [...ARCHETYPE_IDS].sort());
  for (const c of CASES) assert.ok(ARCHETYPE_IDS.includes(c.answer), c.answer);
  for (const id of ARCHETYPE_IDS) assert.ok(CASES.some((c) => c.answer === id), `no case for ${id}`);
});

test('quiz covers every dimension with two items and prototypes use known dimensions', () => {
  assert.equal(QUESTIONS.length, DIM_KEYS.length * 2);
  for (const k of DIM_KEYS) assert.equal(QUESTIONS.filter((q) => q.dim === k).length, 2);
  for (const { high, low } of Object.values(PROTOTYPES)) {
    for (const d of [...high, ...low]) assert.ok(DIM_KEYS.includes(d), d);
  }
});

test('scoreDimensions normalises Likert answers to 0..1', () => {
  const dims = scoreDimensions(QUESTIONS.map(() => 5));
  for (const k of DIM_KEYS) assert.equal(dims[k], 1);
  assert.equal(scoreDimensions(QUESTIONS.map(() => 1)).MACH, 0);
  assert.equal(scoreDimensions(QUESTIONS.map(() => 3)).LIGHT, 0.5);
});

test('scoreDimensions rejects bad input', () => {
  assert.throws(() => scoreDimensions([1, 2]), RangeError);
  assert.throws(() => scoreDimensions('x'), RangeError);
  assert.throws(() => scoreDimensions(QUESTIONS.map(() => 6)), RangeError);
});

test('each archetype prototype ranks itself first, strictly', () => {
  for (const id of ARCHETYPE_IDS) {
    const [first, second] = rankArchetypes(scoreDimensions(idealAnswers(id)));
    assert.equal(first.id, id);
    assert.equal(first.match, 100);
    assert.ok(second.match < 100, `${id} ties with ${second.id}`);
  }
});

test('archetypeImage returns null until artwork is marked ready', () => {
  assert.equal(archetypeImage('grandiose-narcissist'), null);
});

test('publicPersona never leaks the system prompt', () => {
  const p = publicPersona('alexithymic');
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
  assert.equal(isPersonaId('dark-empath'), true);
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

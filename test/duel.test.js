import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPE_IDS } from '../public/js/archetypes.js';
import { CARDS, CARD_IDS, DECKS, STYLE, FAMILIES, OUTCOMES, MAX_TURNS, START } from '../public/js/duel-data.js';
import {
  makeRng, initState, drawHand, chooseCard, applyCard, isOver, judge, decisiveEvent, runDuel, tournament, similarity,
} from '../public/js/duel-engine.js';

test('every archetype has a 5-card deck of known cards and a style', () => {
  for (const id of ARCHETYPE_IDS) {
    assert.equal(DECKS[id]?.length, 5, id);
    assert.equal(new Set(DECKS[id]).size, 5, `${id} has duplicate cards`);
    for (const c of DECKS[id]) assert.ok(CARDS[c], `${id}: unknown card ${c}`);
    assert.ok(STYLE[id], `${id}: no style`);
  }
});

test('every card has a name, a known family, a line and a science source', () => {
  for (const id of CARD_IDS) {
    const c = CARDS[id];
    assert.ok(c.name && c.line && c.science, id);
    assert.ok(FAMILIES[c.family], `${id}: family ${c.family}`);
  }
});

test('rng is deterministic and hands are distinct cards from the deck', () => {
  const r1 = makeRng(42);
  const r2 = makeRng(42);
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
  const hand = drawHand(DECKS.secure, makeRng(1));
  assert.equal(hand.length, 3);
  assert.equal(new Set(hand).size, 3);
  for (const c of hand) assert.ok(DECKS.secure.includes(c));
});

test('applyCard changes meters, clamps to 0..10 and never mutates the input', () => {
  const s0 = initState('grandiose-narcissist', 'secure');
  const frozen = JSON.stringify(s0);
  const { state, event } = applyCard(s0, 'a', 'gaslighting');
  assert.equal(JSON.stringify(s0), frozen);
  assert.ok(state.b.esteem < START.esteem);
  assert.equal(event.cardId, 'gaslighting');
  let s = state;
  for (let i = 0; i < 10; i += 1) s = applyCard(s, 'a', 'gaslighting').state;
  assert.equal(s.b.esteem, 0);
});

test('a boundary blocks the next manipulation once', () => {
  let s = initState('psychopath', 'secure');
  s = applyCard(s, 'b', 'boundary').state;
  assert.equal(s.b.shield, true);
  const hit = applyCard(s, 'a', 'gaslighting');
  assert.equal(hit.event.blocked, true);
  assert.equal(hit.state.b.esteem, s.b.esteem, 'blocked: no damage');
  assert.equal(hit.state.b.shield, false, 'the shield is used up');
  const second = applyCard(hit.state, 'a', 'gaslighting');
  assert.equal(second.event.blocked, false);
});

test('love bombing hooks the target and the next hurtful card hits twice', () => {
  let s = initState('grandiose-narcissist', 'hsp');
  s = applyCard(s, 'a', 'love_bombing').state;
  assert.equal(s.b.hooked, true);
  const normal = applyCard(initState('grandiose-narcissist', 'hsp'), 'a', 'devaluation').event.delta.target.esteem;
  const hooked = applyCard(s, 'a', 'devaluation');
  assert.equal(hooked.event.doubled, true);
  assert.ok(hooked.event.delta.target.esteem < normal, 'doubled hit is harder');
  assert.equal(hooked.state.b.hooked, false);
});

test('cold types barely attach: a psychopath gains less trust from repair than a secure partner', () => {
  const toPsycho = applyCard(initState('secure', 'psychopath'), 'a', 'repair').event.delta.target.trust;
  const toSecure = applyCard(initState('hsp', 'secure'), 'a', 'repair').event.delta.target.trust;
  assert.ok(toPsycho < toSecure);
});

test('judge covers every ending', () => {
  const st = (a, b) => ({ a: { esteem: a[0], trust: a[1] }, b: { esteem: b[0], trust: b[1] }, turn: MAX_TURNS });
  assert.deepEqual(judge(st([6, 5], [0, 5])), { outcome: 'broken', winner: 'a', who: 'b' });
  assert.equal(judge(st([5, 0], [8, 5])).outcome, 'left');
  assert.equal(judge(st([5, 0], [8, 5])).who, 'a');
  assert.deepEqual(judge(st([7, 7], [6, 6])), { outcome: 'healthy', winner: 'both', who: null });
  assert.equal(judge(st([2, 8], [7, 7])).outcome, 'toxic');
  assert.equal(judge(st([5, 2], [5, 3])).outcome, 'cold');
  assert.equal(judge(st([5, 4], [7, 3])).outcome, 'pragmatic');
  assert.equal(judge(st([5, 5], [4, 4])).outcome, 'shaky');
  for (const k of ['broken', 'left', 'healthy', 'toxic', 'pragmatic', 'cold', 'shaky']) assert.ok(OUTCOMES[k]);
});

test('runDuel is reproducible, alternates sides and stops in time', () => {
  const d1 = runDuel('borderline', 'avoidant', { seed: 5 });
  const d2 = runDuel('borderline', 'avoidant', { seed: 5 });
  assert.deepEqual(d1.events.map((e) => e.cardId), d2.events.map((e) => e.cardId));
  assert.ok(d1.events.length <= MAX_TURNS && d1.events.length > 0);
  d1.events.forEach((e, i) => assert.equal(e.side, i % 2 === 0 ? 'a' : 'b'));
  d1.events.forEach((e, i) => assert.ok(d1.hands[i].includes(e.cardId), 'played card was in hand'));
  assert.ok(isOver(d1.final));
  assert.ok(decisiveEvent(d1.events));
  assert.throws(() => runDuel('nobody', 'secure'), RangeError);
});

test('chooseCard only plays from the hand', () => {
  const s = initState('machiavellian', 'secure');
  const hand = ['charm', 'deflect', 'guilt_trip'];
  for (let i = 0; i < 20; i += 1) assert.ok(hand.includes(chooseCard(s, 'a', hand, makeRng(i))));
});

test('tournament: everyone plays everyone; the secure type builds the most healthy unions', () => {
  const { board, pairs } = tournament(ARCHETYPE_IDS, { runs: 6 });
  assert.equal(board.length, ARCHETYPE_IDS.length);
  assert.equal(Object.keys(pairs).length, ARCHETYPE_IDS.length * (ARCHETYPE_IDS.length - 1));
  for (const s of board) assert.equal(s.games, 6 * 2 * (ARCHETYPE_IDS.length - 1));
  const healthiest = [...board].sort((x, y) => y.healthy - x.healthy)[0];
  assert.equal(healthiest.id, 'secure');
});

test('the hook is not spent on a card that cannot hurt esteem', () => {
  let s = initState('grandiose-narcissist', 'hsp');
  s = applyCard(s, 'a', 'love_bombing').state;
  const trustOnly = applyCard(s, 'b', 'deflect'); // b acts on a (not hooked): sanity
  assert.equal(trustOnly.event.doubled, false);
  const noEsteem = applyCard(s, 'a', 'ghosting'); // hurts esteem: doubles
  assert.equal(noEsteem.event.doubled, true);
  const zero = { ...s, b: { ...s.b, esteem: 0 } };
  assert.equal(applyCard(zero, 'a', 'devaluation').event.doubled, false, 'nothing left to double');
});

test('similar dark partners take manipulation softer; a psychopath stays the harshest', () => {
  assert.equal(similarity('secure', 'psychopath'), 1);
  assert.ok(similarity('grandiose-narcissist', 'vulnerable-narcissist') < similarity('machiavellian', 'dark-empath'));
  assert.ok(similarity('psychopath', 'machiavellian') > similarity('machiavellian', 'psychopath'));
  const onDark = applyCard(initState('machiavellian', 'dark-empath'), 'a', 'gaslighting').event.delta.target.esteem;
  const onLight = applyCard(initState('machiavellian', 'avoidant'), 'a', 'gaslighting').event.delta.target.esteem;
  assert.ok(onDark > onLight, 'the same move hurts a dark partner less');
});

test('every dark type has at least one healthy card', () => {
  for (const id of ['dark-empath', 'grandiose-narcissist', 'vulnerable-narcissist', 'machiavellian', 'psychopath']) {
    assert.ok(DECKS[id].some((c) => CARDS[c].family === 'healthy'), id);
  }
});

test('tournament: the psychopath breaks partners most often', () => {
  const { board } = tournament(ARCHETYPE_IDS, { runs: 6 });
  const harshest = [...board].sort((x, y) => y.broke - x.broke)[0];
  assert.equal(harshest.id, 'psychopath');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPE_IDS, LAYERS, CHARACTER_IDS, ATTACHMENT_IDS } from '../public/js/archetypes.js';
import {
  CARDS, CARD_IDS, DECKS, PROFILES, AXIS_KEYS, FAMILIES, OUTCOMES, MAX_TURNS, START, ACTS,
} from '../public/js/duel-data.js';
import {
  makeRng, initState, drawHand, chooseCard, applyCard, isOver, judge, decisiveEvent, runDuel, tournament, similarity,
  makeProfile, randomProfile, styleOf, recognition, profileFromQuiz, typicalAttachment,
} from '../public/js/duel-engine.js';
import { rankArchetypes, scoreDimensions, attachmentStyle, QUESTIONS, PROTOTYPES } from '../public/js/quiz.js';

const cardsOf = (events) => events.filter((e) => e.kind !== 'crisis');
const withStyle = (character, attachment) => makeProfile(character, { attachment });
const avgUnion = (board) => board.reduce((s, x) => s + x.union, 0) / board.length;

test('every archetype has a 5-card deck of known cards and a full axis profile', () => {
  assert.deepEqual(Object.keys(DECKS).sort(), [...ARCHETYPE_IDS].sort());
  for (const id of ARCHETYPE_IDS) {
    assert.equal(DECKS[id]?.length, 5, id);
    assert.equal(new Set(DECKS[id]).size, 5, `${id} has duplicate cards`);
    for (const c of DECKS[id]) assert.ok(CARDS[c], `${id}: unknown card ${c}`);
    for (const k of AXIS_KEYS) assert.ok(PROFILES[id][k] >= 0 && PROFILES[id][k] <= 10, `${id}.${k}`);
  }
});

test('every card has a name, a known family, a line and a science source, and is in some deck', () => {
  for (const id of CARD_IDS) {
    const c = CARDS[id];
    assert.ok(c.name && c.line && c.science, id);
    assert.ok(FAMILIES[c.family], `${id}: family ${c.family}`);
    assert.ok(Object.values(DECKS).some((d) => d.includes(id)), `${id} is never played`);
  }
});

test('the two layers cover all archetypes exactly once', () => {
  const ids = Object.values(LAYERS).flatMap((l) => l.ids);
  assert.deepEqual([...ids].sort(), [...ARCHETYPE_IDS].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(CHARACTER_IDS.length, 8);
  assert.equal(ATTACHMENT_IDS.length, 4);
});

test('play style follows the axes: honesty curbs exploitation, avoidance cuts bonding', () => {
  const psycho = styleOf(PROFILES.psychopath);
  const secure = styleOf(PROFILES.secure);
  assert.ok(psycho.exploit > secure.exploit);
  assert.ok(secure.repair > psycho.repair);
  assert.ok(styleOf(PROFILES['anxious-preoccupied']).bond > styleOf(PROFILES.avoidant).bond);
  assert.ok(styleOf(PROFILES.borderline).resilience > secure.resilience, 'low stability: hits land harder');
});

test('each character pattern has a typical attachment style from its own anxiety and avoidance', () => {
  assert.equal(typicalAttachment('psychopath'), 'avoidant');
  assert.equal(typicalAttachment('borderline'), 'anxious-preoccupied');
  assert.equal(typicalAttachment('vulnerable-narcissist'), 'fearful-avoidant');
  for (const id of CHARACTER_IDS) assert.ok(ATTACHMENT_IDS.includes(typicalAttachment(id)), id);
});

test('a player is a character pattern plus an attachment style', () => {
  const typical = makeProfile('psychopath');
  assert.equal(typical.attachment, 'avoidant');
  assert.equal(typical.typical, true);
  const secure = withStyle('psychopath', 'secure');
  assert.equal(secure.typical, false);
  assert.ok(secure.axes.avoidance < typical.axes.avoidance, 'the style sets most of the attachment axes');
  assert.ok(secure.axes.honesty - typical.axes.honesty < 2, 'but only nudges the character');
  assert.equal(secure.deck.length, 6);
  assert.ok(DECKS.secure.includes(secure.borrowed[0]) && !DECKS.psychopath.includes(secure.borrowed[0]));
  assert.throws(() => makeProfile('secure'), RangeError, 'an attachment style is not a character');
  assert.throws(() => withStyle('psychopath', 'hsp'), RangeError);
  assert.ok(ATTACHMENT_IDS.includes(randomProfile('hsp', makeRng(3)).attachment));
});

test('the test result becomes a profile: closest character pattern plus the attachment quadrant', () => {
  const answers = QUESTIONS.map((q) => {
    if (PROTOTYPES.machiavellian.high.includes(q.dim)) return 5;
    if (q.dim === 'ANX' || q.dim === 'AVO' || PROTOTYPES.machiavellian.low.includes(q.dim)) return 1;
    return 3;
  });
  const dims = scoreDimensions(answers);
  const p = profileFromQuiz({ ranked: rankArchetypes(dims), attachment: attachmentStyle(dims) });
  assert.equal(p.id, 'machiavellian');
  assert.equal(p.attachment, 'secure');
  assert.equal(profileFromQuiz({ ranked: [], attachment: null }), null);
  assert.equal(profileFromQuiz({ ranked: [{ id: 'hsp' }] }).attachment, typicalAttachment('hsp'), 'no style: the typical one');
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
  const s0 = initState('grandiose-narcissist', 'hsp');
  const frozen = JSON.stringify(s0);
  const { state, event } = applyCard(s0, 'a', 'gaslighting');
  assert.equal(JSON.stringify(s0), frozen);
  assert.ok(state.b.esteem < START.esteem);
  assert.equal(event.cardId, 'gaslighting');
  let s = state;
  for (const c of ['devaluation', 'nitpick', 'outburst', 'devaluation', 'nitpick', 'outburst']) s = applyCard(s, 'a', c).state;
  assert.equal(s.b.esteem, 0);
});

test('a boundary blocks the next manipulation once', () => {
  let s = initState('psychopath', withStyle('hsp', 'secure'));
  s = applyCard(s, 'b', 'boundary').state;
  assert.equal(s.b.shield, true);
  const hit = applyCard(s, 'a', 'gaslighting');
  assert.equal(hit.event.blocked, true);
  assert.equal(hit.state.b.esteem, s.b.esteem, 'blocked: no damage');
  assert.equal(hit.state.b.shield, false, 'the shield is used up');
  assert.equal(applyCard(hit.state, 'a', 'gaslighting').event.blocked, false);
});

test('a repeated trick is recognised: it works less, fastest for someone with firm boundaries', () => {
  const first = applyCard(initState('machiavellian', 'hsp'), 'a', 'gaslighting');
  assert.equal(first.event.recognized, false);
  const second = applyCard(first.state, 'a', 'gaslighting');
  assert.equal(second.event.recognized, true);
  assert.ok(second.event.delta.target.esteem > first.event.delta.target.esteem, 'the second hit is softer');
  const after = (target) => applyCard(initState('machiavellian', target), 'a', 'gaslighting').state.b;
  assert.ok(recognition(after(withStyle('hsp', 'secure')), 'gaslighting') < recognition(after('borderline'), 'gaslighting'));
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

test('the hook is not spent on a card that cannot hurt esteem', () => {
  let s = initState('grandiose-narcissist', 'hsp');
  s = applyCard(s, 'a', 'love_bombing').state;
  assert.equal(applyCard(s, 'b', 'empathy').event.doubled, false);
  assert.equal(applyCard(s, 'a', 'ghosting').event.doubled, true);
  const zero = { ...s, b: { ...s.b, esteem: 0 } };
  assert.equal(applyCard(zero, 'a', 'devaluation').event.doubled, false, 'nothing left to double');
});

test('cold types barely attach: a psychopath gains less trust from repair than a securely attached partner', () => {
  const toPsycho = applyCard(initState('hsp', 'psychopath'), 'a', 'repair').event.delta.target.trust;
  const toSecure = applyCard(initState('borderline', withStyle('hsp', 'secure')), 'a', 'repair').event.delta.target.trust;
  assert.ok(toPsycho < toSecure);
});

test('rejection sensitivity: withdrawal hurts an anxiously attached partner more than a securely attached one', () => {
  const hit = (attachment) => {
    const d = applyCard(initState('machiavellian', withStyle('hsp', attachment)), 'a', 'ghosting').event.delta.target;
    return d.esteem + d.trust;
  };
  assert.ok(hit('anxious-preoccupied') < hit('secure'));
});

test('similar dark partners take manipulation softer; a psychopath stays the harshest', () => {
  assert.equal(similarity('hsp', 'psychopath'), 1);
  assert.ok(similarity('grandiose-narcissist', 'vulnerable-narcissist') < similarity('machiavellian', 'dark-empath'));
  assert.ok(similarity('psychopath', 'machiavellian') > similarity('machiavellian', 'psychopath'));
  const onDark = applyCard(initState('machiavellian', 'dark-empath'), 'a', 'gaslighting').event.delta.target.esteem;
  const onLight = applyCard(initState('machiavellian', 'hsp'), 'a', 'gaslighting').event.delta.target.esteem;
  assert.ok(onDark > onLight, 'the same move hurts a dark partner less');
});

test('every dark type has at least one healthy card', () => {
  for (const id of ['dark-empath', 'grandiose-narcissist', 'vulnerable-narcissist', 'machiavellian', 'psychopath']) {
    assert.ok(DECKS[id].some((c) => CARDS[c].family === 'healthy'), id);
  }
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
  for (const k of ['broken', 'left', 'healthy', 'toxic', 'pragmatic', 'cold', 'shaky']) assert.ok(Number.isFinite(OUTCOMES[k].union));
});

test('runDuel is reproducible, alternates sides, has a crisis act and stops in time', () => {
  const d1 = runDuel('borderline', 'control-freak', { seed: 5 });
  const d2 = runDuel('borderline', 'control-freak', { seed: 5 });
  assert.deepEqual(d1.events.map((e) => e.cardId), d2.events.map((e) => e.cardId));
  const plays = cardsOf(d1.events);
  assert.ok(plays.length <= MAX_TURNS && plays.length > 0);
  plays.forEach((e, i) => assert.equal(e.side, i % 2 === 0 ? 'a' : 'b'));
  d1.events.forEach((e, i) => { if (e.kind !== 'crisis') assert.ok(d1.hands[i].includes(e.cardId), 'played card was in hand'); });
  assert.ok(isOver(d1.final));
  assert.ok(decisiveEvent(d1.events));
  assert.throws(() => runDuel('nobody', 'hsp'), RangeError);
  assert.throws(() => runDuel('secure', 'hsp'), RangeError, 'attachment styles play only as part of a player');
  const long = runDuel(withStyle('hsp', 'secure'), withStyle('control-freak', 'secure'), { seed: 2 });
  const crisis = long.events.findIndex((e) => e.kind === 'crisis');
  if (long.final.turn >= ACTS.at(-1).from) assert.equal(cardsOf(long.events.slice(0, crisis)).length, ACTS.at(-1).from);
});

test('runDuel plays the deck of the profile, borrowed card included', () => {
  const d = runDuel(withStyle('psychopath', 'secure'), 'hsp', { seed: 9 });
  assert.equal(d.final.a.id, 'psychopath');
  for (const e of cardsOf(d.events)) if (e.side === 'a') assert.ok(d.final.a.deck.includes(e.cardId));
});

test('chooseCard only plays from the hand', () => {
  const s = initState('machiavellian', 'hsp');
  const hand = ['charm', 'deal', 'guilt_trip'];
  for (let i = 0; i < 20; i += 1) assert.ok(hand.includes(chooseCard(s, 'a', hand, makeRng(i))));
});

test('tournament of character patterns: the psychopath breaks partners most and builds poor unions', () => {
  const { board, pairs } = tournament(CHARACTER_IDS, { runs: 6 });
  assert.equal(board.length, CHARACTER_IDS.length);
  assert.equal(Object.keys(pairs).length, CHARACTER_IDS.length * (CHARACTER_IDS.length - 1));
  for (const s of board) assert.equal(s.games, 6 * 2 * (CHARACTER_IDS.length - 1));
  assert.equal(board[0].id, 'hsp', 'ranked by union quality');
  assert.equal([...board].sort((x, y) => y.broke - x.broke)[0].id, 'psychopath');
  assert.ok(board.findIndex((s) => s.id === 'psychopath') >= board.length / 2, 'manipulation does not build relationships');
  assert.throws(() => tournament(CHARACTER_IDS, { attachment: 'hsp' }), RangeError);
});

test('attachment matters: secure attachment for everyone lifts union quality, fearful-avoidant lowers it', () => {
  const typical = avgUnion(tournament(CHARACTER_IDS, { runs: 6 }).board);
  const secure = avgUnion(tournament(CHARACTER_IDS, { runs: 6, attachment: 'secure' }).board);
  const fearful = avgUnion(tournament(CHARACTER_IDS, { runs: 6, attachment: 'fearful-avoidant' }).board);
  assert.ok(secure > typical);
  assert.ok(fearful < secure);
});

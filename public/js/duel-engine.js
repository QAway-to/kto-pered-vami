// «Дуэль тактик» engine: pure functions, no DOM. The same seed always plays the same duel.

import {
  CARDS, DECKS, PROFILES, AXIS_KEYS, MIX, START, MAX_TURNS, HAND_SIZE, ACTS, CRISIS, DARK, NARCISSISTS, OUTCOMES,
} from './duel-data.js';

const clamp = (n) => Math.max(0, Math.min(10, n));
const MAX_HIT = 3; // the most a single card can take from one meter

/** Small deterministic RNG (mulberry32). */
export function makeRng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const other = (side) => (side === 'a' ? 'b' : 'a');
const isTrick = (c) => c.family === 'manipulation' || c.family === 'escalation';

/**
 * How a person plays, derived from the six axes:
 * `exploit` — pull towards hurting moves (low honesty); `selfCare` — protecting yourself (boundaries);
 * `repair` — mending the bond (warmth × honesty); `bond` — how much trust they form (low avoidance, some anxiety);
 * `resilience` — how hard esteem hits land (low stability amplifies); `keep` — a dark type's investment in a partner
 * it might lose; `sensitivity` — rejection sensitivity, withdrawal hurts more (Downey & Feldman, 1996);
 * `insight` — how fast a repeated manipulation is recognised (boundaries).
 */
export function styleOf(x) {
  const dark = (10 - x.honesty) / 10;
  return {
    exploit: 3 * dark ** 2,
    selfCare: (2.2 * x.boundaries) / 10,
    repair: 3 * (x.warmth / 10) * (x.honesty / 10),
    bond: 1.2 - 0.1 * x.avoidance + 0.03 * x.anxiety,
    resilience: 1.45 - 0.09 * x.stability,
    keep: 2 * dark ** 2 * (1.3 - 0.1 * x.avoidance),
    sensitivity: 1 + x.anxiety / 20,
    insight: 0.2 + 0.04 * x.boundaries,
  };
}

/**
 * A person: a core archetype with an optional 20–30% admixture of another one.
 * The axes blend by weight; the deck gets the admixture's favourite card that the core lacks.
 * @param {string} core
 * @param {{mix?: string|null, share?: number}} [opts]
 */
export function makeProfile(core, { mix = null, share = MIX.default } = {}) {
  if (!PROFILES[core]) throw new RangeError('Unknown archetype');
  if (mix !== null && (!PROFILES[mix] || mix === core)) throw new RangeError('Unknown admixture');
  const w = mix ? Math.min(MIX.max, Math.max(MIX.min, share)) : 0;
  const axes = Object.fromEntries(AXIS_KEYS.map((k) => [
    k, Math.round(((1 - w) * PROFILES[core][k] + w * (mix ? PROFILES[mix][k] : 0)) * 10) / 10,
  ]));
  const borrowed = mix ? DECKS[mix].filter((c) => !DECKS[core].includes(c)).slice(0, 1) : [];
  return { id: core, mix, share: w, axes, style: styleOf(axes), deck: [...DECKS[core], ...borrowed], borrowed };
}

/** A random admixture: another archetype at 20, 25 or 30%. */
export function randomProfile(core, rng) {
  const others = Object.keys(PROFILES).filter((id) => id !== core);
  const mix = others[Math.floor(rng() * others.length)];
  const share = MIX.min + Math.floor(rng() * 3) * 0.05;
  return makeProfile(core, { mix, share });
}

const asProfile = (p) => (typeof p === 'string' ? makeProfile(p) : p);

/**
 * How hard a hostile move lands between these two (1 = full). Two dark types know the game and take it softer,
 * two narcissists softest; a psychopath's moves stay harmful even to his own kind.
 */
export function similarity(actorId, targetId) {
  if (!DARK.includes(actorId) || !DARK.includes(targetId)) return 1;
  if (actorId === 'psychopath') return 0.75;
  if (NARCISSISTS.includes(actorId) && NARCISSISTS.includes(targetId)) return 0.35;
  return 0.5;
}

/** 1 = a fresh trick, 0 = fully seen through: each repeat on the same partner works less. */
export function recognition(target, cardId) {
  return Math.max(0, 1 - (target.seen[cardId] ?? 0) * target.style.insight);
}

/** Scales a change by who receives it: trust gains by `bond`, esteem losses by `resilience`. */
function personal(player, { esteem, trust }) {
  const { bond, resilience } = player.style;
  const scale = (v, k) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * k)));
  return {
    esteem: esteem < 0 ? scale(esteem, resilience) : esteem,
    trust: trust > 0 ? (Math.round(trust * bond) || 0) : trust,
  };
}

/** @param {string|object} a @param {string|object} b - archetype ids or profiles from makeProfile */
export function initState(a, b) {
  const player = (p) => ({ ...asProfile(p), esteem: START.esteem, trust: START.trust, shield: false, hooked: false, seen: {} });
  return { a: player(a), b: player(b), turn: 0 };
}

/** `size` distinct cards from a deck, in random order. */
export function drawHand(deck, rng, size = HAND_SIZE) {
  const pool = [...deck];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}

/** How attractive a card is for this person right now. Higher is better. */
export function scoreCard(cardId, actor, target) {
  const c = CARDS[cardId];
  const style = actor.style;
  const t = c.target ?? {};
  const s = c.self ?? {};
  const fresh = isTrick(c) ? recognition(target, cardId) : 1; // a seen-through trick promises little
  const harm = (-(t.esteem ?? 0) - 0.5 * (t.trust ?? 0)) * fresh;
  const help = (t.esteem ?? 0) + (t.trust ?? 0);
  const selfGain = (s.esteem ?? 0) + 0.5 * (s.trust ?? 0);
  const rank = actor.deck.indexOf(cardId);

  let score = (actor.deck.length - (rank < 0 ? actor.deck.length : rank)) * 0.8; // habit: favourite moves first
  score += style.keep * help * (target.trust <= 5 ? 1.5 : 0.4); // dark types invest when they might lose the partner
  score += style.exploit * harm * (target.trust >= 5 ? 1.5 : 1); // exploiters press harder on someone attached
  score += style.selfCare * selfGain * (actor.esteem <= 4 ? 2 : 0.5); // protect yourself when hurt
  score += style.repair * help * (target.trust <= 4 || target.esteem <= 4 ? 1.5 : 0.6); // repair when the bond weakens
  // Hurt people who can protect themselves put up a boundary (the secure type does it first).
  if (c.shield && !actor.shield && actor.esteem <= 6) score += style.selfCare * 2 + style.repair;
  if (target.shield && c.family === 'manipulation') score -= 3; // a boundary makes manipulation pointless
  if (c.hurts && target.hooked) score += style.exploit * 1.5; // strike while they are «на крючке»
  if (c.shield && actor.shield) score -= 2;
  if (c.hook && target.hooked) score -= 1;
  return score;
}

/** Picks a card from the hand; a little noise keeps duels between the same pair varied. */
export function chooseCard(state, side, hand, rng) {
  const actor = state[side];
  const target = state[other(side)];
  let best = hand[0];
  let bestScore = -Infinity;
  for (const id of hand) {
    const s = scoreCard(id, actor, target) + rng() * 1.5;
    if (s > bestScore) { best = id; bestScore = s; }
  }
  return best;
}

/**
 * Plays a card. Returns the next state and an event describing what happened (for the UI and the log).
 * @returns {{state: object, event: object}}
 */
export function applyCard(state, side, cardId) {
  const c = CARDS[cardId];
  const tSide = other(side);
  const actor = { ...state[side] };
  const target = { ...state[tSide] };

  const blocked = target.shield && c.family === 'manipulation';
  const fresh = isTrick(c) && !blocked ? recognition(target, cardId) : 1;
  const selfDelta = personal(actor, { esteem: c.self?.esteem ?? 0, trust: c.self?.trust ?? 0 });
  let targetDelta = { esteem: c.target?.esteem ?? 0, trust: c.target?.trust ?? 0 };
  if (blocked) targetDelta = { esteem: 0, trust: 0 };
  // A recognised trick loses its sting and its charm alike.
  if (fresh < 1) targetDelta = { esteem: Math.round(targetDelta.esteem * fresh) || 0, trust: Math.round(targetDelta.trust * fresh) || 0 };
  const doubled = !blocked && target.hooked && Boolean(c.hurts) && targetDelta.esteem < 0 && target.esteem > 0;
  if (doubled) targetDelta = { ...targetDelta, esteem: targetDelta.esteem * 2 };
  const soften = isTrick(c) ? similarity(actor.id, target.id) : 1;
  const sting = c.family === 'withdrawal' ? target.style.sensitivity : 1;
  const k = soften * sting;
  if (k !== 1) {
    const cut = (v) => (v < 0 ? -Math.max(1, Math.round(-v * k)) : v);
    targetDelta = { esteem: cut(targetDelta.esteem), trust: cut(targetDelta.trust) };
  }
  targetDelta = personal(target, targetDelta);
  // One move can wound but not finish someone: a relationship breaks over a pattern, not a single line.
  targetDelta = { esteem: Math.max(-MAX_HIT, targetDelta.esteem), trust: Math.max(-MAX_HIT, targetDelta.trust) };

  const before = { self: { esteem: actor.esteem, trust: actor.trust }, target: { esteem: target.esteem, trust: target.trust } };
  actor.esteem = clamp(actor.esteem + selfDelta.esteem);
  actor.trust = clamp(actor.trust + selfDelta.trust);
  target.esteem = clamp(target.esteem + targetDelta.esteem);
  target.trust = clamp(target.trust + targetDelta.trust);

  if (blocked) target.shield = false; // the boundary held once
  if (doubled) target.hooked = false; // the hook has been used
  if (c.hook && !blocked && fresh >= 0.5) target.hooked = true;
  if (c.shield) actor.shield = true;
  if (c.unhook) actor.hooked = false;
  if (isTrick(c) && !blocked) target.seen = { ...target.seen, [cardId]: (target.seen[cardId] ?? 0) + 1 };

  const next = { ...state, [side]: actor, [tSide]: target, turn: state.turn + 1 };
  const event = {
    turn: next.turn,
    side,
    cardId,
    blocked,
    doubled,
    recognized: fresh < 1,
    delta: {
      self: { esteem: actor.esteem - before.self.esteem, trust: actor.trust - before.self.trust },
      target: { esteem: target.esteem - before.target.esteem, trust: target.trust - before.target.trust },
    },
  };
  return { state: next, event };
}

/** Index of the act a turn belongs to. */
export const actOf = (turn) => ACTS.reduce((acc, act, i) => (turn >= act.from ? i : acc), 0);

/** The crisis act opens with outside stress on both partners (job, money, illness). */
export function applyCrisis(state) {
  const hit = (p) => {
    const d = personal(p, CRISIS);
    return { ...p, esteem: clamp(p.esteem + d.esteem), trust: clamp(p.trust + d.trust) };
  };
  return { ...state, a: hit(state.a), b: hit(state.b) };
}

/** A duel ends early when someone's esteem or trust hits zero. */
export const isOver = (state) => state.turn >= MAX_TURNS
  || ['a', 'b'].some((k) => state[k].esteem <= 0 || state[k].trust <= 0);

/**
 * Judges the final state.
 * @returns {{outcome: string, winner: 'a'|'b'|'draw'|'both', who: 'a'|'b'|null}}
 *   `who` = the side the outcome happened to (who broke or who left)
 */
export function judge(state) {
  const { a, b } = state;
  const byEsteem = a.esteem - b.esteem >= 2 ? 'a' : b.esteem - a.esteem >= 2 ? 'b' : 'draw';
  if (a.esteem <= 0 || b.esteem <= 0) {
    if (a.esteem <= 0 && b.esteem <= 0) return { outcome: 'broken', winner: 'draw', who: null };
    const who = a.esteem <= 0 ? 'a' : 'b';
    return { outcome: 'broken', winner: other(who), who };
  }
  if (a.trust <= 0 || b.trust <= 0) {
    const who = a.trust <= 0 ? 'a' : 'b';
    return { outcome: 'left', winner: byEsteem, who };
  }
  if (Math.min(a.esteem, b.esteem) >= 6 && Math.min(a.trust, b.trust) >= 6) return { outcome: 'healthy', winner: 'both', who: null };
  if (Math.min(a.trust, b.trust) >= 6 && Math.min(a.esteem, b.esteem) <= 3) return { outcome: 'toxic', winner: byEsteem, who: null };
  if (Math.min(a.esteem, b.esteem) >= 5 && Math.min(a.trust, b.trust) >= 3) return { outcome: 'pragmatic', winner: byEsteem, who: null };
  if (Math.max(a.trust, b.trust) <= 3) return { outcome: 'cold', winner: byEsteem, who: null };
  return { outcome: 'shaky', winner: byEsteem, who: null };
}

/** The move that shook the other side the most. */
export function decisiveEvent(events) {
  let best = null;
  let bestSwing = -1;
  for (const e of events) {
    if (e.kind === 'crisis') continue;
    const swing = Math.abs(e.delta.target.esteem) + Math.abs(e.delta.target.trust) + (e.doubled ? 1 : 0) + (e.blocked ? 1 : 0);
    if (swing > bestSwing) { best = e; bestSwing = swing; }
  }
  return best;
}

const snapshot = (s) => ({ a: { ...s.a }, b: { ...s.b } });

/**
 * Plays a whole duel. A opens. Events are card plays plus one `{kind: 'crisis'}` event when the third act starts.
 * @param {string|object} a @param {string|object} b - archetype ids or profiles
 * @returns {{events: object[], hands: (string[]|null)[], final: object, result: object}}
 */
export function runDuel(a, b, { seed = 1 } = {}) {
  for (const p of [a, b]) if (typeof p === 'string' && !DECKS[p]) throw new RangeError('Unknown archetype');
  const rng = makeRng(seed);
  let state = initState(a, b);
  const events = [];
  const hands = [];
  const crisisTurn = ACTS.at(-1).from;
  while (!isOver(state)) {
    if (state.turn === crisisTurn && !events.some((e) => e.kind === 'crisis')) {
      const before = snapshot(state);
      state = applyCrisis(state);
      const delta = (k) => ({ esteem: state[k].esteem - before[k].esteem, trust: state[k].trust - before[k].trust });
      events.push({ kind: 'crisis', turn: state.turn, delta: { a: delta('a'), b: delta('b') }, after: snapshot(state) });
      hands.push(null);
      if (isOver(state)) break;
    }
    const side = state.turn % 2 === 0 ? 'a' : 'b';
    const hand = drawHand(state[side].deck, rng);
    const cardId = chooseCard(state, side, hand, rng);
    const played = applyCard(state, side, cardId);
    hands.push(hand);
    events.push({ ...played.event, act: actOf(state.turn), after: snapshot(played.state) });
    state = played.state;
  }
  return { events, hands, final: state, result: judge(state) };
}

/** «Качество союза» as 0..100 from the average outcome score (-2 broken … 3 healthy). */
export const unionIndex = (avg) => Math.round(((avg + 2) / 5) * 100);

/**
 * Round-robin: every ordered pair plays `runs` duels. With `mixed`, every player gets a random admixture each game.
 * The board ranks by union quality: who builds relationships, not who wins arguments.
 */
export function tournament(ids, { runs = 20, seed = 7, mixed = false } = {}) {
  const blank = (id) => ({ id, games: 0, wins: 0, healthy: 0, pragmatic: 0, broke: 0, left: 0, esteemSum: 0, unionSum: 0 });
  const stats = Object.fromEntries(ids.map((id) => [id, blank(id)]));
  const pairs = {};
  const mixRng = makeRng(seed * 31 + 1);
  let n = 0;
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      const pair = { wins: 0, losses: 0, draws: 0, healthy: 0, games: 0 };
      for (let r = 0; r < runs; r += 1) {
        n += 1;
        const pa = mixed ? randomProfile(a, mixRng) : a;
        const pb = mixed ? randomProfile(b, mixRng) : b;
        const { final, result } = runDuel(pa, pb, { seed: seed * 100_003 + n });
        pair.games += 1;
        for (const [side, id] of [['a', a], ['b', b]]) {
          const s = stats[id];
          s.games += 1;
          s.esteemSum += final[side].esteem;
          s.unionSum += OUTCOMES[result.outcome].union;
          if (result.winner === side) s.wins += 1;
          if (result.outcome === 'healthy') s.healthy += 1;
          if (result.outcome === 'pragmatic') s.pragmatic += 1;
          if (result.outcome === 'broken' && result.who !== side && result.who) s.broke += 1;
          if (result.outcome === 'left' && result.who === side) s.left += 1;
        }
        if (result.winner === 'a') pair.wins += 1;
        else if (result.winner === 'b') pair.losses += 1;
        else pair.draws += 1;
        if (result.outcome === 'healthy') pair.healthy += 1;
      }
      pairs[`${a}|${b}`] = pair;
    }
  }
  const board = Object.values(stats)
    .map(({ esteemSum, unionSum, ...s }) => ({
      ...s,
      avgEsteem: Math.round((esteemSum / s.games) * 10) / 10,
      union: unionIndex(unionSum / s.games),
    }))
    .sort((x, y) => y.union - x.union || y.avgEsteem - x.avgEsteem);
  return { board, pairs };
}

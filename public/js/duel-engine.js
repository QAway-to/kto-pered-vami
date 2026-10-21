// «Дуэль тактик» engine: pure functions, no DOM. The same seed always plays the same duel.

import { CARDS, DECKS, STYLE, START, MAX_TURNS, HAND_SIZE } from './duel-data.js';

const clamp = (n) => Math.max(0, Math.min(10, n));

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

/** Scales a change by who receives it: trust gains by `bond`, esteem losses by `resilience`. */
function personal(id, { esteem, trust }) {
  const { bond, resilience } = STYLE[id];
  const scale = (v, k) => (v === 0 ? 0 : Math.sign(v) * Math.max(1, Math.round(Math.abs(v) * k)));
  return {
    esteem: esteem < 0 ? scale(esteem, resilience) : esteem,
    trust: trust > 0 ? (Math.round(trust * bond) || 0) : trust,
  };
}

/** @param {string} a @param {string} b - archetype ids */
export function initState(a, b) {
  const player = (id) => ({ id, esteem: START.esteem, trust: START.trust, shield: false, hooked: false });
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

/** How attractive a card is for this archetype right now. Higher is better. */
export function scoreCard(cardId, actor, target) {
  const c = CARDS[cardId];
  const style = STYLE[actor.id];
  const deck = DECKS[actor.id];
  const t = c.target ?? {};
  const s = c.self ?? {};
  const harm = -(t.esteem ?? 0) - 0.5 * (t.trust ?? 0);
  const help = (t.esteem ?? 0) + (t.trust ?? 0);
  const selfGain = (s.esteem ?? 0) + 0.5 * (s.trust ?? 0);

  let score = (deck.length - deck.indexOf(cardId)) * 0.8; // habit: favourite moves first
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
  const doubled = !blocked && target.hooked && Boolean(c.hurts) && (c.target?.esteem ?? 0) < 0 && target.esteem > 0;
  const selfDelta = personal(actor.id, { esteem: c.self?.esteem ?? 0, trust: c.self?.trust ?? 0 });
  let targetDelta = { esteem: c.target?.esteem ?? 0, trust: c.target?.trust ?? 0 };
  if (blocked) targetDelta = { esteem: 0, trust: 0 };
  if (doubled && targetDelta.esteem < 0) targetDelta = { ...targetDelta, esteem: targetDelta.esteem * 2 };
  targetDelta = personal(target.id, targetDelta);

  const before = { self: { esteem: actor.esteem, trust: actor.trust }, target: { esteem: target.esteem, trust: target.trust } };
  actor.esteem = clamp(actor.esteem + selfDelta.esteem);
  actor.trust = clamp(actor.trust + selfDelta.trust);
  target.esteem = clamp(target.esteem + targetDelta.esteem);
  target.trust = clamp(target.trust + targetDelta.trust);

  if (blocked) target.shield = false; // the boundary held once
  if (doubled) target.hooked = false; // the hook has been used
  if (c.hook && !blocked) target.hooked = true;
  if (c.shield) actor.shield = true;
  if (c.unhook) actor.hooked = false;

  const next = { ...state, [side]: actor, [tSide]: target, turn: state.turn + 1 };
  const event = {
    turn: next.turn,
    side,
    cardId,
    blocked,
    doubled,
    delta: {
      self: { esteem: actor.esteem - before.self.esteem, trust: actor.trust - before.self.trust },
      target: { esteem: target.esteem - before.target.esteem, trust: target.trust - before.target.trust },
    },
  };
  return { state: next, event };
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
  if (Math.max(a.trust, b.trust) <= 3) return { outcome: 'cold', winner: byEsteem, who: null };
  return { outcome: 'shaky', winner: byEsteem, who: null };
}

/** The move that shook the other side the most. */
export function decisiveEvent(events) {
  let best = null;
  let bestSwing = -1;
  for (const e of events) {
    const swing = Math.abs(e.delta.target.esteem) + Math.abs(e.delta.target.trust) + (e.doubled ? 1 : 0) + (e.blocked ? 1 : 0);
    if (swing > bestSwing) { best = e; bestSwing = swing; }
  }
  return best;
}

/**
 * Plays a whole duel. A opens.
 * @returns {{events: object[], hands: string[][], final: object, result: object}}
 */
export function runDuel(a, b, { seed = 1 } = {}) {
  if (!DECKS[a] || !DECKS[b]) throw new RangeError('Unknown archetype');
  const rng = makeRng(seed);
  let state = initState(a, b);
  const events = [];
  const hands = [];
  while (!isOver(state)) {
    const side = state.turn % 2 === 0 ? 'a' : 'b';
    const hand = drawHand(DECKS[state[side].id], rng);
    const cardId = chooseCard(state, side, hand, rng);
    const played = applyCard(state, side, cardId);
    hands.push(hand);
    events.push({ ...played.event, after: { a: { ...played.state.a }, b: { ...played.state.b } } });
    state = played.state;
  }
  return { events, hands, final: state, result: judge(state) };
}

/**
 * Round-robin: every ordered pair plays `runs` duels.
 * @returns {{board: {id: string, games: number, wins: number, healthy: number, broke: number, left: number, avgEsteem: number}[],
 *            pairs: Record<string, {wins: number, losses: number, draws: number, healthy: number, games: number}>}}
 */
export function tournament(ids, { runs = 20, seed = 7 } = {}) {
  const stats = Object.fromEntries(ids.map((id) => [id, { id, games: 0, wins: 0, healthy: 0, broke: 0, left: 0, esteemSum: 0 }]));
  const pairs = {};
  let n = 0;
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      const pair = { wins: 0, losses: 0, draws: 0, healthy: 0, games: 0 };
      for (let r = 0; r < runs; r += 1) {
        n += 1;
        const { final, result } = runDuel(a, b, { seed: seed * 100_003 + n });
        pair.games += 1;
        for (const [side, id] of [['a', a], ['b', b]]) {
          const s = stats[id];
          s.games += 1;
          s.esteemSum += final[side].esteem;
          if (result.winner === side) s.wins += 1;
          if (result.outcome === 'healthy') s.healthy += 1;
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
    .map(({ esteemSum, ...s }) => ({ ...s, avgEsteem: Math.round((esteemSum / s.games) * 10) / 10 }))
    .sort((x, y) => y.wins - x.wins || y.avgEsteem - x.avgEsteem);
  return { board, pairs };
}

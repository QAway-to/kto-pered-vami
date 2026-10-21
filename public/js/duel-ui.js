// «Дуэль тактик» UI: pick two people (a type plus an optional admixture), watch three acts of tactic cards,
// see how the relationship ends; run the full tournament.

import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes.js';
import { PERSONA_NAMES } from './lab-data.js';
import { CARDS, FAMILIES, OUTCOMES, MAX_TURNS, START, ACTS, AXES, AXIS_KEYS, MIX } from './duel-data.js';
import { runDuel, decisiveEvent, tournament, makeProfile } from './duel-engine.js';
import { h, mount, store, media } from './ui.js';
import { track } from './track.js';

const HISTORY_KEY = 'duel-history';
const STEP_MS = 2200;
const SHARES = [0.2, 0.25, 0.3];
const isArchetype = (id) => typeof id === 'string' && Object.hasOwn(ARCHETYPES, id);
const nameOf = (id) => PERSONA_NAMES[id] ?? ARCHETYPES[id].name;
const pctText = (share) => `${Math.round(share * 100)}%`;

/**
 * `mixA` / `mixB`: the admixture chosen for each slot — '' (none), 'random' or an archetype id — and its share.
 * @type {{a: string|null, b: string|null, mixA: {mix: string, share: number}, mixB: {mix: string, share: number},
 *         run: any, tour: any, tourMixed: boolean, speed: number}}
 */
let state = {
  a: null, b: null, mixA: { mix: '', share: MIX.default }, mixB: { mix: '', share: MIX.default },
  run: null, tour: null, tourMixed: false, speed: 1,
};
let timer = null;
let scrollToTable = false; // only when a duel starts, never on every step

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

const mixKey = (side) => (side === 'a' ? 'mixA' : 'mixB');
const NO_MIX = Object.freeze({ mix: '', share: MIX.default });

/* ---------- history ---------- */

function loadHistory() {
  const list = store.get(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && isArchetype(r.a) && isArchetype(r.b)) : [];
}

function saveResult(a, b, result) {
  const entry = { a, b, outcome: result.outcome, winner: result.winner, at: Date.now() };
  store.set(HISTORY_KEY, [entry, ...loadHistory()].slice(0, 300));
}

/* ---------- running ---------- */

function stopTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Turns the slot's choice into a profile; a random admixture is drawn here, once per duel. */
function resolveProfile(side) {
  const core = state[side];
  const { mix, share } = state[mixKey(side)];
  if (!mix) return makeProfile(core);
  if (mix === 'random') {
    const others = ARCHETYPE_IDS.filter((id) => id !== core);
    const pick = others[Math.floor(Math.random() * others.length)];
    return makeProfile(core, { mix: pick, share: SHARES[Math.floor(Math.random() * SHARES.length)] });
  }
  return makeProfile(core, { mix: mix === core ? null : mix, share });
}

function start() {
  const { a, b } = state;
  if (!a || !b || a === b) return;
  stopTimer();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const profiles = { a: resolveProfile('a'), b: resolveProfile('b') };
  const duel = runDuel(profiles.a, profiles.b, { seed });
  track('duel_started', { a, b });
  scrollToTable = true;
  setState({ run: { ...duel, profiles, seed, shown: 0, playing: true } });
  schedule();
}

function schedule() {
  stopTimer();
  const { run } = state;
  if (!run || !run.playing) return;
  if (run.shown >= run.events.length) {
    finish();
    return;
  }
  timer = setTimeout(() => {
    // The user left the Arena (another tab or mode): pause instead of playing into a hidden view.
    if (!document.getElementById('duel-body')?.offsetParent) {
      state = { ...state, run: { ...state.run, playing: false } };
      return;
    }
    setState({ run: { ...state.run, shown: state.run.shown + 1 } });
    schedule();
  }, (state.run.shown === 0 ? 500 : STEP_MS) / state.speed);
}

function finish() {
  const { run, a, b } = state;
  if (run.done) return;
  saveResult(a, b, run.result);
  track('duel_completed', { a, b, winner: { a, b }[run.result.winner] ?? run.result.winner });
  setState({ run: { ...run, playing: false, done: true } });
}

function togglePause() {
  const { run } = state;
  if (!run || run.done) return;
  setState({ run: { ...run, playing: !run.playing } });
  schedule();
}

function skip() {
  stopTimer();
  setState({ run: { ...state.run, shown: state.run.events.length, playing: false } });
  finish();
}

function pick(id) {
  if (state.run && !state.run.done) return;
  if (state.a === id || state.b === id) return;
  // A new core starts without an admixture: the old one may even be the new core itself.
  if (!state.a) setState({ a: id, mixA: NO_MIX, run: null });
  else setState({ b: id, mixB: NO_MIX, run: null });
}

function clearSlot(slot) {
  if (state.run && !state.run.done) return;
  setState({ [slot]: null, [mixKey(slot)]: NO_MIX, run: null });
}

function swap() {
  if (state.run && !state.run.done) return;
  setState({ a: state.b, b: state.a, mixA: state.mixB, mixB: state.mixA, run: null });
}

function setMix(side, patch) {
  if (state.run && !state.run.done) return;
  setState({ [mixKey(side)]: { ...state[mixKey(side)], ...patch }, run: null });
}

/* ---------- view: pieces ---------- */

/** «Психопат + 25% Надёжный тип» */
function profileLabel(p) {
  const core = ARCHETYPES[p.id].name;
  return p.mix ? `${core} + ${pctText(p.share)} ${ARCHETYPES[p.mix].name.toLowerCase()}` : core;
}

function meter(label, value, cls) {
  return h('div', { class: `duel-meter ${cls}` }, [
    h('span', { class: 'duel-meter-label', text: label }),
    h('div', { class: 'duel-meter-track' }, [h('div', { class: 'duel-meter-fill', vars: { width: `${value * 10}%` } })]),
    h('span', { class: 'duel-meter-value', text: String(value) }),
  ]);
}

function axesView(axes, color) {
  return h('div', { class: 'duel-axes' }, AXIS_KEYS.map((k) => h('div', { class: 'duel-axis', attrs: { title: AXES[k].source } }, [
    h('span', { class: 'duel-axis-label', text: AXES[k].label }),
    h('div', { class: 'duel-axis-track' }, [h('div', { class: 'duel-axis-fill', vars: { width: `${axes[k] * 10}%`, background: color } })]),
    h('span', { class: 'duel-axis-value', text: String(Math.round(axes[k])) }),
  ])));
}

/** What this side gained or lost on the last step: a card it played, a card played on it, or the crisis. */
function deltaFor(side, lastEvent) {
  if (!lastEvent) return null;
  if (lastEvent.kind === 'crisis') return lastEvent.delta[side];
  return lastEvent.side === side ? lastEvent.delta.self : lastEvent.delta.target;
}

function playerPanel(side, p, lastEvent) {
  const id = state[side];
  const isCard = lastEvent && lastEvent.kind !== 'crisis';
  const mine = isCard && lastEvent.side === side;
  const hitMe = isCard && lastEvent.side !== side;
  const delta = deltaFor(side, lastEvent);
  const deltaChip = (v, label) => (v ? h('span', { class: `duel-delta ${v > 0 ? 'up' : 'down'}`, text: `${label} ${v > 0 ? '+' : ''}${v}` }) : null);
  return h('div', { class: `duel-player duel-${side} ${mine ? 'is-acting' : ''} ${hitMe ? 'is-target' : ''}` }, [
    media(id, 'media-duel'),
    h('div', { class: 'duel-player-body' }, [
      h('div', { class: 'duel-player-head' }, [
        h('strong', { text: nameOf(id) }),
        h('span', { class: 'muted', text: profileLabel(state.run.profiles[side]) }),
      ]),
      meter('Самооценка', p.esteem, 'is-esteem'),
      meter('Доверие', p.trust, 'is-trust'),
      h('div', { class: 'duel-tags' }, [
        p.shield && h('span', { class: 'duel-tag is-shield', text: 'Граница' }),
        p.hooked && h('span', { class: 'duel-tag is-hook', text: 'На крючке' }),
        delta && deltaChip(delta.esteem, 'Самооценка'),
        delta && deltaChip(delta.trust, 'Доверие'),
      ]),
    ]),
  ]);
}

function effectChips(card) {
  const chips = [];
  const add = (who, label, v) => {
    if (!v) return;
    chips.push(h('span', { class: `duel-fx ${v > 0 ? 'up' : 'down'}`, text: `${who}: ${label} ${v > 0 ? '+' : ''}${v}` }));
  };
  add('себе', 'самооценка', card.self?.esteem);
  add('себе', 'доверие', card.self?.trust);
  add('партнёру', 'самооценка', card.target?.esteem);
  add('партнёру', 'доверие', card.target?.trust);
  if (card.hook) chips.push(h('span', { class: 'duel-fx is-hook', text: 'сажает на крючок' }));
  if (card.shield) chips.push(h('span', { class: 'duel-fx is-shield', text: 'ставит границу' }));
  return chips;
}

function crisisView(event) {
  return h('div', { class: 'duel-card is-big is-crisis', vars: { '--fam': '#8a6d3b' } }, [
    h('div', { class: 'duel-card-top' }, [h('span', { class: 'duel-card-family', text: `Акт ${ACTS.length}: ${ACTS.at(-1).name}` })]),
    h('h3', { class: 'duel-card-name', text: 'Внешний стресс' }),
    h('p', { class: 'duel-card-line', text: 'Работа, деньги, болезнь близких — удар по обоим. Дальше пару держит только то, что они умеют чинить.' }),
    h('p', { class: 'duel-card-science', text: `Стресс извне переливается в отношения (Neff & Karney, 2009) · ход ${event.turn}` }),
  ]);
}

function cardView(event, { big = true } = {}) {
  if (event.kind === 'crisis') return crisisView(event);
  const card = CARDS[event.cardId];
  const fam = FAMILIES[card.family];
  const actor = state[event.side];
  return h('div', { class: `duel-card ${big ? 'is-big' : ''} from-${event.side}`, vars: { '--fam': fam.color }, attrs: { 'data-turn': String(event.turn) } }, [
    h('div', { class: 'duel-card-top' }, [
      h('span', { class: 'duel-card-family', text: fam.label }),
      h('span', { class: 'duel-card-by', text: nameOf(actor) }),
    ]),
    h('h3', { class: 'duel-card-name', text: card.name }),
    h('p', { class: 'duel-card-line', text: card.line }),
    big && h('div', { class: 'duel-card-fx' }, effectChips(card)),
    (event.blocked || event.doubled || event.recognized) && h('div', { class: 'duel-card-status' }, [
      event.blocked && h('span', { class: 'duel-flag is-blocked', text: 'Заблокировано границей' }),
      event.doubled && h('span', { class: 'duel-flag is-doubled', text: 'Удар ×2: был на крючке' }),
      event.recognized && h('span', { class: 'duel-flag is-recognized', text: 'Приём узнан: действует слабее' }),
    ]),
    big && h('p', { class: 'duel-card-science', text: card.science }),
  ]);
}

/* ---------- view: screens ---------- */

function mixControls(side) {
  const id = state[side];
  const { mix, share } = state[mixKey(side)];
  const locked = state.run && !state.run.done;
  const lock = locked ? { disabled: '' } : {};
  const options = [
    { value: '', label: 'Без примеси' },
    { value: 'random', label: 'Случайная примесь' },
    ...ARCHETYPE_IDS.filter((x) => x !== id).map((x) => ({ value: x, label: `+ ${ARCHETYPES[x].name}` })),
  ];
  const select = h('select', {
    class: 'duel-mix-select',
    attrs: { 'aria-label': 'Примесь второго типа', ...lock },
    on: { change: (e) => setMix(side, { mix: e.target.value }) },
  }, options.map((o) => h('option', { attrs: { value: o.value, ...(o.value === mix ? { selected: '' } : {}) }, text: o.label })));
  const shares = mix && mix !== 'random' && h('div', { class: 'duel-mix-shares' }, SHARES.map((s) => h('button', {
    class: `chip ${s === share ? 'is-active' : ''}`,
    attrs: lock,
    text: pctText(s),
    on: { click: () => setMix(side, { share: s }) },
  })));
  const preview = mix && mix !== 'random' && mix !== id ? makeProfile(id, { mix, share }) : makeProfile(id);
  return h('div', { class: 'duel-mix' }, [
    select,
    shares,
    preview.borrowed.length > 0 && h('p', { class: 'muted small', text: `Берёт из примеси карту «${CARDS[preview.borrowed[0]].name}»` }),
    mix === 'random' && h('p', { class: 'muted small', text: 'Второй тип и доля 20–30% выпадут при старте' }),
    axesView(preview.axes, ARCHETYPES[id].color),
  ]);
}

function picker() {
  const locked = state.run && !state.run.done;
  const slot = (side) => {
    const id = state[side];
    if (!id) {
      return h('div', { class: 'duel-slot' }, [
        h('span', { class: 'duel-slot-empty', text: side === 'a' ? 'Игрок A' : 'Игрок B' }),
        h('span', { class: 'muted', text: 'выберите ниже' }),
      ]);
    }
    return h('div', { class: 'duel-slot is-filled' }, [
      h('button', {
        class: 'duel-slot-face',
        attrs: { title: 'Убрать', ...(locked ? { disabled: '' } : {}) },
        on: { click: () => clearSlot(side) },
      }, [media(id, 'media-duel-lg'), h('strong', { text: nameOf(id) }), h('span', { class: 'muted', text: ARCHETYPES[id].name })]),
      mixControls(side),
    ]);
  };
  return h('div', {}, [
    h('div', { class: 'duel-versus' }, [slot('a'), h('span', { class: 'duel-vs', text: 'vs' }), slot('b')]),
    h('p', { class: 'muted small duel-mix-note', text: 'Чистых типов не бывает: личность — это точка на непрерывных шкалах (Haslam et al., 2012). Добавьте 20–30% второго типа — например, стиль привязанности к характеру — и посмотрите, как изменится игра.' }),
    h('div', { class: 'roster' }, ARCHETYPE_IDS.map((id) => {
      const taken = state.a === id || state.b === id;
      return h('button', {
        class: `roster-item ${taken ? 'is-taken' : ''}`,
        attrs: { title: ARCHETYPES[id].name, ...(taken || locked ? { disabled: '' } : {}) },
        on: { click: () => pick(id) },
      }, [media(id, 'media-icon'), h('span', { text: ARCHETYPES[id].name })]);
    })),
  ]);
}

function board() {
  const { run } = state;
  const shown = run.events.slice(0, run.shown);
  const last = shown.at(-1) ?? null;
  const fresh = { ...START, shield: false, hooked: false };
  const now = last ? last.after : { a: fresh, b: fresh };
  const turn = last ? last.turn : 0;
  const act = !last ? 0 : last.kind === 'crisis' ? ACTS.length - 1 : last.act;
  const ended = run.done && run.final.turn < MAX_TURNS;
  return h('div', { class: 'duel-board' }, [
    playerPanel('b', now.b, last),
    h('div', { class: 'duel-table' }, [
      last ? cardView(last) : h('p', { class: 'duel-table-hint', text: `Акт 1: ${ACTS[0].name}. ${nameOf(state.a)} начинает…` }),
    ]),
    playerPanel('a', now.a, last),
    h('div', { class: 'row duel-controls' }, [
      // While playing, show the full length so an early ending stays a surprise.
      h('span', { class: 'eyebrow', text: ended ? `Досрочно на ходу ${run.final.turn}` : `Акт ${act + 1}: ${ACTS[act].name} · ход ${turn} из ${MAX_TURNS}` }),
      !run.done && h('button', { class: 'btn btn-ghost', text: run.playing ? 'Пауза' : 'Продолжить', on: { click: togglePause } }),
      !run.done && h('button', { class: 'btn btn-ghost', text: 'К итогу', on: { click: skip } }),
      !run.done && h('button', {
        class: 'btn btn-ghost',
        text: state.speed > 1 ? 'Скорость ×2' : 'Скорость ×1',
        on: { click: () => setState({ speed: state.speed > 1 ? 1 : 2 }) },
      }),
    ]),
    shown.length > 1 && h('ol', { class: 'duel-log' }, shown.slice(0, -1).reverse().map((e) => (e.kind === 'crisis'
      ? h('li', { class: 'duel-log-crisis' }, [h('span', { class: 'duel-log-who', text: 'Кризис' }), h('span', { class: 'muted', text: 'внешний стресс бьёт по обоим' })])
      : h('li', {}, [
        h('span', { class: 'duel-log-who', text: nameOf(state[e.side]) }),
        h('span', { class: 'duel-log-card', vars: { '--fam': FAMILIES[CARDS[e.cardId].family].color }, text: CARDS[e.cardId].name }),
        e.blocked && h('span', { class: 'muted', text: '· заблокировано' }),
        e.doubled && h('span', { class: 'muted', text: '· ×2' }),
        e.recognized && h('span', { class: 'muted', text: '· узнан' }),
      ])))),
  ]);
}

function resultView() {
  const { run, a, b } = state;
  const { result, final } = run;
  const o = OUTCOMES[result.outcome];
  const sideName = (side) => nameOf(state[side]);
  let headline;
  if (result.outcome === 'broken' && result.who) headline = `${sideName(result.winner)} «съел» ${sideName(result.who)}`;
  else if (result.outcome === 'left' && result.who) {
    headline = final[result.who].esteem >= 5 ? `${sideName(result.who)} уходит — и сохраняет себя` : `${sideName(result.who)} уходит`;
  } else if (result.winner === 'both') headline = 'Выиграли оба';
  else if (result.winner === 'a' || result.winner === 'b') headline = `${sideName(result.winner)} сохранил себя лучше`;
  else headline = 'Ничья';
  const key = decisiveEvent(run.events);
  const line = (side, id) => h('div', {}, [
    h('strong', { text: nameOf(id) }),
    h('span', { class: 'muted', text: ` (${profileLabel(run.profiles[side])}) · самооценка ${final[side].esteem}, доверие ${final[side].trust}` }),
  ]);
  return h('div', { class: `card duel-result tone-${o.tone}` }, [
    h('span', { class: 'eyebrow', text: o.label }),
    h('h2', { text: headline }),
    h('p', { text: o.text }),
    h('div', { class: 'duel-final' }, [line('a', a), line('b', b)]),
    key && h('div', { class: 'duel-key' }, [h('h4', { text: 'Решающий ход' }), cardView(key, { big: false })]),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Ещё раз', on: { click: start } }),
      h('button', { class: 'btn btn-ghost', text: '⇄ Поменять местами', on: { click: () => { swap(); start(); } } }),
    ]),
    h('p', { class: 'muted small duel-disclaimer', text: 'Это иллюстрация паттернов из исследований, а не прогноз ваших отношений.' }),
  ]);
}

function tournamentView() {
  const { tour } = state;
  const runButtons = h('div', { class: 'row' }, [
    h('button', { class: 'btn btn-ghost', text: 'Чистые типы', on: { click: () => runTournament(false) } }),
    h('button', { class: 'btn btn-ghost', text: 'Со случайными примесями', on: { click: () => runTournament(true) } }),
  ]);
  if (!tour) {
    return h('div', { class: 'duel-tour-cta' }, [
      h('p', { class: 'muted', text: `Все ${ARCHETYPE_IDS.length} типов играют друг с другом по 20 дуэлей в трёх актах — кто строит отношения, а кто только перетягивает одеяло.` }),
      runButtons,
    ]);
  }
  const pct = (n, d) => `${Math.round((n / d) * 100)}%`;
  const best = tour.board[0];
  const dominant = [...tour.board].sort((x, y) => y.wins - x.wins)[0];
  return h('div', {}, [
    h('p', { class: 'note', text: `Лучше всех отношения строит ${ARCHETYPES[best.id].name.toLowerCase()}. Чаще всех доминирует ${ARCHETYPES[dominant.id].name.toLowerCase()}, но по качеству союза он ${tour.board.indexOf(dominant) + 1}-й из ${tour.board.length}: манипуляция выигрывает спринт и проигрывает отношения.` }),
    h('p', { class: 'muted small', text: state.tourMixed ? 'Режим: у каждого игрока в каждой дуэли случайная примесь 20–30%.' : 'Режим: чистые типы.' }),
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'duel-leaderboard' }, [
      h('thead', {}, [h('tr', {}, ['#', 'Тип', 'Качество союза', 'Здоровый', 'По расчёту', 'Сохраняет себя', 'Доминирует'].map((t) => h('th', { text: t })))]),
      h('tbody', {}, tour.board.map((s, i) => h('tr', {}, [
        h('td', { text: String(i + 1) }),
        h('td', {}, [h('div', { class: 'duel-lb-name' }, [media(s.id, 'media-xs'), h('span', { text: ARCHETYPES[s.id].name })])]),
        h('td', {}, [h('strong', { text: String(s.union) })]),
        h('td', { text: pct(s.healthy, s.games) }),
        h('td', { text: pct(s.pragmatic, s.games) }),
        h('td', { text: `${s.avgEsteem} / 10` }),
        h('td', { text: pct(s.wins, s.games) }),
      ]))),
    ])]),
    runButtons,
    h('p', { class: 'muted small', text: '«Качество союза» — средний исход пары от 0 (партнёра «съели») до 100 (здоровый союз). «Сохраняет себя» — средняя итоговая самооценка. «Доминирует» — к концу самооценка выше, чем у партнёра. Повторный приём на том же партнёре действует слабее: его узнают — быстрее всех те, у кого крепкие границы. Похожие тёмные типы бьют друг друга мягче: они играют по одним правилам.' }),
    h('p', { class: 'muted small duel-disclaimer', text: 'Это иллюстрация паттернов из исследований, а не прогноз ваших отношений.' }),
  ]);
}

function runTournament(mixed) {
  const t = tournament(ARCHETYPE_IDS, { runs: 20, mixed, seed: mixed ? Math.floor(Math.random() * 1e6) : 7 });
  track('duel_tournament');
  setState({ tour: t, tourMixed: mixed });
}

function matrixView() {
  const history = loadHistory();
  if (history.length === 0) return h('p', { class: 'muted small', text: 'Здесь появится матрица ваших дуэлей «кто кого».' });
  const latest = new Map();
  for (const r of history) if (!latest.has(`${r.a}|${r.b}`)) latest.set(`${r.a}|${r.b}`, r);
  const head = h('tr', {}, [h('th', { text: 'A ↓  B →' }), ...ARCHETYPE_IDS.map((id) => h('th', { attrs: { title: ARCHETYPES[id].name } }, [media(id, 'media-xs')]))]);
  const rows = ARCHETYPE_IDS.map((rowId) => h('tr', {}, [
    h('th', { attrs: { title: ARCHETYPES[rowId].name } }, [media(rowId, 'media-xs')]),
    ...ARCHETYPE_IDS.map((colId) => {
      if (rowId === colId) return h('td', { class: 'cell-self' });
      const r = latest.get(`${rowId}|${colId}`);
      const cls = !r ? 'cell-empty' : r.winner === 'a' ? 'cell-a' : r.winner === 'b' ? 'cell-b' : 'cell-draw';
      return h('td', {
        class: `cell ${cls}`,
        text: r ? OUTCOMES[r.outcome].label.slice(0, 1) : '',
        attrs: { title: `${ARCHETYPES[rowId].name} vs ${ARCHETYPES[colId].name}${r ? `: ${OUTCOMES[r.outcome].label}` : ''}` },
        on: { click: () => { if (!state.run || state.run.done) setState({ a: rowId, b: colId, mixA: NO_MIX, mixB: NO_MIX, run: null }); } },
      });
    }),
  ]));
  return h('div', {}, [
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'matrix' }, [h('thead', {}, [head]), h('tbody', {}, rows)])]),
    h('p', { class: 'muted small', text: 'Буква — исход последней дуэли пары. Цвет: строка взяла верх · столбец взял верх · ничья или оба. Нажмите на клетку, чтобы поставить пару.' }),
  ]);
}

function render() {
  const ready = state.a && state.b && state.a !== state.b;
  const { run } = state;
  mount(
    'duel-body',
    // During a duel the intro steps aside so the whole table fits on a phone screen.
    (!run || run.done) && h('span', { class: 'eyebrow', text: 'Дуэль тактик' }),
    (!run || run.done) && h('h1', { class: 'display', text: 'Кто кого?' }),
    (!run || run.done) && h('p', { class: 'lead', text: 'Два человека разыгрывают свои привычные тактики в трёх актах: знакомство, быт, кризис. Каждая карта — реальный приём из психологии со ссылкой на исследование. Манипуляции сильны на старте, но партнёр их узнаёт; в кризисе пару держит только умение чинить.' }),
    !run || run.done ? picker() : null,
    (!run || run.done) && h('div', { class: 'row duel-start' }, [
      h('button', { class: 'btn btn-primary', text: run?.done ? 'Новая дуэль' : 'Начать дуэль', attrs: ready ? {} : { disabled: '' }, on: { click: start } }),
      h('button', { class: 'btn btn-ghost', text: '⇄ Поменять местами', attrs: ready ? {} : { disabled: '' }, on: { click: swap } }),
    ]),
    run && board(),
    run?.done && resultView(),
    h('h2', { text: 'Турнир всех со всеми' }),
    tournamentView(),
    h('h2', { text: 'Ваши дуэли' }),
    matrixView(),
  );
  if (scrollToTable) {
    scrollToTable = false;
    document.querySelector('.duel-board')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

/** @param {string} [presetId] - archetype to put into slot A */
export function renderDuel(presetId) {
  if (isArchetype(presetId) && (!state.run || state.run.done)) {
    state = { ...state, a: presetId, mixA: NO_MIX, ...(state.b === presetId ? { b: null, mixB: NO_MIX } : {}), run: null };
  }
  render();
}

/** Stops a running duel (when the user leaves the Duel mode). */
export function pauseDuel() {
  stopTimer();
  if (state.run && !state.run.done) state = { ...state, run: { ...state.run, playing: false } };
}

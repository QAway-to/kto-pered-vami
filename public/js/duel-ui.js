// «Дуэль тактик» UI: pick two archetypes, watch their tactic cards play out, see who ate whom; run the full tournament.

import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes.js';
import { PERSONA_NAMES } from './lab-data.js';
import { CARDS, FAMILIES, OUTCOMES, MAX_TURNS, START } from './duel-data.js';
import { runDuel, decisiveEvent, tournament } from './duel-engine.js';
import { h, mount, store, media } from './ui.js';
import { track } from './track.js';

const HISTORY_KEY = 'duel-history';
const STEP_MS = 2200;
const isArchetype = (id) => typeof id === 'string' && Object.hasOwn(ARCHETYPES, id);
const nameOf = (id) => PERSONA_NAMES[id] ?? ARCHETYPES[id].name;

/** @type {{a: string|null, b: string|null, run: any, tour: any, speed: number}} */
let state = { a: null, b: null, run: null, tour: null, speed: 1 };
let timer = null;
let scrollToTable = false; // only when a duel starts, never on every step

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

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

function start() {
  const { a, b } = state;
  if (!a || !b || a === b) return;
  stopTimer();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const duel = runDuel(a, b, { seed });
  track('duel_started', { a, b });
  scrollToTable = true;
  setState({ run: { ...duel, seed, shown: 0, playing: true } });
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
  if (!state.a) setState({ a: id, run: null });
  else setState({ b: id, run: null });
}

function clearSlot(slot) {
  if (state.run && !state.run.done) return;
  setState({ [slot]: null, run: null });
}

function swap() {
  if (state.run && !state.run.done) return;
  setState({ a: state.b, b: state.a, run: null });
}

/* ---------- view: pieces ---------- */

function meter(label, value, cls) {
  return h('div', { class: `duel-meter ${cls}` }, [
    h('span', { class: 'duel-meter-label', text: label }),
    h('div', { class: 'duel-meter-track' }, [h('div', { class: 'duel-meter-fill', vars: { width: `${value * 10}%` } })]),
    h('span', { class: 'duel-meter-value', text: String(value) }),
  ]);
}

function playerPanel(side, p, lastEvent) {
  const id = state[side];
  const mine = lastEvent && lastEvent.side === side;
  const hitMe = lastEvent && lastEvent.side !== side;
  const delta = lastEvent ? (mine ? lastEvent.delta.self : lastEvent.delta.target) : null;
  const deltaChip = (v, label) => (v ? h('span', { class: `duel-delta ${v > 0 ? 'up' : 'down'}`, text: `${label} ${v > 0 ? '+' : ''}${v}` }) : null);
  return h('div', { class: `duel-player duel-${side} ${mine ? 'is-acting' : ''} ${hitMe ? 'is-target' : ''}` }, [
    media(id, 'media-duel'),
    h('div', { class: 'duel-player-body' }, [
      h('div', { class: 'duel-player-head' }, [
        h('strong', { text: nameOf(id) }),
        h('span', { class: 'muted', text: ARCHETYPES[id].name }),
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
  const add = (who, key, label, v) => {
    if (!v) return;
    chips.push(h('span', { class: `duel-fx ${v > 0 ? 'up' : 'down'}`, text: `${who}: ${label} ${v > 0 ? '+' : ''}${v}` }));
  };
  add('себе', 'esteem', 'самооценка', card.self?.esteem);
  add('себе', 'trust', 'доверие', card.self?.trust);
  add('партнёру', 'esteem', 'самооценка', card.target?.esteem);
  add('партнёру', 'trust', 'доверие', card.target?.trust);
  if (card.hook) chips.push(h('span', { class: 'duel-fx is-hook', text: 'сажает на крючок' }));
  if (card.shield) chips.push(h('span', { class: 'duel-fx is-shield', text: 'ставит границу' }));
  return chips;
}

function cardView(event, { big = true } = {}) {
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
    (event.blocked || event.doubled) && h('div', { class: 'duel-card-status' }, [
      event.blocked && h('span', { class: 'duel-flag is-blocked', text: 'Заблокировано границей' }),
      event.doubled && h('span', { class: 'duel-flag is-doubled', text: 'Удар ×2: был на крючке' }),
    ]),
    big && h('p', { class: 'duel-card-science', text: card.science }),
  ]);
}

/* ---------- view: screens ---------- */

function picker() {
  const locked = state.run && !state.run.done;
  const slot = (side) => {
    const id = state[side];
    return h('button', {
      class: `duel-slot ${id ? 'is-filled' : ''}`,
      attrs: locked ? { disabled: '' } : {},
      on: { click: () => (id ? clearSlot(side) : null) },
    }, id
      ? [media(id, 'media-duel-lg'), h('strong', { text: nameOf(id) }), h('span', { class: 'muted', text: ARCHETYPES[id].name })]
      : [h('span', { class: 'duel-slot-empty', text: side === 'a' ? 'Игрок A' : 'Игрок B' }), h('span', { class: 'muted', text: 'выберите ниже' })]);
  };
  return h('div', {}, [
    h('div', { class: 'duel-versus' }, [slot('a'), h('span', { class: 'duel-vs', text: 'vs' }), slot('b')]),
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
  const now = last ? last.after : { a: { ...START, shield: false, hooked: false }, b: { ...START, shield: false, hooked: false } };
  return h('div', { class: 'duel-board' }, [
    playerPanel('b', now.b, last),
    h('div', { class: 'duel-table' }, [
      last ? cardView(last) : h('p', { class: 'duel-table-hint', text: `${nameOf(state.a)} начинает…` }),
    ]),
    playerPanel('a', now.a, last),
    h('div', { class: 'row duel-controls' }, [
      // While playing, show the full length so an early ending stays a surprise.
      h('span', { class: 'eyebrow', text: run.done && run.events.length < MAX_TURNS ? `Досрочно на ходу ${run.events.length}` : `Ход ${Math.min(run.shown, run.events.length)} из ${MAX_TURNS}` }),
      !run.done && h('button', { class: 'btn btn-ghost', text: run.playing ? 'Пауза' : 'Продолжить', on: { click: togglePause } }),
      !run.done && h('button', { class: 'btn btn-ghost', text: 'К итогу', on: { click: skip } }),
      !run.done && h('button', {
        class: 'btn btn-ghost',
        text: state.speed > 1 ? 'Скорость ×2' : 'Скорость ×1',
        on: { click: () => setState({ speed: state.speed > 1 ? 1 : 2 }) },
      }),
    ]),
    shown.length > 1 && h('ol', { class: 'duel-log' }, shown.slice(0, -1).reverse().map((e) => h('li', {}, [
      h('span', { class: 'duel-log-who', text: nameOf(state[e.side]) }),
      h('span', { class: 'duel-log-card', vars: { '--fam': FAMILIES[CARDS[e.cardId].family].color }, text: CARDS[e.cardId].name }),
      e.blocked && h('span', { class: 'muted', text: '· заблокировано' }),
      e.doubled && h('span', { class: 'muted', text: '· ×2' }),
    ]))),
  ]);
}

function resultView() {
  const { run, a, b } = state;
  const { result, final } = run;
  const o = OUTCOMES[result.outcome];
  const sideName = (side) => nameOf(state[side]);
  let headline;
  if (result.outcome === 'broken' && result.who) headline = `${sideName(result.winner)} «съел» ${sideName(result.who)}`;
  else if (result.outcome === 'left' && result.who) headline = `${sideName(result.who)} уходит`;
  else if (result.winner === 'both') headline = 'Выиграли оба';
  else if (result.winner === 'a' || result.winner === 'b') headline = `${sideName(result.winner)} сохранил себя лучше`;
  else headline = 'Ничья';
  const key = decisiveEvent(run.events);
  return h('div', { class: `card duel-result tone-${o.tone}` }, [
    h('span', { class: 'eyebrow', text: o.label }),
    h('h2', { text: headline }),
    h('p', { text: o.text }),
    h('div', { class: 'duel-final' }, [
      h('div', {}, [h('strong', { text: nameOf(a) }), h('span', { class: 'muted', text: ` · самооценка ${final.a.esteem}, доверие ${final.a.trust}` })]),
      h('div', {}, [h('strong', { text: nameOf(b) }), h('span', { class: 'muted', text: ` · самооценка ${final.b.esteem}, доверие ${final.b.trust}` })]),
    ]),
    key && h('div', { class: 'duel-key' }, [h('h4', { text: 'Решающий ход' }), cardView(key, { big: false })]),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Ещё раз', on: { click: start } }),
      h('button', { class: 'btn btn-ghost', text: '⇄ Поменять местами', on: { click: () => { swap(); start(); } } }),
    ]),
  ]);
}

function tournamentView() {
  const { tour } = state;
  if (!tour) {
    return h('div', { class: 'duel-tour-cta' }, [
      h('p', { class: 'muted', text: `Все ${ARCHETYPE_IDS.length} типов играют друг с другом по 20 дуэлей — кто выигрывает в долгую и кто строит здоровые союзы.` }),
      h('button', { class: 'btn btn-ghost', text: 'Запустить турнир', on: { click: runTournament } }),
    ]);
  }
  const pct = (n, d) => `${Math.round((n / d) * 100)}%`;
  const healthiest = [...tour.board].sort((x, y) => y.healthy - x.healthy)[0];
  return h('div', {}, [
    h('p', { class: 'note', text: `Тёмные типы чаще «выигрывают» дуэль, но здоровый союз чаще всех строит ${ARCHETYPES[healthiest.id].name.toLowerCase()}: победа в манипуляции — не то же самое, что хорошие отношения.` }),
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'duel-leaderboard' }, [
      h('thead', {}, [h('tr', {}, ['#', 'Тип', 'Побеждает', 'Здоровый союз', 'Сохраняет себя'].map((t) => h('th', { text: t })))]),
      h('tbody', {}, tour.board.map((s, i) => h('tr', {}, [
        h('td', { text: String(i + 1) }),
        h('td', {}, [h('div', { class: 'duel-lb-name' }, [media(s.id, 'media-xs'), h('span', { text: ARCHETYPES[s.id].name })])]),
        h('td', { text: pct(s.wins, s.games) }),
        h('td', { text: pct(s.healthy, s.games) }),
        h('td', { text: `${s.avgEsteem} / 10` }),
      ]))),
    ])]),
    h('p', { class: 'muted small', text: '«Побеждает» — к концу дуэли самооценка выше, чем у партнёра. «Сохраняет себя» — средняя итоговая самооценка. Правила одинаковы для всех; различаются только колоды и характер.' }),
  ]);
}

function runTournament() {
  const t = tournament(ARCHETYPE_IDS, { runs: 20 });
  track('duel_tournament');
  setState({ tour: t });
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
        on: { click: () => { if (!state.run || state.run.done) setState({ a: rowId, b: colId, run: null }); } },
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
    (!run || run.done) && h('p', { class: 'lead', text: 'Два типа личности разыгрывают свои привычные тактики — от love bombing до границ. Каждая карта — реальный приём из психологии со ссылкой на исследование. Смотрите, кто кого «съест».' }),
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
    state = { ...state, a: presetId, b: state.b === presetId ? null : state.b, run: null };
  }
  render();
}

/** Stops a running duel (when the user leaves the Duel mode). */
export function pauseDuel() {
  stopTimer();
  if (state.run && !state.run.done) state = { ...state, run: { ...state.run, playing: false } };
}

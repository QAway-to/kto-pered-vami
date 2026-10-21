// «Дуэль тактик» UI: pick two people (a character pattern plus an attachment style), watch three acts of tactic cards,
// see how the relationship ends; run the full tournament.

import { ARCHETYPES, CHARACTER_IDS, ATTACHMENT_IDS, attachmentLabel } from './archetypes.js';
import { DIM_KEYS, rankArchetypes, attachmentStyle } from './quiz.js';
import { PERSONA_NAMES } from './lab-data.js';
import { CARDS, FAMILIES, OUTCOMES, MAX_TURNS, START, ACTS, AXES, AXIS_KEYS } from './duel-data.js';
import { runDuel, decisiveEvent, tournament, makeProfile, profileFromQuiz, typicalAttachment } from './duel-engine.js';
import { h, mount, store, media, attachmentChips } from './ui.js';
import { track } from './track.js';

const HISTORY_KEY = 'duel-history';
const STEP_MS = 2200;
const isCharacter = (id) => CHARACTER_IDS.includes(id);
const nameOf = (id) => PERSONA_NAMES[id] ?? ARCHETYPES[id].name;

/**
 * `a` / `b`: character patterns in the slots. `attA` / `attB`: their attachment styles — '' (the pattern's typical one),
 * 'random' or a style id. `me` — the slot the user plays themself, with the profile from their test result.
 * @type {{a: string|null, b: string|null, attA: string, attB: string, me: 'a'|'b'|null,
 *         run: any, tour: any, tourMode: string, tourBase: number|null, speed: number}}
 */
let state = {
  a: null, b: null, attA: '', attB: '', me: null, run: null, tour: null, tourMode: 'typical', tourBase: null, speed: 1,
};

/** Display name of a side: «Вы» for the user's own slot, the persona's first name otherwise. */
const sideName = (side) => (state.me === side ? 'Вы' : nameOf(state[side]));

/** The user's profile from the saved test scores (character pattern + attachment style), or null before the test. */
function myProfile() {
  const dims = store.get('result', null)?.dims;
  if (!dims || !DIM_KEYS.every((k) => typeof dims[k] === 'number')) return null;
  return profileFromQuiz({ ranked: rankArchetypes(dims), attachment: attachmentStyle(dims) });
}
let timer = null;
let scrollToTable = false; // only when a duel starts, never on every step

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

const attKey = (side) => (side === 'a' ? 'attA' : 'attB');
const TYPICAL = '';

/* ---------- history ---------- */

function loadHistory() {
  const list = store.get(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && isCharacter(r.a) && isCharacter(r.b)) : [];
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

/** Turns the slot's choice into a profile; a random attachment style is drawn here, once per duel. */
function resolveProfile(side) {
  const att = state[attKey(side)];
  const attachment = att === 'random' ? ATTACHMENT_IDS[Math.floor(Math.random() * ATTACHMENT_IDS.length)] : att || null;
  return makeProfile(state[side], { attachment });
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
  // A new character starts with its typical attachment style.
  if (!state.a) setState({ a: id, attA: TYPICAL, me: state.me === 'a' ? null : state.me, run: null });
  else setState({ b: id, attB: TYPICAL, me: state.me === 'b' ? null : state.me, run: null });
}

function clearSlot(slot) {
  if (state.run && !state.run.done) return;
  setState({ [slot]: null, [attKey(slot)]: TYPICAL, me: state.me === slot ? null : state.me, run: null });
}

function swap() {
  if (state.run && !state.run.done) return;
  setState({ a: state.b, b: state.a, attA: state.attB, attB: state.attA, me: state.me && (state.me === 'a' ? 'b' : 'a'), run: null });
}

/** Puts the user into the first free slot (or A), with their character pattern and attachment style from the test. */
function playMyself() {
  if (state.run && !state.run.done) return;
  const p = myProfile();
  if (!p) return;
  const side = state.me ?? (!state.a ? 'a' : !state.b ? 'b' : 'a');
  const otherSide = side === 'a' ? 'b' : 'a';
  const clash = state[otherSide] === p.id ? { [otherSide]: null, [attKey(otherSide)]: TYPICAL } : {};
  track('duel_myself', { archetype: p.id });
  setState({ ...clash, [side]: p.id, [attKey(side)]: p.attachment, me: side, run: null });
}

function setAttachment(side, value) {
  if (state.run && !state.run.done) return;
  setState({ [attKey(side)]: value, run: null });
}

/* ---------- view: pieces ---------- */

/** «Психопат · избегающая привязанность» */
function profileLabel(p) {
  return `${ARCHETYPES[p.id].name} · ${attachmentLabel(p.attachment)}`;
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
        h('strong', { text: sideName(side) }),
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
  return h('div', { class: `duel-card ${big ? 'is-big' : ''} from-${event.side}`, vars: { '--fam': fam.color }, attrs: { 'data-turn': String(event.turn) } }, [
    h('div', { class: 'duel-card-top' }, [
      h('span', { class: 'duel-card-family', text: fam.label }),
      h('span', { class: 'duel-card-by', text: sideName(event.side) }),
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

function attachmentControls(side) {
  const id = state[side];
  const chosen = state[attKey(side)];
  const preview = makeProfile(id, { attachment: chosen && chosen !== 'random' ? chosen : null });
  return h('div', { class: 'duel-mix' }, [
    attachmentChips({
      typical: typicalAttachment(id),
      value: chosen,
      withRandom: true,
      disabled: Boolean(state.run && !state.run.done),
      onPick: (v) => setAttachment(side, v),
    }),
    preview.borrowed.length > 0 && chosen !== 'random' && h('p', { class: 'muted small', text: `Из стиля привязанности — карта «${CARDS[preview.borrowed[0]].name}»` }),
    chosen === 'random' && h('p', { class: 'muted small', text: 'Стиль выпадет при старте' }),
    axesView(preview.axes, ARCHETYPES[id].color),
  ]);
}

function myCta(locked) {
  const p = myProfile();
  if (!p) {
    return h('div', { class: 'duel-me' }, [
      h('p', { class: 'muted small', text: 'Пройдите тест — и сыграйте собой: ваш паттерн характера и ваш стиль привязанности.' }),
      h('button', { class: 'btn btn-ghost', text: 'Пройти тест', on: { click: () => document.querySelector('[data-go="test"]')?.click() } }),
    ]);
  }
  return h('div', { class: 'duel-me' }, [
    h('button', {
      class: 'btn btn-primary',
      text: state.me ? 'Вы в игре' : 'Сыграть собой',
      attrs: locked || state.me ? { disabled: '' } : {},
      on: { click: playMyself },
    }),
    h('span', { class: 'muted small', text: `По тесту: ${profileLabel(p)}` }),
  ]);
}

/** The launch button sits right under the two players, centred. */
function startRow() {
  const ready = state.a && state.b && state.a !== state.b;
  const { run } = state;
  return h('div', { class: 'launch-row' }, [
    h('button', { class: 'btn btn-primary', text: run?.done ? 'Запустить снова' : 'Запустить дуэль', attrs: ready ? {} : { disabled: '' }, on: { click: start } }),
    h('button', { class: 'btn btn-ghost', text: '⇄ Поменять местами', attrs: ready ? {} : { disabled: '' }, on: { click: swap } }),
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
      }, [media(id, 'media-duel-lg'), h('strong', { text: sideName(side) }), h('span', { class: 'muted', text: state.me === side ? `Ваш профиль: ${ARCHETYPES[id].name}` : ARCHETYPES[id].name })]),
      attachmentControls(side),
    ]);
  };
  return h('div', {}, [
    h('div', { class: 'duel-versus' }, [slot('a'), h('span', { class: 'duel-vs', text: 'vs' }), slot('b')]),
    startRow(),
    myCta(locked),
    h('p', { class: 'muted small duel-mix-note', text: 'Каждый игрок — паттерн характера плюс стиль привязанности. Привязанность — отдельный модуль: при любом характере она может быть любой и заметно меняет игру. Попробуйте одного и того же психопата с надёжной и с дезорганизованной привязанностью.' }),
    h('div', { class: 'roster' }, CHARACTER_IDS.map((id) => {
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
      last ? cardView(last) : h('p', { class: 'duel-table-hint', text: `Акт 1: ${ACTS[0].name}. ${sideName('a')}: первый ход…` }),
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
        h('span', { class: 'duel-log-who', text: sideName(e.side) }),
        h('span', { class: 'duel-log-card', vars: { '--fam': FAMILIES[CARDS[e.cardId].family].color }, text: CARDS[e.cardId].name }),
        e.blocked && h('span', { class: 'muted', text: '· заблокировано' }),
        e.doubled && h('span', { class: 'muted', text: '· ×2' }),
        e.recognized && h('span', { class: 'muted', text: '· узнан' }),
      ])))),
  ]);
}

function resultView() {
  const { run } = state;
  const { result, final } = run;
  const o = OUTCOMES[result.outcome];
  let headline;
  if (result.outcome === 'broken' && result.who) headline = `${sideName(result.who)}: самооценка на нуле`;
  else if (result.outcome === 'left' && result.who) {
    headline = final[result.who].esteem >= 5 ? `${sideName(result.who)}: уход из отношений, самооценка цела` : `${sideName(result.who)}: уход из отношений`;
  } else if (result.winner === 'both') headline = 'Выиграли оба';
  else if (result.winner === 'a' || result.winner === 'b') headline = `${sideName(result.winner)}: самооценка выше к концу`;
  else headline = 'Ничья';
  const key = decisiveEvent(run.events);
  const line = (side) => h('div', {}, [
    h('strong', { text: sideName(side) }),
    h('span', { class: 'muted', text: ` (${profileLabel(run.profiles[side])}) · самооценка ${final[side].esteem}, доверие ${final[side].trust}` }),
  ]);
  return h('div', { class: `card duel-result tone-${o.tone}` }, [
    h('span', { class: 'eyebrow', text: o.label }),
    h('h2', { text: headline }),
    h('p', { text: o.text }),
    h('div', { class: 'duel-final' }, [line('a'), line('b')]),
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
  const runButtons = h('div', { class: 'row' }, Object.entries(TOUR_MODES).map(([mode, m]) => h('button', {
    class: `btn ${tour && state.tourMode === mode ? 'btn-primary' : 'btn-ghost'}`,
    text: m.button,
    on: { click: () => runTournament(mode) },
  })));
  if (!tour) {
    return h('div', { class: 'duel-tour-cta' }, [
      h('p', { class: 'muted', text: `Все ${CHARACTER_IDS.length} паттернов характера играют друг с другом по 20 дуэлей в трёх актах — кто строит отношения, а кто только перетягивает одеяло. Запустите с типичной привязанностью, а потом всем надёжную — и сравните.` }),
      runButtons,
    ]);
  }
  const pct = (n, d) => `${Math.round((n / d) * 100)}%`;
  const best = tour.board[0];
  const dominant = [...tour.board].sort((x, y) => y.wins - x.wins)[0];
  return h('div', {}, [
    h('p', { class: 'note', text: `Лучше всех отношения строит ${ARCHETYPES[best.id].name.toLowerCase()}. Чаще всех доминирует ${ARCHETYPES[dominant.id].name.toLowerCase()}, но по качеству союза он ${tour.board.indexOf(dominant) + 1}-й из ${tour.board.length}: манипуляция выигрывает спринт и проигрывает отношения.` }),
    h('p', { class: 'muted small', text: `Режим: ${TOUR_MODES[state.tourMode].label}. Среднее качество союза — ${avgUnion(tour.board)}${state.tourBase != null ? ` против ${state.tourBase} с типичной привязанностью` : ''}.` }),
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'duel-leaderboard' }, [
      h('thead', {}, [h('tr', {}, ['#', 'Паттерн', 'Качество союза', 'Здоровый', 'По расчёту', 'Сохраняет себя', 'Доминирует'].map((t) => h('th', { text: t })))]),
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

const TOUR_MODES = {
  typical: { button: 'Типичная привязанность', label: 'у каждого паттерна его типичный стиль привязанности' },
  secure: { button: 'Всем надёжную', label: 'у всех надёжная привязанность' },
  random: { button: 'Случайная', label: 'в каждой дуэли случайный стиль привязанности' },
};

const avgUnion = (board) => Math.round(board.reduce((s, x) => s + x.union, 0) / board.length);

let typicalBoard = null; // the typical-attachment run is deterministic (seed 7), so it is computed once

function runTournament(mode) {
  const run = (attachment) => tournament(CHARACTER_IDS, { runs: 20, attachment, seed: attachment === 'random' ? Math.floor(Math.random() * 1e6) : 7 });
  typicalBoard ??= run('typical').board;
  const t = mode === 'typical' ? { board: typicalBoard } : run(mode);
  track('duel_tournament');
  setState({ tour: t, tourMode: mode, tourBase: mode === 'typical' ? null : avgUnion(typicalBoard) });
}

function matrixView() {
  const history = loadHistory();
  if (history.length === 0) return h('p', { class: 'muted small', text: 'Здесь появится матрица ваших дуэлей «кто кого».' });
  const latest = new Map();
  for (const r of history) if (!latest.has(`${r.a}|${r.b}`)) latest.set(`${r.a}|${r.b}`, r);
  const head = h('tr', {}, [h('th', { text: 'A ↓  B →' }), ...CHARACTER_IDS.map((id) => h('th', { attrs: { title: ARCHETYPES[id].name } }, [media(id, 'media-xs')]))]);
  const rows = CHARACTER_IDS.map((rowId) => h('tr', {}, [
    h('th', { attrs: { title: ARCHETYPES[rowId].name } }, [media(rowId, 'media-xs')]),
    ...CHARACTER_IDS.map((colId) => {
      if (rowId === colId) return h('td', { class: 'cell-self' });
      const r = latest.get(`${rowId}|${colId}`);
      const cls = !r ? 'cell-empty' : r.winner === 'a' ? 'cell-a' : r.winner === 'b' ? 'cell-b' : 'cell-draw';
      return h('td', {
        class: `cell ${cls}`,
        text: r ? OUTCOMES[r.outcome].label.slice(0, 1) : '',
        attrs: { title: `${ARCHETYPES[rowId].name} vs ${ARCHETYPES[colId].name}${r ? `: ${OUTCOMES[r.outcome].label}` : ''}` },
        on: { click: () => { if (!state.run || state.run.done) setState({ a: rowId, b: colId, attA: TYPICAL, attB: TYPICAL, me: null, run: null }); } },
      });
    }),
  ]));
  return h('div', {}, [
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'matrix' }, [h('thead', {}, [head]), h('tbody', {}, rows)])]),
    h('p', { class: 'muted small', text: 'Буква — исход последней дуэли пары. Цвет: строка взяла верх · столбец взял верх · ничья или оба. Нажмите на клетку, чтобы поставить пару.' }),
  ]);
}

function render() {
  const { run } = state;
  mount(
    'duel-body',
    // During a duel the intro steps aside so the whole table fits on a phone screen.
    (!run || run.done) && h('span', { class: 'eyebrow', text: 'Дуэль тактик' }),
    (!run || run.done) && h('h1', { class: 'display', text: 'Кто кого?' }),
    (!run || run.done) && h('p', { class: 'lead', text: 'Два человека разыгрывают свои привычные тактики в трёх актах: знакомство, быт, кризис. Каждая карта — реальный приём из психологии со ссылкой на исследование. Манипуляции сильны на старте, но партнёр их узнаёт; в кризисе пару держит только умение чинить.' }),
    !run || run.done ? picker() : null,
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

/** @param {string} [presetId] - a character pattern for slot A, or an attachment style for player A */
export function renderDuel(presetId) {
  if (!state.run || state.run.done) {
    if (isCharacter(presetId)) {
      state = { ...state, a: presetId, attA: TYPICAL, me: null, ...(state.b === presetId ? { b: null, attB: TYPICAL } : {}), run: null };
    } else if (ATTACHMENT_IDS.includes(presetId)) {
      state = { ...state, attA: presetId, me: null, run: null };
    }
  }
  render();
}

/** Stops a running duel (when the user leaves the Duel mode). */
export function pauseDuel() {
  stopTimer();
  if (state.run && !state.run.done) state = { ...state, run: { ...state.run, playing: false } };
}

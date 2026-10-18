// Lab UI: drag two archetypes into the arena, watch them talk, get a game-theory verdict, build a "who beats whom" matrix.

import { ARCHETYPES, ARCHETYPE_IDS } from './archetypes.js';
import { LAB_TURNS, SCENARIOS, SCENARIO_IDS, MOTIVES, OUTCOMES, PERSONA_NAMES } from './lab-data.js';
import { h, mount, store, api, media } from './ui.js';

const HISTORY_KEY = 'lab-history';
const HISTORY_LIMIT = 200;

/** @type {{a: string|null, b: string|null, scenario: string, run: any}} */
let state = { a: null, b: null, scenario: SCENARIO_IDS[0], run: null };
let runToken = 0;

const isArchetype = (id) => typeof id === 'string' && Object.hasOwn(ARCHETYPES, id);
let stickToBottom = true;

const isRunning = () => state.run?.status === 'running' || state.run?.status === 'judging';
const firstName = (id) => PERSONA_NAMES[id] ?? ARCHETYPES[id].name;


function loadHistory() {
  const list = store.get(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && isArchetype(r.a) && isArchetype(r.b)) : [];
}

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

/* ---------- picking ---------- */

function place(id, slot) {
  if (isRunning()) return;
  const other = slot === 'a' ? 'b' : 'a';
  const patch = { [slot]: id, run: null };
  if (state[other] === id) patch[other] = state[slot]; // dropping onto the other slot's character swaps them
  setState(patch);
}

function pick(id) {
  if (isRunning()) return;
  if (state.a === id || state.b === id) return;
  if (!state.a) return place(id, 'a');
  return place(id, 'b');
}

function swap() {
  if (isRunning()) return;
  setState({ a: state.b, b: state.a, run: null });
}

/* ---------- running ---------- */

async function runExperiment(resume = false) {
  const { a, b, scenario } = state;
  if (!a || !b || a === b) return;
  const token = (runToken += 1);
  stickToBottom = true;
  const transcript = resume && state.run ? state.run.transcript : [];
  setState({ run: { transcript, status: 'running', verdict: null, error: null } });

  try {
    let lines = transcript;
    while (lines.length < LAB_TURNS) {
      const { speaker, text } = await api('/lab/turn', { a, b, scenario, transcript: lines });
      if (token !== runToken) return; // a newer run (or a stop) superseded this one
      lines = [...lines, { speaker, text }];
      setState({ run: { ...state.run, transcript: lines } });
    }
    setState({ run: { ...state.run, status: 'judging' } });
    const verdict = await api('/lab/verdict', { a, b, scenario, transcript: lines });
    if (token !== runToken) return;
    saveResult({ a, b, scenario, verdict });
    setState({ run: { ...state.run, status: 'done', verdict } });
  } catch (err) {
    if (token !== runToken) return;
    setState({ run: { ...state.run, status: 'error', error: err.message } });
  }
}

function stop() {
  runToken += 1;
  if (state.run) setState({ run: { ...state.run, status: 'stopped' } });
}

function saveResult({ a, b, scenario, verdict }) {
  const entry = {
    a, b, scenario,
    winner: verdict.winner, outcome: verdict.outcome, scoreA: verdict.scoreA, scoreB: verdict.scoreB,
    title: verdict.title, at: Date.now(),
  };
  store.set(HISTORY_KEY, [entry, ...loadHistory()].slice(0, HISTORY_LIMIT));
}

/* ---------- view ---------- */

function slotView(slot) {
  const id = state[slot];
  const label = slot === 'a' ? 'Игрок A · начинает' : 'Игрок B';
  const el = h('div', {
    class: `slot ${id ? 'is-filled' : ''}`,
    attrs: { 'aria-label': label },
    on: {
      dragover: (e) => { e.preventDefault(); el.classList.add('is-over'); },
      dragleave: () => el.classList.remove('is-over'),
      drop: (e) => {
        e.preventDefault();
        const dropped = e.dataTransfer?.getData('text/plain');
        if (isArchetype(dropped)) place(dropped, slot);
      },
    },
  }, id
    ? [
      media(id, 'media-slot'),
      h('div', { class: 'slot-body' }, [
        h('span', { class: 'eyebrow', text: label }),
        h('h3', { text: `${firstName(id)} · ${ARCHETYPES[id].name}` }),
        h('p', { class: 'slot-motive', text: `Хочет: ${MOTIVES[id]}` }),
        !isRunning() && h('button', { class: 'back', text: 'Убрать', on: { click: () => setState({ [slot]: null, run: null }) } }),
      ]),
    ]
    : [h('div', { class: 'slot-empty' }, [h('span', { class: 'eyebrow', text: label }), h('p', { text: 'Перетащите сюда персонажа или нажмите на него ниже' })])]);
  return el;
}

function rosterView() {
  return h('div', { class: 'roster' }, ARCHETYPE_IDS.map((id) => {
    const taken = state.a === id || state.b === id;
    return h('button', {
      class: `roster-item ${taken ? 'is-taken' : ''}`,
      attrs: { draggable: 'true', title: ARCHETYPES[id].name, ...(taken || isRunning() ? { disabled: '' } : {}) },
      on: {
        click: () => pick(id),
        dragstart: (e) => e.dataTransfer?.setData('text/plain', id),
      },
    }, [media(id, 'media-icon'), h('span', { text: ARCHETYPES[id].name })]);
  }));
}

function scenarioView() {
  return h('div', { class: 'chips' }, SCENARIO_IDS.map((sid) => h('button', {
    class: `chip ${state.scenario === sid ? 'is-active' : ''}`,
    text: `${SCENARIOS[sid].emoji} ${SCENARIOS[sid].title}`,
    attrs: isRunning() ? { disabled: '' } : {},
    on: { click: () => setState({ scenario: sid, run: null }) },
  })));
}

function chatView() {
  const { run, a, b } = state;
  const chat = h('div', { class: 'chat lab-chat', attrs: { 'aria-live': 'polite' } }, run.transcript.map((l) => {
    const id = l.speaker === 'a' ? a : b;
    return h('div', { class: `lab-line lab-${l.speaker}` }, [
      media(id, 'media-sm'),
      h('div', { class: 'msg' }, [h('strong', { text: firstName(id) }), h('span', { text: l.text })]),
    ]);
  }));
  if (run.status === 'running') {
    const next = run.transcript.length % 2 === 0 ? a : b;
    chat.append(h('div', { class: 'msg msg-typing', text: `${firstName(next)} печатает…` }));
  }
  if (run.status === 'judging') chat.append(h('div', { class: 'msg msg-typing', text: 'Аналитик подводит итог…' }));
  // Follow new lines only if the reader was already at the bottom; otherwise keep their place.
  const previous = document.querySelector('.lab-chat');
  const keepAt = previous && !stickToBottom ? previous.scrollTop : null;
  chat.addEventListener('scroll', () => {
    stickToBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 48;
  });
  requestAnimationFrame(() => { chat.scrollTop = keepAt ?? chat.scrollHeight; });
  return chat;
}

function scoreRow(id, score, isWinner) {
  return h('div', { class: `score ${isWinner ? 'is-winner' : ''}` }, [
    media(id, 'media-sm'),
    h('div', { class: 'score-body' }, [
      h('div', { class: 'score-head' }, [h('strong', { text: `${firstName(id)} · ${ARCHETYPES[id].name}` }), h('span', { text: `${score}/10` })]),
      h('div', { class: 'bar-track' }, [h('div', { class: 'bar-fill', vars: { width: `${score * 10}%`, background: ARCHETYPES[id].color } })]),
    ]),
  ]);
}

function list(title, items) {
  return items.length ? h('div', {}, [h('h4', { text: title }), h('ul', { class: 'list' }, items.map((t) => h('li', { text: t })))]) : null;
}

function verdictView(v) {
  const { a, b } = state;
  const outcome = OUTCOMES[v.outcome];
  const winnerText = v.winner === 'draw' ? 'Ничья' : `Добился своего: ${firstName(v.winner === 'a' ? a : b)}`;
  return h('div', { class: 'card verdict' }, [
    h('div', { class: 'row' }, [
      h('span', { class: 'pill', text: `${outcome.emoji} ${outcome.label}` }),
      h('span', { class: 'pill', text: winnerText }),
    ]),
    h('h2', { text: v.title }),
    scoreRow(a, v.scoreA, v.winner === 'a'),
    scoreRow(b, v.scoreB, v.winner === 'b'),
    v.summary && h('p', { text: v.summary }),
    list('Ключевые моменты', v.keyMoments),
    h('div', { class: 'grid' }, [list(`Тактики: ${firstName(a)}`, v.tacticsA), list(`Тактики: ${firstName(b)}`, v.tacticsB)].filter(Boolean)),
    v.lesson && h('p', { class: 'note', text: v.lesson }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Повторить', on: { click: () => runExperiment() } }),
      h('button', { class: 'btn btn-ghost', text: 'Поменять местами и повторить', on: { click: () => { swap(); runExperiment(); } } }),
    ]),
  ]);
}

function runView() {
  const { run } = state;
  if (!run) return null;
  const progress = `Реплика ${Math.min(run.transcript.length + (run.status === 'running' ? 1 : 0), LAB_TURNS)} из ${LAB_TURNS}`;
  return h('div', { class: 'lab-run' }, [
    h('div', { class: 'row lab-run-head' }, [
      h('span', { class: 'eyebrow', text: run.status === 'done' ? 'Эксперимент завершён' : progress }),
      isRunning() && h('button', { class: 'btn btn-ghost', text: 'Остановить', on: { click: stop } }),
    ]),
    chatView(),
    run.status === 'error' && h('div', { class: 'row' }, [
      h('p', { class: 'error', text: run.error }),
      h('button', { class: 'btn btn-ghost', text: 'Продолжить', on: { click: () => runExperiment(true) } }),
    ]),
    run.status === 'stopped' && h('div', { class: 'row' }, [
      h('p', { class: 'muted', text: 'Эксперимент остановлен.' }),
      h('button', { class: 'btn btn-ghost', text: 'Продолжить', on: { click: () => runExperiment(true) } }),
    ]),
    run.verdict && verdictView(run.verdict),
  ]);
}

/** "Who beats whom" for the current scenario: row = A (opens), column = B, latest result per pair. */
function matrixView() {
  const history = loadHistory().filter((r) => r.scenario === state.scenario);
  if (history.length === 0) {
    return h('p', { class: 'muted small', text: 'Здесь появится матрица «кто кого»: результаты ваших экспериментов в выбранном сценарии.' });
  }
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
        text: r ? `${r.scoreA}:${r.scoreB}` : '',
        attrs: { title: r ? `${ARCHETYPES[rowId].name} vs ${ARCHETYPES[colId].name}: ${r.title}` : `${ARCHETYPES[rowId].name} vs ${ARCHETYPES[colId].name}` },
        on: { click: () => { if (!isRunning()) setState({ a: rowId, b: colId, run: null }); } },
      });
    }),
  ]));
  return h('div', {}, [
    h('div', { class: 'matrix-wrap' }, [h('table', { class: 'matrix' }, [h('thead', {}, [head]), h('tbody', {}, rows)])]),
    h('p', { class: 'muted small', text: 'Счёт — насколько каждый достиг своей цели (A:B). Цвет: строка выиграла · столбец выиграл · ничья. Нажмите на клетку, чтобы поставить эту пару.' }),
  ]);
}

function render() {
  const ready = state.a && state.b && state.a !== state.b;
  mount(
    'lab-body',
    h('span', { class: 'eyebrow', text: 'Теория игр · эксперимент' }),
    h('h1', { class: 'display', text: 'Кто кого?' }),
    h('p', { class: 'lead', text: 'Сведите двух персонажей и посмотрите, чем кончится их общение. У каждого скрытый мотив — его «выигрыш». ИИ-аналитик решит, кто добился своего.' }),
    h('div', { class: 'arena' }, [slotView('a'), h('div', { class: 'vs', text: 'vs' }), slotView('b')]),
    rosterView(),
    h('h3', { text: 'Стадия отношений' }),
    scenarioView(),
    h('p', { class: 'muted small', text: SCENARIOS[state.scenario].setting }),
    h('div', { class: 'row' }, [
      h('button', {
        class: 'btn btn-primary',
        text: 'Запустить эксперимент',
        attrs: !ready || isRunning() ? { disabled: '' } : {},
        on: { click: () => runExperiment() },
      }),
      h('button', { class: 'btn btn-ghost', text: '⇄ Поменять местами', attrs: !ready || isRunning() ? { disabled: '' } : {}, on: { click: swap } }),
    ]),
    runView(),
    h('h2', { text: 'Матрица «кто кого»' }),
    matrixView(),
  );
}

/** @param {string} [presetId] - archetype to put into slot A */
export function renderLab(presetId) {
  if (isArchetype(presetId) && !isRunning()) state = { ...state, a: presetId, b: state.b === presetId ? null : state.b, run: null };
  render();
}

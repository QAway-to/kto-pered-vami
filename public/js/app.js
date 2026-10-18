import { ARCHETYPES, ARCHETYPE_IDS, archetypeImage } from './archetypes.js';
import { QUESTIONS, LIKERT, DIMENSIONS, DIM_KEYS, scoreDimensions, rankArchetypes } from './quiz.js';
import { CASES } from './cases.js';

/* ---------- helpers ---------- */

/**
 * Tiny DOM builder. Text is always set via textContent (no innerHTML → no XSS).
 * @param {string} tag
 * @param {{class?: string, text?: string, vars?: Record<string,string>, on?: Record<string, EventListener>, attrs?: Record<string,string>}} [props]
 * @param {(Node|string|null|false|undefined)[]} [children]
 */
function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text != null) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.vars ?? {})) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(props.on ?? {})) el.addEventListener(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

function mount(id, ...nodes) {
  document.getElementById(id).replaceChildren(...nodes.filter(Boolean));
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(`kpv4:${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(`kpv4:${key}`, JSON.stringify(value)); } catch { /* storage unavailable: non-critical */ }
  },
};

async function api(path, body) {
  const res = await fetch(`/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { throw new Error('Сервер вернул некорректный ответ'); }
  if (!json.success) throw new Error(json.error || 'Ошибка запроса');
  return json.data;
}

/** Archetype artwork: generated image when available, emoji on a tinted gradient otherwise. */
function media(id, size = '') {
  const a = ARCHETYPES[id];
  const src = archetypeImage(id);
  return h('div', { class: `media ${size}`, vars: { '--c': a.color } }, [
    src
      ? h('img', { attrs: { src, alt: a.name, loading: 'lazy' } })
      : h('span', { class: 'media-emoji', text: a.emoji, attrs: { 'aria-hidden': 'true' } }),
  ]);
}

function chip(id) {
  const a = ARCHETYPES[id];
  return `${a.emoji} ${a.name}`;
}

/** Saved test result, or null if missing or made with archetypes that no longer exist. */
function loadResult() {
  const r = store.get('result', null);
  return r?.ranked?.every((x) => x.id in ARCHETYPES) ? r : null;
}

/* ---------- Telegram Mini App ---------- */

const tg = window.Telegram?.WebApp;
if (tg && tg.initData !== undefined) {
  tg.ready();
  tg.expand();
  if (tg.colorScheme === 'dark') document.documentElement.dataset.theme = 'dark';
}

/* ---------- navigation ---------- */

const renderers = { home: renderHome, type: renderType, test: renderTest, cases: renderCases, dialog: renderDialog };

function go(tab, arg) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${tab}`));
  renderers[tab](arg);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------- home: archetype cards ---------- */

function renderHome() {
  const my = loadResult();
  const cases = store.get('cases', { right: 0, total: 0 });
  const dialogs = store.get('dialogs', { right: 0, total: 0 });
  mount(
    'stats',
    h('span', { class: 'pill', text: my ? `Вам ближе: ${chip(my.ranked[0].id)}` : 'Тест ещё не пройден' }),
    h('span', { class: 'pill', text: `Красные флаги: ${cases.right}/${cases.total}` }),
    h('span', { class: 'pill', text: `Тренажёр: ${dialogs.right}/${dialogs.total}` }),
  );
  mount('archetype-grid', ...ARCHETYPE_IDS.map((id) => {
    const a = ARCHETYPES[id];
    return h('button', { class: 'arch-card', on: { click: () => go('type', id) }, attrs: { 'aria-label': a.name } }, [
      media(id),
      h('div', { class: 'arch-body' }, [
        h('h3', { text: a.name }),
        h('span', { class: 'arch-aka', text: a.aka }),
        h('p', { class: 'arch-tagline', text: a.tagline }),
        h('span', { class: 'arch-construct', text: a.construct }),
      ]),
    ]);
  }));
}

/* ---------- archetype detail ---------- */

function list(items) {
  return h('ul', { class: 'list' }, items.map((t) => h('li', { text: t })));
}

function renderType(id) {
  const a = ARCHETYPES[id];
  mount(
    'type-body',
    h('button', { class: 'back', text: '← Все архетипы', on: { click: () => go('home') } }),
    h('div', { class: 'type-hero' }, [
      media(id, 'media-lg'),
      h('div', {}, [
        h('span', { class: 'eyebrow', text: a.construct }),
        h('h1', { class: 'display', text: a.name }),
        h('p', { class: 'aka', text: `В соцсетях: ${a.aka}` }),
        h('p', { class: 'lead', text: a.tagline }),
        h('div', { class: 'row' }, [
          h('button', { class: 'btn btn-primary', text: `Потренироваться с ним`, on: { click: () => go('dialog', id) } }),
          h('button', { class: 'btn btn-ghost', text: 'Пройти тест', on: { click: () => go('test') } }),
        ]),
      ]),
    ]),
    h('div', { class: 'card' }, [h('h3', { text: 'Научная основа' }), h('p', { text: a.science })]),
    h('div', { class: 'grid' }, [
      h('div', { class: 'card' }, [h('h3', { text: 'Как распознать' }), list(a.signs)]),
      h('div', { class: 'card' }, [h('h3', { text: a.flagsTitle ?? 'Красные флаги' }), list(a.flags)]),
    ]),
    h('div', { class: 'card card-dark' }, [h('h3', { text: 'Как общаться' }), h('p', { text: a.howTo })]),
    a.clinical && h('p', { class: 'note', text: 'Это описание паттерна, а не диагноз. Если вы узнаёте себя и это мешает жить, поговорите с психологом или психотерапевтом: эмоциональная нестабильность хорошо поддаётся терапии (например, ДБТ).' }),
    h('div', { class: 'refs' }, [h('h3', { text: 'Источники' }), h('ol', {}, a.refs.map((r) => h('li', { text: r })))]),
  );
}

/* ---------- self test ---------- */

let testState = null;

function renderTest() {
  if (!testState) {
    const saved = loadResult();
    if (saved) return renderTestResult(saved);
    testState = { i: 0, answers: [] };
  }
  const { i } = testState;
  const q = QUESTIONS[i];
  mount(
    'test-body',
    h('span', { class: 'eyebrow', text: `Вопрос ${i + 1} из ${QUESTIONS.length}` }),
    h('div', { class: 'progress' }, [h('span', { vars: { width: `${(i / QUESTIONS.length) * 100}%` } })]),
    h('p', { class: 'question', text: q.text }),
    h('div', { class: 'options' }, LIKERT.map((label, idx) => h('button', {
      class: 'option',
      text: label,
      on: { click: () => answerTest(idx + 1) },
    }))),
    i > 0 && h('button', { class: 'back', text: '← Назад', on: { click: () => { testState = { i: i - 1, answers: testState.answers.slice(0, -1) }; renderTest(); } } }),
  );
}

function answerTest(value) {
  testState = { i: testState.i + 1, answers: [...testState.answers, value] };
  if (testState.i < QUESTIONS.length) return renderTest();
  const dims = scoreDimensions(testState.answers);
  const result = { dims, ranked: rankArchetypes(dims) };
  store.set('result', result);
  testState = null;
  return renderTestResult(result);
}

function renderTestResult(result) {
  const [top, ...rest] = result.ranked;
  const a = ARCHETYPES[top.id];
  const showHelp = Boolean(a.clinical) || result.dims.EMO >= 0.75;
  mount(
    'test-body',
    h('div', { class: 'result-hero' }, [
      media(top.id, 'media-lg'),
      h('div', {}, [
        h('span', { class: 'eyebrow', text: `Ваш стиль ближе всего к · ${top.match}%` }),
        h('h1', { class: 'display', text: a.name }),
        h('p', { text: a.tagline }),
        h('p', { class: 'small', text: 'Это описание стиля поведения по результатам скрининга, а не диагноз и не оценка вас как человека.' }),
        h('button', { class: 'btn btn-primary', text: 'Подробнее об архетипе', on: { click: () => go('type', top.id) } }),
      ]),
    ]),
    h('h2', { text: 'Также близки' }),
    h('div', { class: 'row' }, rest.slice(0, 3).map((r) => h('button', {
      class: 'pill pill-link',
      text: `${chip(r.id)} · ${r.match}%`,
      on: { click: () => go('type', r.id) },
    }))),
    h('h2', { text: 'Ваш профиль' }),
    h('div', { class: 'bars' }, DIM_KEYS.map((k) => {
      const pct = Math.round(result.dims[k] * 100);
      return h('div', { class: 'bar' }, [
        h('span', { text: DIMENSIONS[k] }),
        h('div', { class: 'bar-track' }, [h('div', { class: 'bar-fill', vars: { width: `${pct}%` } })]),
        h('span', { class: 'muted', text: `${pct}%` }),
      ]);
    })),
    showHelp && h('p', { class: 'note', text: 'У вас выражены эмоциональные перепады. Это не диагноз, но если они мешают жить и отношениям, стоит поговорить с психологом или психотерапевтом.' }),
    h('p', { class: 'muted small', text: 'Скрининг из 26 утверждений по 13 научным конструктам. Это не клиническая диагностика: результат показывает выраженность черт сегодня, а не ярлык навсегда.' }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Тренироваться на красных флагах', on: { click: () => go('cases') } }),
      h('button', { class: 'btn btn-ghost', text: 'Пройти заново', on: { click: () => { store.set('result', null); testState = null; renderTest(); } } }),
    ]),
  );
}

/* ---------- red-flag cases ---------- */

let caseQueue = [];

function renderCases() {
  if (caseQueue.length === 0) caseQueue = shuffle(CASES);
  const c = caseQueue[0];
  const score = store.get('cases', { right: 0, total: 0 });
  const options = shuffle([c.answer, ...shuffle(ARCHETYPE_IDS.filter((id) => id !== c.answer)).slice(0, 3)]);
  const explain = h('div');
  const buttons = options.map((id) => h('button', { class: 'option', text: chip(id), on: { click: () => pick(id) } }));

  function pick(id) {
    const isRight = id === c.answer;
    buttons.forEach((b, idx) => {
      b.disabled = true;
      if (options[idx] === c.answer) b.classList.add('is-right');
      else if (options[idx] === id) b.classList.add('is-wrong');
    });
    store.set('cases', { right: score.right + (isRight ? 1 : 0), total: score.total + 1 });
    explain.replaceChildren(h('div', { class: 'explain' }, [
      h('h3', { text: isRight ? 'Верно!' : `Это ${chip(c.answer)}` }),
      h('p', { text: c.why }),
      h('p', { class: 'muted', text: `Как общаться: ${ARCHETYPES[c.answer].howTo}` }),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn btn-primary', text: 'Следующий кейс', on: { click: () => { caseQueue = caseQueue.slice(1); renderCases(); } } }),
        h('button', { class: 'btn btn-ghost', text: 'Об архетипе', on: { click: () => go('type', c.answer) } }),
      ]),
    ]));
  }

  mount(
    'cases-body',
    h('span', { class: 'eyebrow', text: `Кто перед вами? · счёт ${score.right}/${score.total}` }),
    h('p', { class: 'question', text: c.text }),
    h('div', { class: 'options' }, buttons),
    explain,
  );
}

/* ---------- dialog trainer ---------- */

let dialog = null;
let startToken = 0;

/** @param {string} [personaId] - known archetype; omitted = hidden random one */
async function startDialog(personaId) {
  dialog = null;
  mount('dialog-body', h('p', { class: 'muted', text: 'Ищем собеседника…' }));
  try {
    const token = (startToken += 1);
    const p = await api(`/persona/${personaId ?? 'random'}`);
    if (token !== startToken) return; // a newer dialog was started meanwhile
    dialog = { persona: p, known: Boolean(personaId), messages: [{ role: 'assistant', content: p.opening }], busy: false, done: false };
    renderDialog();
  } catch (err) {
    if (token === startToken) mount('dialog-body', h('p', { class: 'error', text: err.message }));
  }
}

function renderDialog(personaId) {
  if (typeof personaId === 'string') {
    startDialog(personaId);
    return;
  }
  if (!dialog) {
    mount(
      'dialog-body',
      h('span', { class: 'eyebrow', text: 'Главная тренировка' }),
      h('h1', { class: 'display', text: 'Договоритесь с незнакомцем' }),
      h('p', { class: 'lead', text: 'Вам достанется случайный участник сообщества со скрытым архетипом. Предложите ему совместный проект, держите границы и не поддавайтесь на манипуляции. Затем угадайте архетип и получите разбор от ИИ-тренера.' }),
      h('button', { class: 'btn btn-primary', text: 'Случайный собеседник', on: { click: () => startDialog() } }),
    );
    return;
  }

  const { persona } = dialog;
  const chat = h('div', { class: 'chat', attrs: { 'aria-live': 'polite' } }, dialog.messages.map((m) => h('div', {
    class: `msg ${m.role === 'user' ? 'msg-me' : 'msg-them'}`,
    text: m.content,
  })));
  if (dialog.busy) chat.append(h('div', { class: 'msg msg-them msg-typing', text: `${persona.name} печатает…` }));

  const input = h('textarea', { attrs: { placeholder: 'Ваша реплика…', maxlength: '1000', rows: '1' } });
  input.value = dialog.draft ?? '';
  const send = h('button', { class: 'btn btn-primary', text: 'Отправить', on: { click: () => sendMessage(input.value) } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input.value); }
  });
  input.disabled = dialog.busy || dialog.done;
  send.disabled = dialog.busy || dialog.done;

  const userTurns = dialog.messages.filter((m) => m.role === 'user').length;
  const locked = userTurns < 3 || dialog.busy || dialog.done;
  const finish = dialog.known
    ? h('div', { class: 'guess' }, [
      h('h3', { text: userTurns < 3 ? 'Сделайте хотя бы 3 реплики, затем получите разбор' : 'Готовы к разбору?' }),
      h('button', { class: 'btn btn-ghost', text: 'Получить разбор', on: { click: () => finishDialog(persona.personaId) }, attrs: locked ? { disabled: '' } : {} }),
    ])
    : h('div', { class: 'guess' }, [
      h('h3', { text: userTurns < 3 ? 'Сделайте хотя бы 3 реплики, затем угадайте архетип' : 'Кто перед вами?' }),
      h('div', { class: 'chips' }, ARCHETYPE_IDS.map((id) => h('button', {
        class: 'chip',
        text: chip(id),
        on: { click: () => finishDialog(id) },
        attrs: locked ? { disabled: '' } : {},
      }))),
    ]);

  mount(
    'dialog-body',
    h('div', { class: 'persona' }, [
      dialog.known ? media(persona.personaId, 'media-sm') : h('div', { class: 'avatar', text: persona.name[0] }),
      h('div', {}, [
        h('h3', { text: dialog.known ? `${persona.name} · ${ARCHETYPES[persona.personaId].name}` : persona.name }),
        h('p', { class: 'muted', text: persona.intro }),
      ]),
    ]),
    chat,
    h('div', { class: 'composer' }, [input, send]),
    dialog.error && h('p', { class: 'error', text: dialog.error }),
    dialog.result ? renderDebrief(dialog.result) : finish,
  );
  chat.scrollTop = chat.scrollHeight;
  if (!input.disabled) input.focus();
}

async function sendMessage(raw) {
  const text = raw.trim();
  if (!text || dialog.busy || dialog.done) return;
  const messages = [...dialog.messages, { role: 'user', content: text }];
  dialog = { ...dialog, messages, busy: true, error: null, draft: '' };
  const current = dialog;
  renderDialog();
  try {
    const { reply } = await api('/chat', { personaId: current.persona.personaId, messages });
    if (dialog !== current) return; // user moved on to another dialog
    dialog = { ...dialog, messages: [...messages, { role: 'assistant', content: reply }], busy: false };
  } catch (err) {
    if (dialog !== current) return;
    // Roll back the unanswered turn so roles keep alternating.
    dialog = { ...dialog, messages: messages.slice(0, -1), busy: false, error: err.message, draft: text };
  }
  renderDialog();
}

async function finishDialog(guessId) {
  dialog = { ...dialog, busy: true, error: null };
  const current = dialog;
  renderDialog();
  try {
    const result = await api('/debrief', {
      personaId: current.persona.personaId,
      messages: current.messages,
      guess: guessId,
      known: current.known,
    });
    if (dialog !== current) return;
    if (!dialog.known) {
      const stats = store.get('dialogs', { right: 0, total: 0 });
      store.set('dialogs', { right: stats.right + (result.correct ? 1 : 0), total: stats.total + 1 });
    }
    dialog = { ...dialog, busy: false, done: true, result };
  } catch (err) {
    if (dialog !== current) return;
    dialog = { ...dialog, busy: false, error: err.message };
  }
  renderDialog();
}

function renderDebrief(result) {
  const a = ARCHETYPES[result.actual];
  const verdict = dialog.known ? 'Разбор' : result.correct ? 'Вы угадали' : 'Мимо';
  return h('div', { class: 'card debrief' }, [
    h('span', { class: 'eyebrow', text: verdict }),
    h('h3', { text: `${dialog.persona.name} — ${chip(result.actual)}` }),
    h('p', { class: 'feedback', text: result.feedback }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Новый собеседник', on: { click: () => startDialog() } }),
      h('button', { class: 'btn btn-ghost', text: `Об архетипе «${a.name}»`, on: { click: () => go('type', result.actual) } }),
    ]),
  ]);
}

renderHome();

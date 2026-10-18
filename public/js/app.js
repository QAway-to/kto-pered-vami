import { TYPES, TYPE_KEYS, QUESTIONS, scoreAnswers } from './disc.js';
import { CASES } from './cases.js';

/* ---------- helpers ---------- */

/**
 * Tiny DOM builder. Text is always set via textContent (no innerHTML → no XSS).
 * @param {string} tag
 * @param {{class?: string, text?: string, vars?: Record<string,string>, on?: Record<string, EventListener>, attrs?: Record<string,string>}} [props]
 * @param {(Node|string|null|false)[]} [children]
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
  const root = document.getElementById(id);
  root.replaceChildren(...nodes);
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
      const raw = localStorage.getItem(`kpv:${key}`);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(`kpv:${key}`, JSON.stringify(value)); } catch { /* storage unavailable: non-critical */ }
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

/* ---------- Telegram Mini App ---------- */

const tg = window.Telegram?.WebApp;
if (tg && tg.initData !== undefined) {
  tg.ready();
  tg.expand();
  if (tg.colorScheme === 'dark') document.documentElement.dataset.theme = 'dark';
}

/* ---------- navigation ---------- */

const renderers = { home: renderHome, test: renderTest, cases: renderCases, dialog: renderDialog };

function go(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${tab}`));
  renderers[tab]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------- home ---------- */

function renderHome() {
  const myType = store.get('myType', null);
  const cases = store.get('cases', { right: 0, total: 0 });
  const dialogs = store.get('dialogs', { right: 0, total: 0 });
  mount(
    'stats',
    h('span', { class: 'pill', text: myType ? `Ваш тип: ${myType} · ${TYPES[myType].name}` : 'Тип ещё не определён' }),
    h('span', { class: 'pill', text: `Кейсы: ${cases.right}/${cases.total}` }),
    h('span', { class: 'pill', text: `Диалоги: ${dialogs.right}/${dialogs.total}` }),
  );
  mount(
    'types',
    ...TYPE_KEYS.map((k) => h('div', { class: 'card type-card', vars: { '--c': TYPES[k].color } }, [
      h('div', { class: 'letter', text: k }),
      h('h3', { text: TYPES[k].name }),
      h('p', { class: 'muted', text: TYPES[k].about }),
    ])),
  );
}

/* ---------- self test ---------- */

let testState = null;

function renderTest() {
  if (!testState) {
    const saved = store.get('myResult', null);
    if (saved) return renderTestResult(saved);
    testState = { i: 0, answers: [], order: QUESTIONS.map(() => shuffle(TYPE_KEYS)) };
  }
  const { i } = testState;
  const q = QUESTIONS[i];
  mount(
    'test-body',
    h('span', { class: 'eyebrow', text: `Вопрос ${i + 1} из ${QUESTIONS.length}` }),
    h('div', { class: 'progress' }, [h('span', { vars: { width: `${(i / QUESTIONS.length) * 100}%` } })]),
    h('p', { class: 'question', text: q.q }),
    h('div', { class: 'options' }, testState.order[i].map((key) => h('button', {
      class: 'option',
      text: q.a[key],
      on: { click: () => answerTest(key) },
    }))),
  );
}

function answerTest(key) {
  testState = { ...testState, i: testState.i + 1, answers: [...testState.answers, key] };
  if (testState.i < QUESTIONS.length) return renderTest();
  const result = scoreAnswers(testState.answers);
  store.set('myResult', result);
  store.set('myType', result.primary);
  testState = null;
  return renderTestResult(result);
}

function renderTestResult(result) {
  const t = TYPES[result.primary];
  mount(
    'test-body',
    h('div', { class: 'result-hero' }, [
      h('span', { class: 'eyebrow', text: 'Ваш ведущий стиль' }),
      h('h1', { class: 'display', text: `${result.primary} — ${t.name}` }),
      h('p', { text: t.about }),
      result.secondary && h('p', { text: `Второй по силе: ${result.secondary} — ${TYPES[result.secondary].name}.` }),
    ]),
    h('div', { class: 'bars' }, TYPE_KEYS.map((k) => h('div', { class: 'bar' }, [
      h('span', { text: `${k} · ${TYPES[k].name}` }),
      h('div', { class: 'bar-track' }, [h('div', { class: 'bar-fill', vars: { width: `${result.percents[k]}%`, '--c': TYPES[k].color } })]),
      h('span', { class: 'muted', text: `${result.percents[k]}%` }),
    ]))),
    h('div', { class: 'card' }, [
      h('h3', { text: 'Как с вами лучше общаться' }),
      h('p', { text: t.howToTalk }),
    ]),
    h('div', { class: 'row', vars: { 'margin-top': '20px' } }, [
      h('button', { class: 'btn btn-primary', text: 'Тренироваться на кейсах', on: { click: () => go('cases') } }),
      h('button', {
        class: 'btn btn-ghost',
        text: 'Пройти заново',
        on: { click: () => { store.set('myResult', null); testState = null; renderTest(); } },
      }),
    ]),
  );
}

/* ---------- cases ---------- */

let caseQueue = [];

function renderCases() {
  if (caseQueue.length === 0) caseQueue = shuffle(CASES);
  const c = caseQueue[0];
  const score = store.get('cases', { right: 0, total: 0 });
  const explain = h('div');
  const buttons = TYPE_KEYS.map((k) => h('button', {
    class: 'option',
    text: `${k} · ${TYPES[k].name}`,
    on: { click: () => pick(k) },
  }));

  function pick(k) {
    const isRight = k === c.answer;
    buttons.forEach((b, idx) => {
      b.disabled = true;
      if (TYPE_KEYS[idx] === c.answer) b.classList.add('is-right');
      else if (TYPE_KEYS[idx] === k) b.classList.add('is-wrong');
    });
    store.set('cases', { right: score.right + (isRight ? 1 : 0), total: score.total + 1 });
    explain.replaceChildren(h('div', { class: 'explain' }, [
      h('h3', { text: isRight ? 'Верно!' : `Это ${c.answer} — ${TYPES[c.answer].name}` }),
      h('p', { text: c.why }),
      h('p', { class: 'muted', text: `Как говорить: ${TYPES[c.answer].howToTalk}` }),
      h('button', {
        class: 'btn btn-primary',
        text: 'Следующий кейс',
        on: { click: () => { caseQueue = caseQueue.slice(1); renderCases(); } },
      }),
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

/* ---------- dialog ---------- */

let dialog = null;

async function startDialog() {
  mount('dialog-body', h('p', { class: 'muted', text: 'Ищем собеседника…' }));
  try {
    const p = await api('/persona/random');
    dialog = { persona: p, messages: [{ role: 'assistant', content: p.opening }], busy: false, done: false };
    renderDialog();
  } catch (err) {
    mount('dialog-body', h('p', { class: 'error', text: err.message }));
  }
}

function renderDialog() {
  if (!dialog) {
    mount(
      'dialog-body',
      h('span', { class: 'eyebrow', text: 'Главная тренировка' }),
      h('h1', { class: 'display', text: 'Договоритесь с незнакомцем' }),
      h('p', { class: 'lead', text: 'Вам достанется случайный собеседник из сообщества со скрытым типом. Ваша задача — предложить ему совместный проект и получить «да». Подстраивайтесь под его стиль. В конце угадайте тип и получите разбор.' }),
      h('button', { class: 'btn btn-primary', text: 'Начать диалог', on: { click: startDialog } }),
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
  const guess = h('div', { class: 'guess' }, [
    h('h3', { text: userTurns < 3 ? 'Сделайте хотя бы 3 реплики, затем угадайте тип' : 'Готовы? Кто перед вами?' }),
    h('div', { class: 'row' }, TYPE_KEYS.map((k) => h('button', {
      class: 'btn btn-ghost',
      text: `${k} · ${TYPES[k].name}`,
      on: { click: () => finishDialog(k) },
      attrs: userTurns < 3 || dialog.busy || dialog.done ? { disabled: '' } : {},
    }))),
  ]);

  mount(
    'dialog-body',
    h('div', { class: 'persona' }, [
      h('div', { class: 'avatar', text: persona.name[0] }),
      h('div', {}, [h('h3', { text: persona.name }), h('p', { class: 'muted', text: persona.intro })]),
    ]),
    chat,
    h('div', { class: 'composer' }, [input, send]),
    dialog.error && h('p', { class: 'error', text: dialog.error }),
    dialog.result ? renderDebrief(dialog.result) : guess,
  );
  chat.scrollTop = chat.scrollHeight;
  if (!input.disabled) input.focus();
}

async function sendMessage(raw) {
  const text = raw.trim();
  if (!text || dialog.busy || dialog.done) return;
  const messages = [...dialog.messages, { role: 'user', content: text }];
  dialog = { ...dialog, messages, busy: true, error: null, draft: '' };
  renderDialog();
  try {
    const { reply } = await api('/chat', { personaId: dialog.persona.personaId, messages });
    dialog = { ...dialog, messages: [...messages, { role: 'assistant', content: reply }], busy: false };
  } catch (err) {
    // Roll back the unanswered turn so roles keep alternating.
    dialog = { ...dialog, messages: messages.slice(0, -1), busy: false, error: err.message, draft: text };
  }
  renderDialog();
}

async function finishDialog(guessKey) {
  dialog = { ...dialog, busy: true, error: null };
  renderDialog();
  try {
    const result = await api('/debrief', { personaId: dialog.persona.personaId, messages: dialog.messages, guess: guessKey });
    const stats = store.get('dialogs', { right: 0, total: 0 });
    store.set('dialogs', { right: stats.right + (result.correct ? 1 : 0), total: stats.total + 1 });
    dialog = { ...dialog, busy: false, done: true, result };
  } catch (err) {
    dialog = { ...dialog, busy: false, error: err.message };
  }
  renderDialog();
}

function renderDebrief(result) {
  const t = TYPES[result.actual];
  return h('div', { class: 'card', vars: { 'margin-top': '20px' } }, [
    h('span', { class: 'eyebrow', text: result.correct ? 'Вы угадали' : 'Мимо' }),
    h('h3', { text: `${dialog.persona.name} — ${result.actual} · ${t.name}` }),
    h('p', { class: 'feedback', text: result.feedback }),
    h('div', { class: 'row', vars: { 'margin-top': '16px' } }, [
      h('button', { class: 'btn btn-primary', text: 'Новый собеседник', on: { click: startDialog } }),
    ]),
  ]);
}

renderHome();

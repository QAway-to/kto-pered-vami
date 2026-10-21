import { ARCHETYPES, ARCHETYPE_IDS, ARCHETYPE_SLUGS, LAYERS, TRAIT_DEFINITIONS, TRAIT_KEYS } from './archetypes.js';
import { QUESTIONS, LIKERT, DIMENSIONS, DIM_KEYS, scoreDimensions, rankArchetypes } from './quiz.js';
import { CASES } from './cases.js';
import { h, mount, shuffle, store, api, media, chip, sceneChips, introCard, formatSpeech, isAuthError } from './ui.js';
import { initAuth } from './auth.js';
import { SCENARIO_IDS, SCENARIOS, randomIntro } from './lab-data.js';
import { renderArena } from './arena.js';
import { track } from './track.js';
import { SKILL_AXES, SKILL_KEYS, overall, level } from './skill.js';

const SPAR_HISTORY_KEY = 'spar-history';
const SPAR_HISTORY_LIMIT = 100;

/** Scored sparrings, newest first; entries with a stale shape are dropped. */
function loadSparHistory() {
  const list = store.get(SPAR_HISTORY_KEY, []);
  const isScore = (v) => typeof v === 'number' && v >= 0 && v <= 10;
  return Array.isArray(list) ? list.filter((e) => SKILL_KEYS.every((k) => isScore(e?.scores?.[k]))) : [];
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

const renderers = {
  home: renderHome, type: renderType, test: renderTest, cases: renderCases, dialog: renderDialog, lab: renderArena,
};

function urlFor(tab, arg) {
  if (tab === 'home') return '/';
  if (tab === 'type' && arg) return `/${arg}`;
  if (arg) return `/${tab}/${arg}`;
  return `/${tab}`;
}

function routeFromLocation() {
  let path = '';
  try {
    path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, '').toLowerCase();
  } catch {
    path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  }
  if (!path) return { tab: 'home' };

  if (ARCHETYPE_SLUGS[path]) {
    return { tab: 'type', arg: ARCHETYPE_SLUGS[path] };
  }

  const typeMatch = path.match(/^(?:type|t)\/([^/]+)$/);
  if (typeMatch && ARCHETYPE_SLUGS[typeMatch[1]]) {
    return { tab: 'type', arg: ARCHETYPE_SLUGS[typeMatch[1]] };
  }

  const [tab, sub] = path.split('/');
  if (tab in renderers && tab !== 'home') {
    const arg = sub && ARCHETYPE_SLUGS[sub] ? ARCHETYPE_SLUGS[sub] : sub;
    return { tab, arg };
  }

  return { tab: 'home' };
}

function go(tab, arg, push = true) {
  if (!renderers[tab]) tab = 'home';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === tab));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${tab}`));

  if (push && typeof window !== 'undefined' && window.history?.pushState) {
    const targetUrl = urlFor(tab, arg);
    if (window.location.pathname !== targetUrl) {
      window.history.pushState({ tab, arg }, '', targetUrl);
    }
  }

  if (tab === 'type' && arg && ARCHETYPES[arg]) {
    document.title = `${ARCHETYPES[arg].name} — Кто перед вами?`;
  } else {
    document.title = '12 психологических архетипов — Кто перед вами?';
  }

  if (tg?.BackButton) {
    if (tab === 'home') {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
      tg.BackButton.onClick(() => go('home'));
    }
  }

  renderers[tab](arg);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('popstate', (e) => {
  const route = e.state || routeFromLocation();
  go(route.tab, route.arg, false);
});

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => go(t.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

/* ---------- home: archetype cards ---------- */

document.addEventListener('click', () => {
  document.querySelectorAll('.arch-trait-token.is-open').forEach((el) => el.classList.remove('is-open'));
});

function traitsView(traits, color) {
  if (!traits) return null;
  return h('div', { class: 'arch-trait-tokens', attrs: { role: 'list', 'aria-label': 'Психологические качества' } }, TRAIT_KEYS.map((k, idx) => {
    const def = TRAIT_DEFINITIONS[k];
    const val = traits[k] ?? 5;
    const isDom = val >= 8;
    const edgeClass = idx <= 1 ? 'is-edge-left' : (idx >= TRAIT_KEYS.length - 2 ? 'is-edge-right' : '');
    const token = h('div', {
      class: `arch-trait-token ${isDom ? 'is-dominant' : ''} ${edgeClass}`.trim(),
      vars: { '--c': color },
      attrs: {
        tabindex: '0',
        role: 'button',
        title: `${def.name}: ${val}/10 — ${def.desc}`,
        'aria-label': `${def.name}: ${val}/10. ${def.desc}`,
      },
      on: {
        click: (e) => {
          e.stopPropagation();
          e.preventDefault();
          const wasOpen = token.classList.contains('is-open');
          document.querySelectorAll('.arch-trait-token.is-open').forEach((el) => el.classList.remove('is-open'));
          if (!wasOpen) token.classList.add('is-open');
        },
      },
    }, [
      h('span', { class: 'arch-trait-abbr', text: def.abbr }),
      h('span', { class: 'arch-trait-val', text: String(val) }),
      h('div', { class: 'arch-trait-popover' }, [
        h('div', { class: 'arch-trait-popover-head' }, [
          h('strong', { text: `${def.name} · ${val}/10` }),
          isDom && h('span', { class: 'arch-dom-tag', vars: { color }, text: 'Доминанта' }),
        ].filter(Boolean)),
        h('p', { text: def.desc }),
      ]),
    ]);
    return token;
  }));
}

function renderHome() {
  const my = loadResult();
  const cases = store.get('cases', { right: 0, total: 0 });
  const dialogs = store.get('dialogs', { right: 0, total: 0 });
  const skill = level(loadSparHistory());
  mount(
    'stats',
    h('span', { class: 'pill', text: my ? `Вам ближе: ${chip(my.ranked[0].id)}` : 'Тест ещё не пройден' }),
    h('span', { class: 'pill', text: `Красные флаги: ${cases.right}/${cases.total}` }),
    h('span', { class: 'pill', text: `Профайлинг: ${dialogs.right}/${dialogs.total}` }),
    skill != null && h('span', { class: 'pill pill-accent', text: `Навык: ${skill}/10` }),
  );
  const card = (id) => {
    const a = ARCHETYPES[id];
    return h('button', { class: 'arch-card', on: { click: () => go('type', id) }, attrs: { 'aria-label': a.name } }, [
      media(id),
      h('div', { class: 'arch-body' }, [
        h('div', { class: 'arch-card-header' }, [
          h('h3', { text: a.name }),
          h('span', { class: 'arch-aka', text: a.aka }),
          a.coreTrait && h('div', { class: 'arch-core-pill' }, [
            h('span', { class: 'arch-core-label', text: 'Ядро' }),
            h('span', { class: 'arch-core-val', text: a.coreTrait }),
          ]),
        ].filter(Boolean)),
        h('div', { class: 'arch-card-main' }, [
          h('p', { class: 'arch-tagline', text: a.tagline }),
          traitsView(a.traits, a.color),
        ]),
        h('div', { class: 'arch-card-footer' }, [
          h('span', { class: 'arch-construct-label', text: 'База:' }),
          h('span', { class: 'arch-construct', text: a.construct }),
        ]),
      ]),
    ]);
  };
  mount('archetype-grid', ...Object.values(LAYERS).flatMap((layer) => [
    h('div', { class: 'arch-layer-head' }, [h('h2', { text: layer.title }), h('p', { class: 'muted', text: layer.desc })]),
    ...layer.ids.map(card),
  ]));
}

/* ---------- archetype detail ---------- */

function list(items) {
  return h('ul', { class: 'list' }, items.map((t) => h('li', { text: t })));
}

function renderType(id) {
  const a = ARCHETYPES[id];
  track('archetype_viewed', { archetype: id });
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
          h('button', { class: 'btn btn-ghost', text: 'Свести в лаборатории', on: { click: () => go('lab', id) } }),
        ]),
      ]),
    ]),
    h('div', { class: 'card arch-profile-card' }, [
      h('div', { class: 'row arch-profile-head' }, [
        h('h3', { text: 'Психологический профиль' }),
        a.coreTrait && h('div', { class: 'arch-core-badge' }, [
          h('span', { class: 'arch-core-label', text: 'Ядро характера:' }),
          h('span', { class: 'arch-core-val', text: a.coreTrait }),
        ]),
      ]),
      h('div', { class: 'arch-profile-grid' }, TRAIT_KEYS.map((k) => {
        const def = TRAIT_DEFINITIONS[k];
        const val = a.traits?.[k] ?? 5;
        const isDom = val >= 8;
        return h('div', { class: `arch-profile-item ${isDom ? 'is-dominant' : ''}` }, [
          h('div', { class: 'arch-profile-item-head' }, [
            h('div', { class: 'row arch-profile-trait-title' }, [
              h('span', { class: `arch-token-pill ${isDom ? 'is-dominant' : ''}`, vars: { '--c': a.color }, text: def.abbr }),
              h('strong', { text: def.name }),
              isDom && h('span', { class: 'arch-dom-tag', vars: { color: a.color }, text: 'Доминанта' }),
            ].filter(Boolean)),
            h('strong', { class: 'arch-profile-val', vars: { color: isDom ? a.color : 'var(--muted)' }, text: `${val}/10` }),
          ]),
          h('div', { class: 'bar-track' }, [
            h('div', { class: 'bar-fill', vars: { width: `${val * 10}%`, background: isDom ? a.color : 'var(--muted)' } }),
          ]),
          h('p', { class: 'arch-profile-desc', text: def.desc }),
        ]);
      })),
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
    track('test_started');
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
  track('test_completed', { archetype: result.ranked[0].id });
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
    track('case_answered', { correct: isRight, archetype: c.answer });
    explain.replaceChildren(h('div', { class: 'explain' }, [
      h('h3', { text: isRight ? 'Верно!' : `Это ${chip(c.answer)}` }),
      h('p', { class: 'explain-why' }, formatSpeech(c.why)),
      h('p', { class: 'muted' }, [
        h('strong', { class: 'term-label', text: 'Как общаться: ' }),
        document.createTextNode(ARCHETYPES[c.answer].howTo),
      ]),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn btn-primary', text: 'Следующий кейс', on: { click: () => { caseQueue = caseQueue.slice(1); renderCases(); } } }),
        h('button', { class: 'btn btn-ghost', text: 'Об архетипе', on: { click: () => go('type', c.answer) } }),
      ]),
    ]));
  }

  mount(
    'cases-body',
    h('span', { class: 'eyebrow', text: `Кто перед вами? · счёт ${score.right}/${score.total}` }),
    h('p', { class: 'question' }, formatSpeech(c.text)),
    h('div', { class: 'options' }, buttons),
    explain,
  );
}

/* ---------- dialog trainer ---------- */

const isPhone = () => window.matchMedia('(max-width: 560px)').matches;

let dialog = null;
let startToken = 0;
/** Scene chosen before the dialog starts; personaId null = hidden random persona. */
let setup = { personaId: null, scenario: SCENARIO_IDS[0], intro: randomIntro(SCENARIO_IDS[0]) };

// The server's training ticket rides along with every call after the opening line.
const sceneOf = (d) => ({ scenario: d.scenario, intro: d.intro, ...(d.ticket ? { ticket: d.ticket } : {}) });

/** Opens the scene: picks the persona, then asks it for its opening line. */
async function startDialog() {
  const { personaId, scenario, intro } = setup;
  const token = (startToken += 1);
  dialog = null;
  mount('dialog-body', h('p', { class: 'muted', text: 'Ищем собеседника…' }));
  try {
    const p = await api(`/persona/${personaId ?? 'random'}`);
    if (token !== startToken) return; // a newer dialog was started meanwhile
    dialog = { persona: p, known: Boolean(personaId), scenario, intro, messages: [], busy: true, done: false };
    track('spar_started', { known: dialog.known, scenario, archetype: p.personaId });
    renderDialog();
    const current = dialog;
    const { reply, ticket } = await api('/chat', { personaId: p.personaId, ...sceneOf(current), messages: [] });
    if (dialog !== current) return;
    dialog = { ...dialog, ticket, messages: [{ role: 'assistant', content: reply }], busy: false };
    renderDialog();
  } catch (err) {
    if (token !== startToken) return;
    dialog = null;
    if (isAuthError(err)) { renderSetup(); return; } // the login / subscription dialog is already open
    mount('dialog-body', h('p', { class: 'error', text: err.message }), h('button', { class: 'btn btn-ghost', text: 'Назад', on: { click: () => renderDialog() } }));
  }
}

function renderSetup() {
  const { personaId, scenario, intro } = setup;
  const known = personaId && ARCHETYPES[personaId];
  const opener = known ? ARCHETYPES[personaId].name : 'ваш собеседник';
  mount(
    'dialog-body',
    h('span', { class: 'eyebrow', text: 'Главная тренировка' }),
    h('h1', { class: 'display', text: known ? `Тренировка: ${known.name}` : 'Кто перед вами?' }),
    h('p', {
      class: 'lead',
      text: known
        ? 'Вы знаете архетип собеседника. Держите границы, подстраивайтесь и не поддавайтесь на его тактики. В конце — разбор от ИИ-тренера.'
        : 'Вам достанется собеседник со скрытым архетипом. Пройдите сцену, держите границы и не поддавайтесь на манипуляции. Затем угадайте архетип и получите разбор от ИИ-тренера.',
    }),
    known && h('div', { class: 'persona' }, [media(personaId, 'media-sm'), h('h3', { text: known.name })]),
    h('h3', { text: 'Стадия отношений' }),
    sceneChips({ scenario, onPick: (sid) => { setup = { ...setup, scenario: sid, intro: randomIntro(sid) }; renderSetup(); } }),
    introCard({ scenario, intro, opener, onReroll: () => { setup = { ...setup, intro: randomIntro(scenario, intro) }; renderSetup(); } }),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: known ? 'Начать сцену' : 'Случайный собеседник', on: { click: () => startDialog() } }),
      known && h('button', { class: 'btn btn-ghost', text: 'Скрытый собеседник', on: { click: () => { setup = { ...setup, personaId: null }; renderSetup(); } } }),
    ]),
  );
}

function renderDialog(personaId) {
  if (typeof personaId === 'string') {
    dialog = null;
    startToken += 1;
    setup = { ...setup, personaId };
    renderSetup();
    return;
  }
  if (!dialog) {
    renderSetup();
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
  const waiting = dialog.busy || dialog.done || dialog.messages.length === 0;
  input.disabled = waiting;
  send.disabled = waiting;

  const userTurns = dialog.messages.filter((m) => m.role === 'user').length;
  const left = Math.max(0, 3 - userTurns);
  const locked = left > 0 || dialog.busy || dialog.done;
  // Until three replies are in, a one-line hint instead of nine disabled buttons keeps the focus on the conversation.
  const finish = left > 0
    ? h('p', { class: 'guess-hint', text: `Ещё ${left} ${left === 1 ? 'реплика' : 'реплики'} — и можно ${dialog.known ? 'получить разбор' : 'угадать архетип'}` })
    : dialog.known
    ? h('div', { class: 'guess' }, [
      h('h3', { text: 'Готовы к разбору?' }),
      h('button', { class: 'btn btn-ghost', text: 'Получить разбор', on: { click: () => finishDialog(persona.personaId) }, attrs: locked ? { disabled: '' } : {} }),
    ])
    : h('div', { class: 'guess' }, [
      h('h3', { text: 'Кто перед вами?' }),
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
        h('p', { class: 'muted', text: persona.bio }),
      ]),
    ]),
    h('p', { class: 'scene-line', text: SCENARIOS[dialog.scenario].intros[dialog.intro].text }),
    chat,
    dialog.error && h('p', { class: 'error', text: dialog.error }),
    dialog.result ? renderDebrief(dialog.result) : finish,
    // Last, so on phones it sits pinned above the bottom tab bar.
    !dialog.done && h('div', { class: 'composer' }, [input, send]),
  );
  chat.scrollTop = chat.scrollHeight;
  if (isPhone()) {
    if (!dialog.result) window.scrollTo({ top: document.documentElement.scrollHeight });
  } else if (!input.disabled) {
    input.focus(); // on phones this would pop the keyboard after every reply
  }
}

async function sendMessage(raw) {
  const text = raw.trim();
  if (!text || dialog.busy || dialog.done) return;
  const messages = [...dialog.messages, { role: 'user', content: text }];
  dialog = { ...dialog, messages, busy: true, error: null, draft: '' };
  const current = dialog;
  renderDialog();
  try {
    const { reply } = await api('/chat', { personaId: current.persona.personaId, ...sceneOf(current), messages });
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
      ...sceneOf(current),
      messages: current.messages,
      guess: guessId,
      known: current.known,
    });
    if (dialog !== current) return;
    if (!dialog.known) {
      const stats = store.get('dialogs', { right: 0, total: 0 });
      store.set('dialogs', { right: stats.right + (result.correct ? 1 : 0), total: stats.total + 1 });
    }
    const history = loadSparHistory();
    const levelBefore = level(history);
    if (result.scores) {
      const entry = { at: Date.now(), archetype: result.actual, known: current.known, correct: result.correct, scores: result.scores };
      store.set(SPAR_HISTORY_KEY, [entry, ...history].slice(0, SPAR_HISTORY_LIMIT));
    }
    track('spar_completed', {
      known: current.known,
      correct: result.correct,
      archetype: result.actual,
      guess: guessId,
      scenario: current.scenario,
      turns: current.messages.filter((m) => m.role === 'user').length,
    });
    dialog = { ...dialog, busy: false, done: true, result, levelBefore };
  } catch (err) {
    if (dialog !== current) return;
    dialog = { ...dialog, busy: false, error: err.message };
  }
  renderDialog();
}

/** Scores of this sparring and how they moved the running level. */
function skillView(scores, levelBefore) {
  const levelNow = level(loadSparHistory());
  const delta = levelBefore == null ? null : Math.round((levelNow - levelBefore) * 10) / 10;
  const trend = delta == null
    ? 'Первая оценка — дальше будет видно, как растёт навык.'
    : `Ваш уровень: ${levelBefore} → ${levelNow}${delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : ''}`;
  return h('div', { class: 'skill' }, [
    h('span', { class: 'eyebrow', text: `Навык в этой сцене · ${overall(scores)}/10` }),
    h('div', { class: 'bars' }, SKILL_KEYS.map((k) => h('div', { class: 'bar' }, [
      h('span', { text: SKILL_AXES[k].label }),
      h('div', { class: 'bar-track' }, [h('div', { class: 'bar-fill', vars: { width: `${scores[k] * 10}%`, '--c': 'var(--primary)' } })]),
      h('span', { class: 'muted', text: `${scores[k]}/10` }),
    ]))),
    h('p', { class: 'muted small', text: trend }),
  ]);
}

function renderDebrief(result) {
  const a = ARCHETYPES[result.actual];
  const verdict = dialog.known ? 'Разбор' : result.correct ? 'Вы угадали' : 'Мимо';
  return h('div', { class: 'card debrief' }, [
    h('span', { class: 'eyebrow', text: verdict }),
    h('h3', { text: `${dialog.persona.name} — ${chip(result.actual)}` }),
    h('p', { class: 'feedback', text: result.feedback }),
    result.scores && skillView(result.scores, dialog.levelBefore),
    h('div', { class: 'row' }, [
      h('button', { class: 'btn btn-primary', text: 'Новая сцена', on: { click: () => { dialog = null; setup = { ...setup, intro: randomIntro(setup.scenario, setup.intro) }; renderSetup(); } } }),
      h('button', { class: 'btn btn-ghost', text: `Об архетипе «${a.name}»`, on: { click: () => go('type', result.actual) } }),
    ]),
  ]);
}

track('app_opened');
const bootRoute = routeFromLocation();
go(bootRoute.tab, bootRoute.arg, false);
initAuth();

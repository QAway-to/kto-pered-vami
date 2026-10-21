// Shared browser helpers: DOM builder, API client, storage and archetype artwork.

import { ARCHETYPES, ATTACHMENT_MAP, archetypeImage } from './archetypes.js';
import { SCENARIOS, SCENARIO_IDS } from './lab-data.js';
import { getToken, setToken } from './session.js';

/**
 * Tiny DOM builder. Text is always set via textContent (no innerHTML → no XSS).
 * @param {string} tag
 * @param {{class?: string, text?: string, vars?: Record<string,string>, on?: Record<string, EventListener>, attrs?: Record<string,string>}} [props]
 * @param {(Node|string|null|false|undefined)[]} [children]
 */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text != null) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.vars ?? {})) el.style.setProperty(k, v);
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(props.on ?? {})) el.addEventListener(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

export function mount(id, ...nodes) {
  document.getElementById(id).replaceChildren(...nodes.filter(Boolean));
}

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const store = {
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

/**
 * JSON API call with the session token. Errors carry `status` and `code`; a missing login or subscription
 * also raises a `kpv:auth` window event so the login or subscription dialog opens wherever the call came from.
 * @param {string} path
 * @param {object} [body] - POST body; omitted = GET
 * @param {{quiet?: boolean}} [opts] - quiet: do not raise `kpv:auth`
 */
export async function api(path, body, { quiet = false } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { throw new Error('Сервер вернул некорректный ответ'); }
  if (!json.success) {
    const err = new Error(json.error || 'Ошибка запроса');
    err.status = res.status;
    err.code = json.code ?? null;
    if (json.code === 'auth_required') setToken(null);
    if (!quiet && (json.code === 'auth_required' || json.code === 'subscription_required')) {
      window.dispatchEvent(new CustomEvent('kpv:auth', { detail: { reason: json.code } }));
    }
    throw err;
  }
  return json.data;
}

/** True for errors that the login or subscription dialog already handles. */
export const isAuthError = (err) => err?.code === 'auth_required' || err?.code === 'subscription_required';

/** Archetype artwork: generated image when available, monogram on a tinted gradient otherwise. */
export function media(id, size = '') {
  const a = ARCHETYPES[id];
  const src = archetypeImage(id);
  return h('div', { class: `media ${size}`, vars: { '--c': a.color } }, [
    src
      ? h('img', { attrs: { src, alt: a.name, loading: 'lazy' } })
      : h('span', { class: 'media-monogram', text: a.name.charAt(0), attrs: { 'aria-hidden': 'true' } }),
  ]);
}

export function chip(id) {
  const a = ARCHETYPES[id];
  return a.name;
}

/** Formats text by highlighting quoted direct speech («...»). */
export function formatSpeech(text) {
  if (typeof text !== 'string') return [text];
  const parts = text.split(/(«[^»]+»)/g);
  if (parts.length === 1) return [text];
  return parts.map((part) => (
    part.startsWith('«') && part.endsWith('»')
      ? h('span', { class: 'speech-quote', text: part })
      : part
  ));
}

/** Relationship-stage picker. */
export function sceneChips({ scenario, disabled = false, onPick }) {
  return h('div', { class: 'chips' }, SCENARIO_IDS.map((sid) => h('button', {
    class: `chip ${scenario === sid ? 'is-active' : ''}`,
    text: SCENARIOS[sid].title,
    attrs: disabled ? { disabled: '' } : {},
    on: { click: () => onPick(sid) },
  })));
}

/** The written intro of a scene, with a reroll button. */
export function introCard({ scenario, intro, opener, disabled = false, onReroll }) {
  const { setting, intros } = SCENARIOS[scenario];
  return h('div', { class: 'card intro' }, [
    h('div', { class: 'row intro-head' }, [
      h('span', { class: 'eyebrow', text: 'Вступление' }),
      h('button', { class: 'back', text: 'Другой сценарий', attrs: disabled ? { disabled: '' } : {}, on: { click: onReroll } }),
    ]),
    h('p', { class: 'intro-text', text: intros[intro].text }),
    h('p', { class: 'muted small', text: `${setting} Первым заговаривает ${opener}.` }),
  ]);
}

/**
 * Attachment as a 2×2 map: anxiety up the side, avoidance along the bottom (Bartholomew & Horowitz, 1991).
 * @param {{active?: string, dot?: {anxiety: number, avoidance: number}, onPick?: (id: string) => void}} [opts]
 *   active — highlighted style; dot — a person's scores (0..1) drawn as a point
 */
export function attachmentMap({ active = null, dot = null, onPick = null } = {}) {
  const cell = (anx, avo) => {
    const id = Object.keys(ATTACHMENT_MAP).find((k) => ATTACHMENT_MAP[k].anxiety === anx && ATTACHMENT_MAP[k].avoidance === avo);
    const a = ARCHETYPES[id];
    return h(onPick ? 'button' : 'div', {
      class: `att-cell ${id === active ? 'is-active' : ''}`,
      vars: { '--c': a.color },
      on: onPick ? { click: () => onPick(id) } : {},
      attrs: onPick ? { 'aria-label': a.name } : {},
    }, [h('strong', { text: a.name }), h('span', { class: 'muted small', text: a.coreTrait })]);
  };
  const plot = h('div', { class: 'att-plot' }, [
    cell('high', 'low'), cell('high', 'high'), cell('low', 'low'), cell('low', 'high'),
    dot && h('span', {
      class: 'att-dot',
      attrs: { title: 'Вы', 'aria-label': 'Ваш результат' },
      vars: { left: `${Math.round(dot.avoidance * 100)}%`, top: `${Math.round((1 - dot.anxiety) * 100)}%` },
    }),
  ]);
  return h('div', { class: 'att-map' }, [
    h('span', { class: 'att-axis att-axis-y', text: 'Тревога ↑' }),
    plot,
    h('span', { class: 'att-axis att-axis-x', text: 'Избегание →' }),
  ]);
}

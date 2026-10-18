// Shared browser helpers: DOM builder, API client, storage and archetype artwork.

import { ARCHETYPES, archetypeImage } from './archetypes.js';

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

export async function api(path, body) {
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
export function media(id, size = '') {
  const a = ARCHETYPES[id];
  const src = archetypeImage(id);
  return h('div', { class: `media ${size}`, vars: { '--c': a.color } }, [
    src
      ? h('img', { attrs: { src, alt: a.name, loading: 'lazy' } })
      : h('span', { class: 'media-emoji', text: a.emoji, attrs: { 'aria-hidden': 'true' } }),
  ]);
}

export function chip(id) {
  const a = ARCHETYPES[id];
  return `${a.emoji} ${a.name}`;
}

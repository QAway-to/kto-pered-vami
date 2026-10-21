// Arena tab: two modes — the card duel (default, free and instant) and the AI dialogue lab.

import { h, mount, store } from './ui.js';
import { renderLab } from './lab-ui.js';
import { renderDuel, pauseDuel } from './duel-ui.js';

const MODES = [
  { id: 'duel', label: 'Дуэль тактик' },
  { id: 'dialog', label: 'Диалог ИИ' },
];

let mode = MODES.some((m) => m.id === store.get('arena-mode', 'duel')) ? store.get('arena-mode', 'duel') : 'duel';

function show(presetId) {
  const duel = document.getElementById('duel-body');
  const lab = document.getElementById('lab-body');
  duel.hidden = mode !== 'duel';
  lab.hidden = mode !== 'dialog';
  mount('arena-switch', h('div', { class: 'arena-switch', attrs: { role: 'tablist' } }, MODES.map((m) => h('button', {
    class: `arena-switch-btn ${m.id === mode ? 'is-active' : ''}`,
    text: m.label,
    attrs: { role: 'tab', 'aria-selected': String(m.id === mode) },
    on: { click: () => setMode(m.id) },
  }))));
  if (mode === 'duel') renderDuel(presetId);
  else renderLab(presetId);
}

function setMode(next) {
  if (next === mode) return;
  if (mode === 'duel') pauseDuel();
  mode = next;
  store.set('arena-mode', mode);
  show();
}

/** @param {string} [presetId] - archetype to put into slot A of the active mode */
export function renderArena(presetId) {
  show(presetId);
}

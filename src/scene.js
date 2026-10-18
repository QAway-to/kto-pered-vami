// Scenes shared by the 1:1 trainer and the lab: a relationship stage plus one of its written intros.

import { SCENARIOS, SCENARIO_IDS } from '../public/js/lab-data.js';

/**
 * @param {unknown} scenario
 * @param {unknown} intro
 * @returns {boolean}
 */
export function isScene(scenario, intro) {
  return SCENARIO_IDS.includes(scenario) && Number.isInteger(intro) && intro >= 0 && intro < SCENARIOS[scenario].intros.length;
}

/** How the opener starts the scene (second person, for the side that speaks first). */
export const sceneCue = (scenario, intro) => SCENARIOS[scenario].intros[intro].cue;

/**
 * Scene block for a system prompt.
 * @param {string} scenario
 * @param {number} intro
 * @param {string} openingLine - the cue for the opener, or who speaks first for the other side
 */
export function sceneText(scenario, intro, openingLine) {
  return `Ситуация: ${SCENARIOS[scenario].setting}
Вступление: ${SCENARIOS[scenario].intros[intro].text}
${openingLine}`;
}

/** The scene as plain text for an analyst prompt. */
export function sceneSummary(scenario, intro) {
  const { title, setting, intros } = SCENARIOS[scenario];
  return `${title}. ${setting} Вступление: ${intros[intro].text}`;
}

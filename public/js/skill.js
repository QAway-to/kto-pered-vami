// Skill model shared by server and browser: three axes the AI coach scores after every sparring, and the progress math.

export const SKILL_AXES = Object.freeze({
  recognition: {
    label: 'Распознавание',
    rubric: 'заметил ли пользователь тактики персонажа и реагировал ли на них; в режиме со скрытым архетипом учитывай, угадан ли архетип',
  },
  boundaries: {
    label: 'Границы',
    rubric: 'обозначал ли пользователь, что для него приемлемо, отказывал ли без лишних оправданий',
  },
  composure: {
    label: 'Устойчивость',
    rubric: 'сохранял ли спокойствие и свою позицию, не поддавался ли на лесть, вину, давление и провокации',
  },
});

export const SKILL_KEYS = Object.freeze(Object.keys(SKILL_AXES));

/** How many recent sparrings form the "current level". */
export const LEVEL_WINDOW = 5;

/**
 * Mean of the three axes, one decimal.
 * @param {Record<string, number>} scores
 * @returns {number}
 */
export function overall(scores) {
  return Math.round((SKILL_KEYS.reduce((sum, k) => sum + scores[k], 0) / SKILL_KEYS.length) * 10) / 10;
}

/**
 * Current level: average overall score of the latest sparrings (history is newest first).
 * @param {{scores: Record<string, number>}[]} history
 * @returns {number|null}
 */
export function level(history) {
  const recent = history.slice(0, LEVEL_WINDOW);
  if (recent.length === 0) return null;
  return Math.round((recent.reduce((sum, e) => sum + overall(e.scores), 0) / recent.length) * 10) / 10;
}

// Screening quiz: 13 dimensions × 2 original items, Likert 1–5.
// Items are our own wording for each construct (validated scales are copyrighted); this is a screen, not a diagnosis.

import { ARCHETYPE_IDS } from './archetypes.js';

export const DIMENSIONS = {
  MACH: 'Расчётливость',
  GNARC: 'Жажда восхищения',
  VNARC: 'Уязвимое самолюбие',
  PSY: 'Бесстрашие и холодность',
  SAD: 'Удовольствие от поддразнивания',
  AEMP: 'Сопереживание',
  CEMP: 'Понимание чужих чувств',
  ANX: 'Страх отвержения',
  AVO: 'Дистанция в близости',
  EMO: 'Эмоциональные перепады',
  SPS: 'Чувствительность',
  ALEX: 'Трудность с чувствами',
  LIGHT: 'Вера в людей',
};

export const DIM_KEYS = Object.freeze(Object.keys(DIMENSIONS));

const ITEMS_BY_DIM = {
  MACH: ['Чтобы добиться своего, иногда полезно говорить людям то, что они хотят услышать.', 'Я не раскрываю свои планы, пока это не станет мне выгодно.'],
  GNARC: ['Я заслуживаю больше внимания и восхищения, чем большинство людей.', 'Мне нравится быть в центре внимания, и у меня это хорошо получается.'],
  VNARC: ['Меня глубоко задевает, когда другие не замечают моих заслуг.', 'Втайне я считаю себя особенным, но окружающие этого не понимают.'],
  PSY: ['Я легко иду на риск, даже если из-за этого могут пострадать другие.', 'Мне почти никогда не бывает стыдно за то, что я кого-то задел.'],
  SAD: ['Мне бывает смешно, когда кто-то попадает в неловкое положение.', 'Поддеть человека так, чтобы он вспылил, — это забавно.'],
  AEMP: ['Когда близкому плохо, я почти физически чувствую его боль.', 'Чужие грустные истории надолго выбивают меня из колеи.'],
  CEMP: ['Я легко понимаю, что человек чувствует, даже если он это скрывает.', 'Обычно я могу предсказать, как человек отреагирует на мои слова.'],
  ANX: ['Я боюсь, что близкие люди могут меня бросить.', 'Если мне долго не отвечают на сообщение, я начинаю тревожиться.'],
  AVO: ['Мне некомфортно, когда кто-то становится слишком близким.', 'Я предпочитаю ни от кого не зависеть и не показывать, что мне кто-то нужен.'],
  EMO: ['Моё настроение может резко меняться несколько раз за день.', 'Моё отношение к человеку может быстро смениться с восхищения на разочарование.'],
  SPS: ['Громкие звуки, яркий свет и толпа быстро меня утомляют.', 'Я замечаю тонкости — интонации, запахи, детали, — которые другие пропускают.'],
  ALEX: ['Мне трудно понять, какое именно чувство я сейчас испытываю.', 'Я предпочитаю обсуждать факты и дела, а не чувства.'],
  LIGHT: ['Я верю, что в большинстве людей больше хорошего, чем плохого.', 'Мне важно, чтобы человек рядом чувствовал себя ценным, даже если мне это ничего не даёт.'],
};

// Interleaved so neighbouring questions measure different things.
export const QUESTIONS = Object.freeze([0, 1].flatMap((n) => DIM_KEYS.map((dim) => ({ dim, text: ITEMS_BY_DIM[dim][n] }))));

export const LIKERT = Object.freeze(['Совсем не про меня', 'Скорее нет', 'Отчасти', 'Скорее да', 'Точно про меня']);

// Each archetype is a prototype: dimensions expected high and low.
export const PROTOTYPES = {
  'dark-empath': { high: ['MACH', 'GNARC', 'CEMP', 'AEMP'], low: [] },
  star: { high: ['GNARC'], low: ['VNARC', 'ANX'] },
  covert: { high: ['VNARC', 'EMO', 'ANX'], low: ['AEMP'] },
  strategist: { high: ['MACH', 'CEMP'], low: ['AEMP', 'EMO'] },
  predator: { high: ['PSY', 'MACH'], low: ['AEMP', 'ANX'] },
  troll: { high: ['SAD', 'PSY'], low: ['AEMP', 'LIGHT'] },
  swings: { high: ['EMO', 'ANX', 'AEMP'], low: [] },
  pleaser: { high: ['ANX', 'AEMP', 'LIGHT'], low: ['MACH'] },
  avoidant: { high: ['AVO'], low: ['ANX'] },
  sensitive: { high: ['SPS', 'AEMP'], low: ['PSY'] },
  robot: { high: ['ALEX'], low: ['CEMP'] },
  light: { high: ['LIGHT', 'AEMP'], low: ['MACH', 'GNARC', 'PSY', 'SAD'] },
};

/**
 * @param {number[]} answers - Likert 1..5, one per QUESTIONS entry, same order
 * @returns {Record<string, number>} each dimension normalised to 0..1
 */
export function scoreDimensions(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    throw new RangeError(`Expected ${QUESTIONS.length} answers`);
  }
  const sums = Object.fromEntries(DIM_KEYS.map((k) => [k, { total: 0, n: 0 }]));
  answers.forEach((a, i) => {
    if (!Number.isInteger(a) || a < 1 || a > 5) throw new RangeError(`Answer ${i} must be 1..5`);
    const s = sums[QUESTIONS[i].dim];
    sums[QUESTIONS[i].dim] = { total: s.total + a, n: s.n + 1 };
  });
  return Object.fromEntries(DIM_KEYS.map((k) => [k, (sums[k].total / sums[k].n - 1) / 4]));
}

/**
 * Ranks archetypes by closeness of the person's dimensions to each prototype.
 * @param {Record<string, number>} dims - output of scoreDimensions
 * @returns {{id: string, match: number}[]} best first, match in 0..100
 */
export function rankArchetypes(dims) {
  const ranked = ARCHETYPE_IDS.map((id) => {
    const { high, low } = PROTOTYPES[id];
    const parts = [...high.map((d) => dims[d]), ...low.map((d) => 1 - dims[d])];
    const match = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
    return { id, match };
  });
  return ranked.sort((a, b) => b.match - a.match);
}

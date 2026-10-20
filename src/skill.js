import { SKILL_AXES, SKILL_KEYS } from '../public/js/skill.js';

const MARKER = 'ОЦЕНКА';

/** Instruction appended to the coach prompt: a machine-readable score line after the prose. */
export function scoreInstruction() {
  const axes = SKILL_KEYS.map((k) => `• ${k} (${SKILL_AXES[k].label}): ${SKILL_AXES[k].rubric}`).join('\n');
  return `После текста разбора добавь последней строкой оценку навыков пользователя от 0 до 10, строго в формате:
${MARKER} {"recognition":N,"boundaries":N,"composure":N}
Оси:
${axes}
Оценивай честно: 5 — средне, 8+ — только за явные удачные ходы. Если реплик пользователя мало, не завышай.`;
}

const clamp = (n) => Math.min(10, Math.max(0, Math.round(n)));
// A line that starts with the marker and an opening brace, tolerating markdown decoration around it.
// Prose that merely mentions "оценка" never matches, so it is never cut.
const SCORE_LINE = /^[\s*_`>#-]*ОЦЕНКА[\s:*_]*(\{[^\n]*)$/gm;
const FENCE_LINE = /^\s*```\w*\s*$/gm;

function readScores(fragment) {
  const json = fragment.match(/^\{[^{}]*\}/)?.[0];
  if (!json) return null;
  let raw;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!SKILL_KEYS.every((k) => typeof raw?.[k] === 'number' && Number.isFinite(raw[k]))) return null;
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, clamp(raw[k])]));
}

/**
 * Splits the coach reply into prose and scores. The last score line is cut out even when malformed,
 * so the user never sees it; scores are null unless it holds all three numbers.
 * @param {string|null} text
 * @returns {{feedback: string|null, scores: Record<string, number>|null}}
 */
export function parseScores(text) {
  if (!text) return { feedback: text, scores: null };
  const last = [...text.matchAll(SCORE_LINE)].at(-1);
  if (!last) return { feedback: text, scores: null };
  const prose = `${text.slice(0, last.index)}${text.slice(last.index + last[0].length)}`.replace(FENCE_LINE, '').trim();
  // Scores without a written debrief are not shown: the user would see a failure message next to a grade.
  if (!prose) return { feedback: null, scores: null };
  return { feedback: prose, scores: readScores(last[1]) };
}

import { PERSONA_IDS } from './personas.js';

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 1000; // user turns
export const MAX_ASSISTANT_CHARS = 3000; // persona replies echoed back by the browser
export const MAX_TOTAL_CHARS = 15000;

/**
 * Validates a chat transcript coming from the browser.
 * The transcript starts with the persona's opening line (assistant) and alternates.
 * @param {unknown} messages
 * @returns {{ok: true, value: {role: 'user'|'assistant', content: string}[]} | {ok: false, error: string}}
 */
export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: 'messages must be a non-empty array' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Слишком длинный диалог (максимум ${MAX_MESSAGES} реплик). Начните новый.` };
  }
  const value = [];
  for (const [i, m] of messages.entries()) {
    if (!m || typeof m !== 'object') return { ok: false, error: `messages[${i}] must be an object` };
    const { role, content } = m;
    if (role !== 'user' && role !== 'assistant') return { ok: false, error: `messages[${i}].role is invalid` };
    if (typeof content !== 'string' || content.trim() === '') {
      return { ok: false, error: `messages[${i}].content must be a non-empty string` };
    }
    const cap = role === 'user' ? MAX_MESSAGE_CHARS : MAX_ASSISTANT_CHARS;
    if (content.length > cap) {
      return { ok: false, error: `Сообщение слишком длинное (максимум ${cap} символов)` };
    }
    if (i > 0 && value[i - 1].role === role) return { ok: false, error: 'roles must alternate' };
    value.push({ role, content: content.trim() });
  }
  const total = value.reduce((sum, m) => sum + m.content.length, 0);
  if (total > MAX_TOTAL_CHARS) return { ok: false, error: 'Диалог слишком длинный. Начните новый.' };
  return { ok: true, value };
}

/**
 * @param {unknown} id
 * @returns {id is string}
 */
export function isPersonaId(id) {
  return typeof id === 'string' && PERSONA_IDS.includes(id);
}

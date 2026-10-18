// Lab ("кто кого"): two archetypes meet in a scenario; each pursues its own motive (its payoff).
// Shared by the browser and the server.

/** Replies in one experiment, alternating A, B, A, … (5 each). */
export const LAB_TURNS = 10;

/** Relationship stages. The first one is the base experiment. */
export const SCENARIOS = {
  'first-meeting': {
    title: 'Только познакомились',
    stage: 'Знакомство',
    emoji: '👋',
    setting: 'Вы двое только что познакомились: оказались рядом на встрече онлайн-сообщества и разговорились в кулуарах. Друг о друге почти ничего не знаете. К концу разговора станет понятно, захотите ли вы общаться дальше.',
  },
  romance: {
    title: 'Завязался роман',
    stage: 'Первые месяцы',
    emoji: '💞',
    setting: 'Вы встречаетесь около двух месяцев, всё развивается быстро. Сегодня вечером один из вас предлагает съехаться, и вы обсуждаете, готовы ли к этому.',
  },
  'long-term': {
    title: 'Вместе три года',
    stage: 'Долгие отношения',
    emoji: '🏠',
    setting: 'Вы вместе три года и живёте вдвоём. Накопилась усталость, и сегодня всплыл давний спор: один хочет переехать в другой город ради работы, другой не уверен.',
  },
};

export const SCENARIO_IDS = Object.freeze(Object.keys(SCENARIOS));

/** What each archetype is really after — its payoff in the game. */
export const MOTIVES = {
  'dark-empath': 'получить влияние: узнать слабые места собеседника и сделать так, чтобы он чувствовал себя тебе обязанным',
  'grandiose-narcissist': 'получить восхищение и доминировать: чтобы собеседник признал твоё превосходство',
  'vulnerable-narcissist': 'добиться признания своей особенности, но не рисковать быть отвергнутым',
  machiavellian: 'извлечь выгоду: информацию, связи или уступки — и не раскрыться самому',
  psychopath: 'получить ресурсы или острые ощущения, не беря на себя ответственности',
  borderline: 'получить близость и гарантию, что тебя не бросят',
  avoidant: 'сохранить независимость и дистанцию, не дать втянуть себя в эмоциональную зависимость',
  hsp: 'сохранить безопасность и гармонию, не перегрузиться и быть понятым',
  secure: 'построить честный, взаимный контакт и сохранить свои границы',
};

/** How the relationship ended, as judged by the analyst. */
export const OUTCOMES = {
  healthy: { label: 'Здоровая связь', emoji: '🌱' },
  continue: { label: 'Общение продолжится', emoji: '🤝' },
  toxic: { label: 'Токсичная связь', emoji: '☣️' },
  breakup: { label: 'Разошлись', emoji: '💔' },
};

export const OUTCOME_IDS = Object.freeze(Object.keys(OUTCOMES));

/** Persona first names for the lab chat (the server's personas use the same names; a test keeps them in sync). */
export const PERSONA_NAMES = {
  'dark-empath': 'Кира',
  'grandiose-narcissist': 'Артём',
  'vulnerable-narcissist': 'Денис',
  machiavellian: 'Виктор',
  psychopath: 'Марк',
  borderline: 'Лера',
  avoidant: 'Илья',
  hsp: 'Соня',
  secure: 'Марина',
};

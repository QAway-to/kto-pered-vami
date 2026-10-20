// Lab ("кто кого"): two archetypes meet in a scenario; each pursues its own motive (its payoff).
// Shared by the browser and the server.

/** Replies in one experiment, alternating A, B, A, … (5 each). */
export const LAB_TURNS = 10;

/**
 * Relationship stages. The first one is the base experiment.
 * Each has several intros: `text` sets the scene for both sides, `cue` tells A how to open it.
 */
export const SCENARIOS = {
  'first-meeting': {
    title: 'Только познакомились',
    stage: 'Знакомство',
    setting: 'Вы двое видите друг друга впервые и почти ничего друг о друге не знаете. К концу разговора станет понятно, захотите ли вы общаться дальше.',
    intros: [
      {
        text: 'Субботняя вечеринка у общего знакомого. Все ушли в комнату играть в настолки, а вы двое остались на балконе — каждый со своим бокалом. Неловкая пауза затягивается.',
        cue: 'Ты заговариваешь первым и нарушаешь паузу на балконе.',
      },
      {
        text: 'Мастер-класс по керамике. Мест не хватило, и преподаватель посадил вас двоих за один гончарный круг. Глина уже летит во все стороны.',
        cue: 'Ты заговариваешь первым, пока вы делите один круг.',
      },
      {
        text: 'Задержка рейса на четыре часа. В переполненном зале ожидания осталась одна розетка, и вы оба одновременно тянетесь к ней с зарядкой.',
        cue: 'Ты заговариваешь первым, держа в руке зарядку у той самой розетки.',
      },
    ],
  },
  romance: {
    title: 'Завязался роман',
    stage: 'Первые месяцы',
    setting: 'Вы встречаетесь около двух месяцев, всё развивается быстро. Самое время понять, куда движутся отношения.',
    intros: [
      {
        text: 'Воскресное утро после долгого вечера вдвоём. Вы завтракаете на кухне, пахнет кофе, торопиться некуда.',
        cue: 'Ты заговариваешь первым и предлагаешь съехаться.',
      },
      {
        text: 'Вы возвращаетесь с дня рождения друга, где вас впервые представили всем как пару. В такси повисла тишина.',
        cue: 'Ты заговариваешь первым: хочешь обсудить, кто вы теперь друг для друга.',
      },
      {
        text: 'Вечер, вы собирались в кино. Но одному из вас только что предложили поехать на месяц в командировку — уже на следующей неделе.',
        cue: 'Ты заговариваешь первым: командировку предложили тебе, и ты сообщаешь новость.',
      },
    ],
  },
  'long-term': {
    title: 'Вместе три года',
    stage: 'Долгие отношения',
    setting: 'Вы вместе три года и живёте вдвоём. Накопилась усталость, и привычные договорённости начали трещать.',
    intros: [
      {
        text: 'Вечер буднего дня. На кухне гора немытой посуды, в раковине — третий день одна и та же кастрюля.',
        cue: 'Ты заговариваешь первым: тебя достало, что быт снова на тебе.',
      },
      {
        text: 'Обычный ужин дома. Одному из вас сегодня предложили работу мечты — но в другом городе.',
        cue: 'Ты заговариваешь первым: работу предложили тебе, и ты хочешь переехать.',
      },
      {
        text: 'Долгожданный отпуск у моря. Второй день подряд вы почти не разговариваете и сидите каждый в своём телефоне.',
        cue: 'Ты заговариваешь первым: решаешь прервать молчание.',
      },
    ],
  },
};

export const SCENARIO_IDS = Object.freeze(Object.keys(SCENARIOS));

/** Dominant in Uchtomsky's sense: the core fixation / frame of the archetype in dialogue. */
export const DOMINANTS = {
  'dark-empath': { name: 'Контроль через уязвимость', focus: 'Поиск болевых точек и эмоциональный крючок' },
  'grandiose-narcissist': { name: 'Подтверждение превосходства', focus: 'Удержание статуса и принуждение к восхищению' },
  'vulnerable-narcissist': { name: 'Роль непризнанного гения', focus: 'Пассивная обида и требование сочувствия' },
  machiavellian: { name: 'Холодная выгода', focus: 'Сбор компромата и скрытая триангуляция' },
  psychopath: { name: 'Импульсивный драйв', focus: 'Снятие тормозов и игра на чужих нервах' },
  borderline: { name: 'Паника отвержения', focus: 'Требование гарантий близости или эмоциональный взрыв' },
  avoidant: { name: 'Автономия и дистанция', focus: 'Откат назад и эмоциональная броня' },
  hsp: { name: 'Сенсорная безопасность', focus: 'Защита от перегрузки и поиск искренности' },
  secure: { name: 'Взаимность и границы', focus: 'Устойчивость, прямота и равный диалог' },
  schizoid: { name: 'Абсолютная автономия', focus: 'Защита ментального пространства и концептуализация' },
};

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
  schizoid: 'сохранить автономию и ясность мышления, избежать эмоциональной суеты и обсудить суть',
};

/** How the relationship ended, as judged by the analyst. */
export const OUTCOMES = {
  healthy: { label: 'Здоровая связь', tone: 'success' },
  continue: { label: 'Общение продолжится', tone: 'info' },
  toxic: { label: 'Токсичная связь', tone: 'danger' },
  breakup: { label: 'Разошлись', tone: 'warning' },
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
  schizoid: 'Глеб',
};

/** Random intro index for a scenario, different from `current` when there is a choice. */
export function randomIntro(scenarioId, current = -1) {
  const n = SCENARIOS[scenarioId].intros.length;
  const options = [...Array(n).keys()].filter((i) => i !== current);
  return options[Math.floor(Math.random() * options.length)] ?? 0;
}

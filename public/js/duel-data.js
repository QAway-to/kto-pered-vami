// «Дуэль тактик»: cards are typical moves of each archetype, each tied to a research construct.
// Effects change two meters per side: esteem (самооценка) and trust (доверие к партнёру), 0..10.
// Shared by the browser and the tests.

export const START = Object.freeze({ esteem: 7, trust: 6 });
export const MAX_TURNS = 18; // plays in total, alternating A, B: three acts of six
export const HAND_SIZE = 3;

/** Card families: colour on the card and how statuses react to it. */
export const FAMILIES = {
  manipulation: { label: 'Манипуляция', color: '#a33b5c' },
  escalation: { label: 'Эскалация', color: '#c4622d' },
  withdrawal: { label: 'Отстранение', color: '#5a6b7a' },
  anxious: { label: 'Тревога', color: '#b7791f' },
  control: { label: 'Контроль', color: '#6b5b95' },
  healthy: { label: 'Здоровый ход', color: '#2f855a' },
};

/**
 * Effects: `self` / `target` deltas; `hook` puts the target «на крючок» (the next hurtful card on them hits twice);
 * `shield` gives the player «границу» (blocks the next manipulation aimed at them); `unhook` clears the hook on self.
 */
export const CARDS = {
  love_bombing: {
    name: 'Love bombing', family: 'manipulation', line: '«Ты лучшее, что со мной случалось».',
    self: {}, target: { trust: 3 }, hook: true,
    science: 'Нарциссическое восхищение: очарование на старте (Back et al., 2013)',
  },
  devaluation: {
    name: 'Обесценивание', family: 'manipulation', line: '«Ну и что тут особенного?»',
    self: { esteem: 1 }, target: { esteem: -2, trust: -1 }, hurts: true,
    science: 'Нарциссическое соперничество: защита статуса через унижение (Back et al., 2013)',
  },
  gaslighting: {
    name: 'Газлайтинг', family: 'manipulation', line: '«Такого не было. Тебе показалось».',
    self: {}, target: { esteem: -3 }, hurts: true,
    science: 'Газлайтинг как подрыв доверия к своему восприятию (Sweet, 2019)',
  },
  guilt_trip: {
    name: 'Чувство вины', family: 'manipulation', line: '«После всего, что я для тебя сделал…»',
    self: {}, target: { esteem: -1, trust: 1 }, hurts: true,
    science: 'Тёмная эмпатия: давление через понимание чувств (Heym et al., 2021)',
  },
  triangulation: {
    name: 'Триангуляция', family: 'manipulation', line: '«А вот Катя меня понимает».',
    self: { esteem: 1 }, target: { esteem: -1, trust: -2 }, hurts: true,
    science: 'Макиавеллизм: управление через третьих лиц (Jones & Paulhus, 2014)',
  },
  silent_treatment: {
    name: 'Тихое наказание', family: 'manipulation', line: '…(молчит второй день)',
    self: { trust: -1 }, target: { esteem: -2, trust: -1 }, hurts: true,
    science: 'Остракизм бьёт по самооценке и принадлежности (Williams, 2007)',
  },
  charm: {
    name: 'Поверхностное обаяние', family: 'manipulation', line: '«Расслабься, со мной всё будет легко».',
    self: { esteem: 1 }, target: { trust: 2 },
    science: 'Смелость в триархической модели психопатии (Patrick et al., 2009)',
  },
  provocation: {
    name: 'Провокация', family: 'escalation', line: '«Чего такой серьёзный? Я же шучу».',
    self: { esteem: 2 }, target: { esteem: -1, trust: -1 }, hurts: true,
    science: 'Бытовой садизм и троллинг (Buckels et al., 2014)',
  },
  victim: {
    name: 'Роль жертвы', family: 'manipulation', line: '«Конечно, опять я во всём виноват».',
    self: { esteem: 1 }, target: { esteem: -1, trust: 1 }, hurts: true,
    science: 'Уязвимый нарциссизм: обида как рычаг (Hendin & Cheek, 1997)',
  },
  idealization: {
    name: 'Идеализация', family: 'anxious', line: '«Ты самый лучший человек на свете!»',
    self: { trust: 2 }, target: { esteem: 2 }, hook: true,
    science: 'Расщепление «всё хорошее / всё плохое» (Kernberg, 1967)',
  },
  test: {
    name: 'Проверка на прочность', family: 'anxious', line: '«Докажи, что ты не уйдёшь».',
    self: { trust: 1 }, target: { trust: -1, esteem: -1 }, hurts: true,
    science: 'Чувствительность к отвержению (Downey & Feldman, 1996)',
  },
  cling: {
    name: 'Удержать любой ценой', family: 'anxious', line: '«Не уходи, давай поговорим прямо сейчас!»',
    self: { esteem: -1, trust: 1 }, target: { trust: -1 },
    science: 'Тревожная привязанность: гиперактивация (Mikulincer & Shaver, 2016)',
  },
  outburst: {
    name: 'Вспышка', family: 'escalation', line: '«Я так и знала, ты как все!»',
    self: { esteem: -1, trust: -1 }, target: { esteem: -2, trust: -1 }, hurts: true,
    science: 'Эмоциональная нестабильность в пограничном паттерне (ICD-11)',
  },
  withdraw: {
    name: 'Уйти в себя', family: 'withdrawal', line: '«Мне нужно побыть одному».',
    self: { esteem: 1 }, target: { trust: -1, esteem: -1 }, hurts: true,
    science: 'Деактивация привязанности у избегающих (Mikulincer & Shaver, 2016)',
  },
  ghosting: {
    name: 'Гостинг', family: 'withdrawal', line: '…(пропал, сообщения не прочитаны)',
    self: {}, target: { esteem: -2, trust: -2 }, hurts: true,
    science: 'Избегающая привязанность: уход от близости (Bartholomew & Horowitz, 1991)',
  },
  deflect: {
    name: 'Перевести в дела', family: 'withdrawal', line: '«Ладно. Что по плану на завтра?»',
    self: {}, target: { trust: -1 },
    science: 'Подавление эмоций и уход в факты (Fraley et al., 2011)',
  },
  attune: {
    name: 'Почувствовать', family: 'healthy', line: '«Я вижу, что тебе сейчас тяжело».',
    self: { esteem: -1 }, target: { esteem: 1, trust: 1 },
    science: 'Сенсорная чувствительность: глубокая обработка чужих эмоций (Aron & Aron, 1997)',
  },
  retreat: {
    name: 'Перегрузка: пауза', family: 'withdrawal', line: '«Мне нужно немного тишины».',
    self: { esteem: 2 }, target: {},
    science: 'Восстановление после перегрузки у высокочувствительных (Greven et al., 2019)',
  },
  take_control: {
    name: 'Взять контроль', family: 'control', line: '«Сделаем по-моему, так правильнее».',
    self: { esteem: 1 }, target: { esteem: -1, trust: -1 }, hurts: true,
    science: 'Ананкастность: потребность контролировать (ICD-11)',
  },
  nitpick: {
    name: 'Критика мелочей', family: 'control', line: '«Ты опять поставил кружку не туда».',
    self: {}, target: { esteem: -2 }, hurts: true,
    science: 'Перфекционизм и критичность к другим (Hewitt & Flett, 1991)',
  },
  set_rule: {
    name: 'Установить правило', family: 'control', line: '«Отныне у нас будет так».',
    self: { esteem: 1 }, target: { trust: -1 }, shield: true,
    science: 'Ригидность и правила как опора (ICD-11, ананкастный паттерн)',
  },
  do_it_myself: {
    name: 'Сделать всё самому', family: 'control', line: '«Не трогай, я сам».',
    self: { esteem: -1 }, target: { trust: -1 },
    science: 'Гиперответственность и недоверие к другим (Hewitt & Flett, 1991)',
  },
  seek_reassurance: {
    name: 'Требовать подтверждений', family: 'anxious', line: '«Ты меня точно любишь? Скажи ещё раз».',
    self: { esteem: 1 }, target: { trust: -1 },
    science: 'Избыточный поиск подтверждений при тревожной привязанности (Shaver et al., 2005)',
  },
  push_pull: {
    name: 'Притянуть и оттолкнуть', family: 'anxious', line: '«Иди ко мне… Нет, оставь меня в покое».',
    self: { esteem: -1 }, target: { esteem: -1, trust: -1 }, hook: true, hurts: true,
    science: 'Боязливая привязанность: хочу близости и боюсь её (Bartholomew & Horowitz, 1991)',
  },
  generosity: {
    name: 'Щедрость и восхищение', family: 'healthy', line: '«Ты сегодня потрясающе выглядишь. Пойдём, я угощаю».',
    self: { esteem: 1 }, target: { esteem: 1, trust: 1 },
    science: 'Нарциссическое восхищение не вредит отношениям, в отличие от соперничества (Wurst et al., 2017)',
  },
  deal: {
    name: 'Взаимная выгода', family: 'healthy', line: '«Давай договоримся так, чтобы выиграли оба».',
    self: { esteem: 1, trust: 1 }, target: { trust: 2 },
    science: 'Pragma — любовь по расчёту, типичная для тёмной триады (Jonason & Kavanagh, 2010)',
  },
  adventure: {
    name: 'Приключение вдвоём', family: 'healthy', line: '«Бросай всё, поехали к морю прямо сейчас».',
    self: { esteem: 1 }, target: { esteem: 1, trust: 1 },
    science: 'Ludus — любовь-игра и поиск острых ощущений (Jonason & Kavanagh, 2010)',
  },
  open_up: {
    name: 'Признаться в ранимости', family: 'healthy', line: '«Мне страшно, что я тебе не нужен».',
    self: { esteem: -1 }, target: { trust: 2 },
    science: 'Самораскрытие создаёт близость (Aron et al., 1997)',
  },
  i_message: {
    name: 'Я-сообщение', family: 'healthy', line: '«Мне обидно, когда так происходит».',
    self: { esteem: 1 }, target: { trust: 1 }, unhook: true,
    science: 'Прямое выражение чувств в надёжной привязанности (Hazan & Shaver, 1987)',
  },
  boundary: {
    name: 'Граница', family: 'healthy', line: '«Со мной так нельзя».',
    self: { esteem: 1 }, target: {}, shield: true, unhook: true,
    science: 'Границы защищают самооценку от манипуляций (Kaufman et al., 2019)',
  },
  repair: {
    name: 'Извиниться и починить', family: 'healthy', line: '«Прости. Давай разберёмся вместе».',
    self: { trust: 2 }, target: { trust: 2, esteem: 1 },
    science: 'Попытки «ремонта» отличают устойчивые пары (Gottman & Levenson, 1999)',
  },
  empathy: {
    name: 'Признать чувства', family: 'healthy', line: '«Понимаю, почему ты злишься».',
    self: {}, target: { esteem: 1, trust: 1 },
    science: 'Эмпатия как основа светлой триады (Kaufman et al., 2019)',
  },
  pause: {
    name: 'Пауза', family: 'healthy', line: '«Давай выдохнем и вернёмся через десять минут».',
    self: { esteem: 1 }, target: { esteem: 1 }, unhook: true,
    science: 'Тайм-аут снижает физиологическое «затопление» в ссоре (Gottman, 1994)',
  },
};

export const CARD_IDS = Object.freeze(Object.keys(CARDS));

/** Each archetype's deck: its typical moves, strongest preference first. */
export const DECKS = {
  'dark-empath': ['guilt_trip', 'love_bombing', 'gaslighting', 'triangulation', 'empathy'],
  'grandiose-narcissist': ['love_bombing', 'devaluation', 'charm', 'triangulation', 'generosity'],
  'vulnerable-narcissist': ['victim', 'silent_treatment', 'devaluation', 'guilt_trip', 'open_up'],
  machiavellian: ['charm', 'triangulation', 'gaslighting', 'guilt_trip', 'deal'],
  psychopath: ['charm', 'provocation', 'gaslighting', 'devaluation', 'adventure'],
  borderline: ['idealization', 'test', 'cling', 'outburst', 'repair'],
  hsp: ['attune', 'retreat', 'empathy', 'i_message', 'withdraw'],
  'control-freak': ['take_control', 'nitpick', 'set_rule', 'do_it_myself', 'i_message'],
  secure: ['i_message', 'boundary', 'repair', 'empathy', 'pause'],
  'anxious-preoccupied': ['seek_reassurance', 'cling', 'test', 'open_up', 'empathy'],
  avoidant: ['withdraw', 'deflect', 'ghosting', 'boundary', 'empathy'],
  'fearful-avoidant': ['push_pull', 'open_up', 'withdraw', 'test', 'ghosting'],
};

/**
 * Six research axes, 0..10. They describe the person; the engine derives how they play from them,
 * so a mix of two types is simply a weighted mix of their axes.
 */
export const AXES = {
  honesty: { label: 'Честность', source: 'HEXACO: честность–скромность, обратна «тёмному ядру» (Moshagen et al., 2018)' },
  anxiety: { label: 'Тревога привязанности', source: 'ECR: страх быть оставленным (Brennan, Clark & Shaver, 1998)' },
  avoidance: { label: 'Избегание близости', source: 'ECR: дискомфорт от близости и зависимости' },
  stability: { label: 'Устойчивость', source: 'Big Five: эмоциональная стабильность (низкий нейротизм)' },
  warmth: { label: 'Теплота', source: 'Big Five / HEXACO: доброжелательность и эмпатия' },
  boundaries: { label: 'Границы', source: 'Самоуважение (Rosenberg, 1965) и умение защищать себя' },
};

export const AXIS_KEYS = Object.freeze(Object.keys(AXES));

/** Prototype of each archetype on the six axes (our reading of the literature, not norms). */
export const PROFILES = {
  'dark-empath': { honesty: 2, anxiety: 4, avoidance: 4, stability: 5, warmth: 6, boundaries: 6 },
  'grandiose-narcissist': { honesty: 1, anxiety: 2, avoidance: 6, stability: 6, warmth: 2, boundaries: 7 },
  'vulnerable-narcissist': { honesty: 3, anxiety: 8, avoidance: 6, stability: 2, warmth: 3, boundaries: 4 },
  machiavellian: { honesty: 1, anxiety: 3, avoidance: 7, stability: 7, warmth: 2, boundaries: 7 },
  psychopath: { honesty: 0, anxiety: 1, avoidance: 9, stability: 9, warmth: 0, boundaries: 5 },
  borderline: { honesty: 6, anxiety: 10, avoidance: 3, stability: 1, warmth: 7, boundaries: 2 },
  hsp: { honesty: 8, anxiety: 5, avoidance: 4, stability: 3, warmth: 9, boundaries: 5 },
  'control-freak': { honesty: 6, anxiety: 6, avoidance: 5, stability: 4, warmth: 3, boundaries: 7 },
  secure: { honesty: 9, anxiety: 1, avoidance: 1, stability: 8, warmth: 8, boundaries: 9 },
  'anxious-preoccupied': { honesty: 7, anxiety: 9, avoidance: 1, stability: 3, warmth: 8, boundaries: 3 },
  avoidant: { honesty: 6, anxiety: 2, avoidance: 9, stability: 6, warmth: 4, boundaries: 7 },
  'fearful-avoidant': { honesty: 6, anxiety: 8, avoidance: 8, stability: 2, warmth: 5, boundaries: 3 },
};

/** Nobody is a pure type: a mix takes 20–30% of a second one (dimensional view, Haslam et al., 2012). */
export const MIX = Object.freeze({ min: 0.2, max: 0.3, default: 0.25 });

/**
 * A duel runs in three acts. Early on manipulation works best (admiration charms at first, Wurst et al., 2017);
 * in the crisis act outside stress hits both partners, and only those who repair keep the bond.
 */
export const ACTS = Object.freeze([
  { name: 'Знакомство', from: 0 },
  { name: 'Быт', from: 6 },
  { name: 'Кризис', from: 12 },
]);
export const CRISIS = Object.freeze({ trust: -1, esteem: -1 });

/**
 * Partners of a kind play by shared rules: their manipulations land softer on each other.
 * Similar dark traits go with higher satisfaction, narcissism most of all; psychopathy stays the most harmful
 * (Smith et al., 2014; Kardum et al.; Hudek-Knežević et al.).
 */
export const DARK = Object.freeze(['dark-empath', 'grandiose-narcissist', 'vulnerable-narcissist', 'machiavellian', 'psychopath']);
export const NARCISSISTS = Object.freeze(['grandiose-narcissist', 'vulnerable-narcissist']);

/** Endings, judged from the final meters. `union` scores the couple for the «Качество союза» table. */
export const OUTCOMES = {
  broken: { label: 'Сломлен', tone: 'bad', union: -2, text: 'Самооценка одного обнулилась: его «съели».' },
  left: { label: 'Ушёл', tone: 'bad', union: -1, text: 'Доверие одного обнулилось, и он ушёл из отношений.' },
  toxic: { label: 'Токсичная петля', tone: 'bad', union: -1, text: 'Держатся друг за друга, но разрушают себя.' },
  cold: { label: 'Холодная война', tone: 'mid', union: 0, text: 'Вместе, но доверия почти не осталось.' },
  shaky: { label: 'Шатко', tone: 'mid', union: 1, text: 'Ни победы, ни разрыва: отношения на грани.' },
  pragmatic: { label: 'Союз по расчёту', tone: 'mid', union: 2, text: 'Оба целы и держатся вместе на взаимной выгоде — без тепла, но устойчиво.' },
  healthy: { label: 'Здоровый союз', tone: 'good', union: 3, text: 'Оба сохранили себя и доверие друг к другу.' },
};

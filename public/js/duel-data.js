// «Дуэль тактик»: cards are typical moves of each archetype, each tied to a research construct.
// Effects change two meters per side: esteem (самооценка) and trust (доверие к партнёру), 0..10.
// Shared by the browser and the tests.

export const START = Object.freeze({ esteem: 7, trust: 6 });
export const MAX_TURNS = 10; // plays in total, alternating A, B
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
  detach: {
    name: 'Безразличие', family: 'withdrawal', line: '«Мне, в общем, всё равно».',
    self: { esteem: 1 }, target: { esteem: -1, trust: -2 }, hurts: true,
    science: 'Отстранённость в шизоидном спектре (ICD-11)',
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
  'grandiose-narcissist': ['love_bombing', 'devaluation', 'charm', 'triangulation', 'gaslighting'],
  'vulnerable-narcissist': ['victim', 'silent_treatment', 'devaluation', 'guilt_trip', 'withdraw'],
  machiavellian: ['charm', 'triangulation', 'gaslighting', 'guilt_trip', 'deflect'],
  psychopath: ['charm', 'provocation', 'gaslighting', 'devaluation', 'ghosting'],
  borderline: ['idealization', 'test', 'cling', 'outburst', 'repair'],
  avoidant: ['withdraw', 'deflect', 'ghosting', 'boundary', 'empathy'],
  hsp: ['attune', 'retreat', 'empathy', 'i_message', 'withdraw'],
  secure: ['i_message', 'boundary', 'repair', 'empathy', 'pause'],
  schizoid: ['detach', 'deflect', 'withdraw', 'retreat', 'boundary'],
  'control-freak': ['take_control', 'nitpick', 'set_rule', 'do_it_myself', 'i_message'],
};

/**
 * How each archetype weighs a situation when it picks a card, plus two traits of the person:
 * `bond` — how much trust they actually form (cold types barely attach: gains are scaled down);
 * `resilience` — how hard esteem hits land (secure attachment buffers, high sensitivity amplifies).
 */
export const STYLE = {
  'dark-empath': { exploit: 2, selfCare: 1, repair: 0, bond: 0.6, resilience: 1 },
  'grandiose-narcissist': { exploit: 3, selfCare: 1, repair: 0, bond: 0.6, resilience: 1.2 },
  'vulnerable-narcissist': { exploit: 1, selfCare: 2, repair: 0, bond: 0.8, resilience: 1.3 },
  machiavellian: { exploit: 3, selfCare: 1, repair: 0, bond: 0.4, resilience: 0.8 },
  psychopath: { exploit: 3, selfCare: 0, repair: 0, bond: 0.2, resilience: 0.6 },
  borderline: { exploit: 0, selfCare: 1, repair: 1, bond: 1.2, resilience: 1.3 },
  avoidant: { exploit: 0, selfCare: 2, repair: 1, bond: 0.6, resilience: 0.9 },
  hsp: { exploit: 0, selfCare: 2, repair: 2, bond: 1, resilience: 1.3 },
  secure: { exploit: 0, selfCare: 2, repair: 3, bond: 1, resilience: 0.6 },
  schizoid: { exploit: 0, selfCare: 2, repair: 0, bond: 0.3, resilience: 0.8 },
  'control-freak': { exploit: 1, selfCare: 1, repair: 1, bond: 0.8, resilience: 1 },
};

/** Endings, judged from the final meters. */
export const OUTCOMES = {
  broken: { label: 'Сломлен', tone: 'bad', text: 'Самооценка одного обнулилась: его «съели».' },
  left: { label: 'Ушёл', tone: 'bad', text: 'Доверие одного обнулилось, и он ушёл из отношений.' },
  toxic: { label: 'Токсичная петля', tone: 'bad', text: 'Держатся друг за друга, но разрушают себя.' },
  cold: { label: 'Холодная война', tone: 'mid', text: 'Вместе, но доверия почти не осталось.' },
  healthy: { label: 'Здоровый союз', tone: 'good', text: 'Оба сохранили себя и доверие друг к другу.' },
  shaky: { label: 'Шатко', tone: 'mid', text: 'Ни победы, ни разрыва: отношения на грани.' },
};

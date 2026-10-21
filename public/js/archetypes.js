// 12 archetypes in two layers: character (how a person treats a partner) and attachment (how they bond).
// Scientific name on the card, social-media name as `aka`, peer-reviewed construct and sources inside.
// Shared by the browser and the server. Images go to /img/archetypes/<id>.webp (placeholder until generated).

export const TRAIT_DEFINITIONS = Object.freeze({
  empathy: {
    abbr: 'Э',
    name: 'Эмпатия',
    desc: 'Способность считывать чужие эмоции, мотивы и сопереживать.',
  },
  rationality: {
    abbr: 'Р',
    name: 'Рациональность',
    desc: 'Опора на строгую логику, факты и стратегический расчёт.',
  },
  autonomy: {
    abbr: 'А',
    name: 'Автономия',
    desc: 'Психологическая независимость от чужих оценок и самодостаточность.',
  },
  influence: {
    abbr: 'В',
    name: 'Влияние',
    desc: 'Стремление управлять фреймом ситуации, статусом и людьми.',
  },
  sensitivity: {
    abbr: 'Ч',
    name: 'Чувствительность',
    desc: 'Уязвимость эго, глубина эмоционального отклика на стресс и критику.',
  },
  masking: {
    abbr: 'М',
    name: 'Маскировка',
    desc: 'Харизма, обаяние и способность скрывать истинные мотивы.',
  },
});

export const TRAIT_KEYS = Object.freeze(Object.keys(TRAIT_DEFINITIONS));

export const TRAIT_LABELS = Object.freeze(
  Object.fromEntries(TRAIT_KEYS.map((k) => [k, TRAIT_DEFINITIONS[k].name]))
);

export const ARCHETYPES = {
  'dark-empath': {
    name: 'Тёмный эмпат',
    aka: 'Dark empath · «самый опасный тип»',
    tagline: 'Понимает вас лучше всех — и знает, как этим воспользоваться.',
    color: '#7b5ea7',
    coreTrait: 'Инструментальное обаяние',
    traits: { empathy: 9, rationality: 8, autonomy: 6, influence: 9, sensitivity: 5, masking: 10 },
    construct: 'Тёмная триада + эмпатия',
    science: 'В выборке из 991 человека латентный профильный анализ выделил группу с высокими «тёмными» чертами и одновременно высокой эмпатией — около 18% участников. Они менее агрессивны, чем классическая тёмная триада, но склонны к скрытой агрессии и манипуляциям через понимание чужих чувств.',
    signs: ['Тонко чувствует ваше состояние и быстро становится «своим»', 'Помогает — но потом напоминает об этом в нужный момент', 'Шутки с подтекстом, «я же просто пошутил»'],
    flags: ['Скрытая агрессия и пассивные уколы', 'Использует ваши откровения против вас', 'Чувство вины как рычаг'],
    howTo: 'Не делитесь уязвимым на старте. Отделяйте эмпатию от намерений: «понимает» не значит «на вашей стороне». Смотрите на поступки, а не на слова.',
    refs: ['Heym, N. et al. (2021). The Dark Empath: Characterising dark traits in the presence of empathy. Personality and Individual Differences, 169, 110172.'],
  },
  'grandiose-narcissist': {
    name: 'Грандиозный нарцисс',
    aka: 'Нарцисс, love bomber, «токсик»',
    tagline: 'Восхищайтесь им — или станете соперником.',
    color: '#d4a017',
    coreTrait: 'Жажда признания и статус',
    traits: { empathy: 2, rationality: 5, autonomy: 3, influence: 10, sensitivity: 4, masking: 9 },
    construct: 'Грандиозный нарциссизм (NARC)',
    science: 'Модель NARC разделяет грандиозный нарциссизм на две стратегии: «восхищение» (обаяние, самопрезентация) и «соперничество» (обесценивание других, защита статуса). Первая делает человека привлекательным при знакомстве, вторая разрушает отношения со временем — это и есть цикл «love bombing → обесценивание» из соцсетей.',
    signs: ['Ярок и обаятелен с первых минут', 'Разговор быстро возвращается к нему', 'Плохо переносит критику и чужой успех'],
    flags: ['Love bombing, затем обесценивание', 'Присваивает чужие заслуги', 'Публичное соперничество'],
    howTo: 'Признавайте сильные стороны, но не участвуйте в борьбе за статус. Фиксируйте договорённости письменно. Критику — один на один и через «как сделать ещё лучше».',
    refs: [
      'Back, M. D. et al. (2013). Narcissistic admiration and rivalry. Journal of Personality and Social Psychology, 105(6), 1013–1037.',
      'Paulhus, D. L., & Williams, K. M. (2002). The Dark Triad of personality. Journal of Research in Personality, 36(6), 556–563.',
    ],
  },
  'vulnerable-narcissist': {
    name: 'Уязвимый нарцисс',
    aka: 'Скрытый нарцисс, covert narcissist',
    tagline: 'Непризнанный гений, которого все недооценили.',
    color: '#8e6c8a',
    coreTrait: 'Хрупкое эго и скрытая обида',
    traits: { empathy: 3, rationality: 5, autonomy: 3, influence: 6, sensitivity: 10, masking: 5 },
    construct: 'Уязвимый нарциссизм (HSNS)',
    science: 'Уязвимый нарциссизм сочетает скрытое чувство превосходства с высокой тревожностью, обидчивостью и потребностью в признании. В отличие от грандиозного, он связан с низкой самооценкой, стыдом и пассивной враждебностью. В соцсетях его называют «скрытым нарциссом».',
    signs: ['Тихий, но сильно обижается на мелочи', 'Жалуется, что его не ценят', 'Завидует, но маскирует это сарказмом'],
    flags: ['Молчаливые обиды и наказание игнором', 'Роль жертвы в любом конфликте', 'Пассивная агрессия'],
    howTo: 'Замечайте вклад конкретно и искренне, но не берите на себя ответственность за его обиды. Проговаривайте ожидания прямо, не угадывайте.',
    refs: [
      'Hendin, H. M., & Cheek, J. M. (1997). Assessing hypersensitive narcissism. Journal of Research in Personality, 31(4), 588–599.',
      'Miller, J. D. et al. (2011). Grandiose and vulnerable narcissism: A nomological network analysis. Journal of Personality, 79(5), 1013–1042.',
    ],
  },
  machiavellian: {
    name: 'Макиавеллист',
    aka: 'Манипулятор, «серый кардинал»',
    tagline: 'Каждый разговор — партия в шахматы.',
    color: '#4a6a8a',
    coreTrait: 'Холодный расчёт и выгода',
    traits: { empathy: 4, rationality: 10, autonomy: 8, influence: 9, sensitivity: 1, masking: 9 },
    construct: 'Макиавеллизм (Mach-IV)',
    science: 'Макиавеллизм — расчётливое, долгосрочное манипулирование, цинизм в отношении людей и готовность использовать других ради цели. В отличие от психопатии, это стратегия, а не импульс: макиавеллист планирует и бережёт репутацию.',
    signs: ['Много спрашивает, мало рассказывает о себе', 'Вежлив и выверен в каждой фразе', 'Всегда знает, кто кому что сказал'],
    flags: ['Информация как валюта', 'Стравливает людей между собой (триангуляция)', 'Обещания с «мелким шрифтом»'],
    howTo: 'Будьте предсказуемы и прозрачны, договаривайтесь письменно. Не делитесь чужими секретами — он их соберёт. Предлагайте взаимную выгоду: это язык, который он уважает.',
    refs: [
      'Christie, R., & Geis, F. L. (1970). Studies in Machiavellianism. Academic Press.',
      'Jones, D. N., & Paulhus, D. L. (2014). Introducing the Short Dark Triad (SD3). Assessment, 21(1), 28–41.',
    ],
  },
  psychopath: {
    name: 'Психопат',
    aka: 'Социопат, «холодный», тролль',
    tagline: 'Обаятелен, бесстрашен — и ему всё равно.',
    color: '#5a5a5a',
    coreTrait: 'Драйв, азарт и бесстрашие',
    traits: { empathy: 1, rationality: 6, autonomy: 9, influence: 8, sensitivity: 1, masking: 7 },
    construct: 'Психопатия и тёмная тетрада',
    science: 'Триархическая модель описывает психопатию через смелость (бесстрашие), жестокость (низкая эмпатия, использование других) и расторможенность (импульсивность). В тёмной тетраде к ней близок бытовой садизм — удовольствие от чужого дискомфорта, сильнее всего связанное с троллингом. «Социопат» из соцсетей — это бытовое название того же паттерна.',
    signs: ['Невозмутим там, где другие нервничают', 'Поверхностное обаяние, быстрый переход к «делу»', 'Колкости и провокации «ради смеха»'],
    flags: ['Не испытывает вины и не извиняется', 'Риск за ваш счёт', '«Ты слишком серьёзно к этому относишься»'],
    howTo: 'Не рассчитывайте на сочувствие — апеллируйте к последствиям и интересам. На провокации отвечайте спокойно, коротко и скучно. Чёткие границы, условия и никаких ресурсов без гарантий.',
    refs: [
      'Patrick, C. J., Fowles, D. C., & Krueger, R. F. (2009). Triarchic conceptualization of psychopathy. Development and Psychopathology, 21(3), 913–938.',
      'Buckels, E. E., Jones, D. N., & Paulhus, D. L. (2013). Behavioral confirmation of everyday sadism. Psychological Science, 24(11), 2201–2209.',
      'Buckels, E. E., Trapnell, P. D., & Paulhus, D. L. (2014). Trolls just want to have fun. Personality and Individual Differences, 67, 97–102.',
    ],
  },
  borderline: {
    name: 'Пограничный тип',
    aka: 'ПРЛ, «эмоциональные качели»',
    flagsTitle: 'Что может быть трудно',
    tagline: 'От «ты лучший» до «ты меня предал» — за один вечер.',
    color: '#c75c7a',
    coreTrait: 'Шторм эмоций и страх потери',
    traits: { empathy: 8, rationality: 3, autonomy: 1, influence: 6, sensitivity: 10, masking: 3 },
    construct: 'Пограничный паттерн (ICD-11)',
    science: 'Кернберг описал пограничную организацию личности: диффузная идентичность, расщепление «всё хорошее / всё плохое», нестабильные отношения. В ICD-11 «пограничный паттерн» — признак с нестабильностью настроения, самооценки и отношений и страхом быть покинутым. Его ядро в отношениях — тревожный стиль привязанности и высокая чувствительность к отвержению. Здесь речь о выраженности паттерна, а не о диагнозе ПРЛ: поставить его может только специалист.',
    signs: ['Очень быстрое сближение и идеализация', 'Резкие перепады настроения', 'Сильная тревога при задержке ответа или отказе'],
    flags: ['Чередование идеализации и обесценивания', 'Тест на прочность: «докажи, что не уйдёшь»', 'Угождает из страха потерять, потом взрывается'],
    howTo: 'Стабильность и предсказуемость: говорите, когда ответите, и делайте. Признавайте чувства, но не принимайте обвинения на свой счёт. Держите спокойный тон и свои границы.',
    clinical: true,
    refs: [
      'Kernberg, O. F. (1967). Borderline personality organization. Journal of the American Psychoanalytic Association, 15(3), 641–685.',
      'World Health Organization (2022). ICD-11: 6D11.5 Borderline pattern.',
      'Downey, G., & Feldman, S. I. (1996). Implications of rejection sensitivity for intimate relationships. Journal of Personality and Social Psychology, 70(6), 1327–1343.',
      'Fraley, R. C., Waller, N. G., & Brennan, K. A. (2000). An item response theory analysis of self-report measures of adult attachment. Journal of Personality and Social Psychology, 78(2), 350–365.',
    ],
  },
  hsp: {
    name: 'Высокочувствительный',
    aka: 'Эмпат, HSP, «чувствительный»',
    flagsTitle: 'Что может быть трудно',
    tagline: 'Чувствует всё. Слишком всё.',
    color: '#6c8fb8',
    coreTrait: 'Глубина чувств и чуткость',
    traits: { empathy: 10, rationality: 7, autonomy: 5, influence: 2, sensitivity: 10, masking: 2 },
    construct: 'Сенсорная чувствительность (SPS)',
    science: 'Sensory Processing Sensitivity — врождённая черта глубокой обработки информации: сильная реакция на раздражители, эмоции других и тонкие детали. По оценкам, она есть у 20–30% людей. Это не расстройство: в хорошей среде такие люди расцветают сильнее других. «Эмпат» из соцсетей ближе всего именно к этой черте.',
    signs: ['Устаёт от шума, толпы и спешки', 'Считывает настроение комнаты', 'Долго обдумывает решения'],
    flags: ['Перегрузка и внезапный уход в себя', 'Впитывает чужие эмоции как свои', 'Избегает конфликтов любой ценой'],
    howTo: 'Тише, медленнее и без давления. Давайте время подумать. Обратная связь — бережно и наедине. Цените глубину: такие люди замечают то, что пропустят остальные.',
    refs: [
      'Aron, E. N., & Aron, A. (1997). Sensory-processing sensitivity and its relation to introversion and emotionality. Journal of Personality and Social Psychology, 73(2), 345–368.',
      'Greven, C. U. et al. (2019). Sensory Processing Sensitivity in the context of Environmental Sensitivity. Neuroscience & Biobehavioral Reviews, 98, 287–305.',
    ],
  },
  'control-freak': {
    name: 'Контролёр',
    aka: 'Контрол-фрик, микроменеджер',
    flagsTitle: 'Что может быть трудно',
    tagline: 'Уверен, что мир рухнет без его надзора — и контролирует каждый шаг и вздох.',
    color: '#2e6b75',
    coreTrait: 'Контроль и регламент',
    traits: { empathy: 2, rationality: 10, autonomy: 8, influence: 9, sensitivity: 3, masking: 2 },
    construct: 'Ананкастный паттерн (ICD-11)',
    science: 'Ананкастный домен (ICD-11) и обсессивно-компульсивная организация личности (OCPD) описывают фиксацию на правилах, стандартах, порядке и контроле над собой и окружающими. В основе лежит глубинная тревога перед неопределенностью и ошибками. Человек не способен делегировать («сделают не так»), склонен к постоянному микроменеджменту, педантизму и морализаторству, принося отношения и гибкость в жертву регламенту.',
    signs: [
      'Постоянно перепроверяет работу за другими и переделывает сам',
      'Раздражается при малейшем отклонении от плана или договоренностей',
      'Навязывает окружающим свои стандарты правильного поведения',
    ],
    flags: [
      'Тотальный микроменеджмент и отчет за каждый шаг',
      'Обесценивание чужих усилий («можно было сделать качественнее»)',
      'Неспособность признать собственную неправоту или пойти на компромисс',
    ],
    howTo: 'Фиксируйте рамки и зоны ответственности заранее. Не вступайте в эмоциональные споры о принципах — опирайтесь на факты, чек-листы и измеримые результаты. Давайте ему регулярную прозрачную предсказуемость, чтобы снизить его тревогу.',
    refs: [
      'World Health Organization (2022). ICD-11: 6D11.4 Anankastia domain in personality disorder.',
      'American Psychiatric Association (2013). Obsessive-Compulsive Personality Disorder. DSM-5.',
      'McWilliams, N. (2011). Psychoanalytic Diagnosis: Obsessive and Compulsive Personalities. Guilford Press.',
    ],
  },
  secure: {
    name: 'Надёжный тип',
    aka: 'Надёжная привязанность, «green flag»',
    flagsTitle: 'Где уязвим',
    tagline: 'Спокоен в близости, честен в конфликте.',
    color: '#cc785c',
    coreTrait: 'Устойчивость и прямота',
    traits: { empathy: 8, rationality: 8, autonomy: 8, influence: 5, sensitivity: 4, masking: 2 },
    construct: 'Надёжная привязанность + Light Triad',
    science: 'Надёжная привязанность — низкая тревога и низкое избегание: человеку комфортно и в близости, и в автономии. Её дополняет светлая триада — кантианство (люди — цель, а не средство), гуманизм и вера в людей, связанные с удовлетворённостью жизнью. В соцсетях это «зелёный флаг».',
    signs: ['Говорит о чувствах и потребностях прямо', 'Спокойно переносит отказ и критику', 'Искренне радуется чужим успехам'],
    flags: ['Уязвим для манипуляторов', 'Склонен верить в лучшее в людях', 'Может брать на себя роль «спасателя» в команде'],
    howTo: 'Будьте честны: фальшь он заметит. Отвечайте взаимностью и прямотой. В команде это опора: на него можно опереться в конфликте.',
    refs: [
      'Hazan, C., & Shaver, P. (1987). Romantic love conceptualized as an attachment process. Journal of Personality and Social Psychology, 52(3), 511–524.',
      'Bartholomew, K., & Horowitz, L. M. (1991). Attachment styles among young adults. Journal of Personality and Social Psychology, 61(2), 226–244.',
      'Kaufman, S. B., Yaden, D. B., Hyde, E., & Tsukayama, E. (2019). The Light vs. Dark Triad of Personality. Frontiers in Psychology, 10, 467.',
    ],
  },
  'anxious-preoccupied': {
    name: 'Тревожный тип',
    aka: 'Тревожная привязанность, «тревожник»',
    flagsTitle: 'Что может быть трудно',
    tagline: 'Чем дольше вы молчите, тем громче его тревога.',
    color: '#c98a3a',
    coreTrait: 'Страх быть оставленным',
    traits: { empathy: 8, rationality: 4, autonomy: 2, influence: 4, sensitivity: 9, masking: 3 },
    construct: 'Тревожная привязанность (ECR)',
    science: 'Высокая тревога и низкое избегание по шкале ECR — «озабоченный» стиль в модели Бартоломью. Близость нужна такому человеку как воздух, но он не уверен, что её заслуживает. Поэтому включаются стратегии гиперактивации: проверки, просьбы о подтверждениях, протест при малейшей дистанции. Пара «тревожный + избегающий» встречается часто и держится годами, хотя удовлетворённость в ней низкая — это и есть «ловушка» из соцсетей. Стиль привязанности не приговор: он меняется в надёжных отношениях.',
    signs: ['Перечитывает переписку и ищет скрытый смысл', 'Часто спрашивает «ты меня любишь?», «всё нормально?»', 'Сильно тревожится, если ответ задерживается'],
    flags: ['Протестное поведение: обиды, ревность, проверки телефона', 'Растворяется в партнёре и забывает о себе', 'Тянется к избегающим — и попадает в «догонялки»'],
    howTo: 'Предсказуемость снимает тревогу: говорите, когда ответите, и выполняйте. Успокаивайте словами и делами, но не поощряйте проверки. Поддерживайте его опору на себя: друзья, дела, своя жизнь.',
    refs: [
      'Bartholomew, K., & Horowitz, L. M. (1991). Attachment styles among young adults. Journal of Personality and Social Psychology, 61(2), 226–244.',
      'Kirkpatrick, L. A., & Davis, K. E. (1994). Attachment style, gender, and relationship stability: A longitudinal analysis. Journal of Personality and Social Psychology, 66(3), 502–512.',
      'Shaver, P. R., Schachner, D. A., & Nalbone, D. P. (2005). Attachment style, excessive reassurance seeking, relationship processes, and depression. Personality and Social Psychology Bulletin, 31(3), 343–359.',
    ],
  },
  avoidant: {
    name: 'Избегающий тип',
    aka: 'Избегающая привязанность',
    flagsTitle: 'Что может быть трудно',
    tagline: 'Чем ближе вы, тем дальше он.',
    color: '#5db8a6',
    coreTrait: 'Дистанция как защита',
    traits: { empathy: 4, rationality: 8, autonomy: 9, influence: 3, sensitivity: 6, masking: 4 },
    construct: 'Избегающий паттерн (ECR)',
    science: 'Избегающая привязанность — дискомфорт от близости и зависимости, опора только на себя. На сближение такие люди отвечают дистанцией и «выключением» эмоций: им трудно называть свои чувства и проще говорить о делах. Это защита от риска быть отвергнутым, а не равнодушие. Крайняя точка этого спектра — шизоидная отстранённость (домен Detachment в ICD-11): близость не пугает, а просто почти не нужна.',
    signs: ['Отвечает коротко и не сразу', 'На разговор о чувствах отвечает фактами', 'Исчезает после сближения'],
    flags: ['«Мне нужно пространство» в самый важный момент', 'Обесценивание близости', 'Гостинг'],
    howTo: 'Не давите и не гонитесь: давление усиливает дистанцию. Говорите конкретно, без эмоциональной нагрузки, спрашивайте «что тебе нужно?», а не «что ты чувствуешь?». Доверие растёт через предсказуемость.',
    refs: [
      'Bartholomew, K., & Horowitz, L. M. (1991). Attachment styles among young adults. Journal of Personality and Social Psychology, 61(2), 226–244.',
      'Fraley, R. C. et al. (2011). The ECR-RS questionnaire. Psychological Assessment, 23(3), 615–625.',
      'World Health Organization (2022). ICD-11: Personality disorder and related traits — Detachment domain.',
      'Mikulincer, M., & Shaver, P. R. (2016). Attachment in Adulthood: Structure, Dynamics, and Change (2nd ed.). Guilford Press.',
    ],
  },
  'fearful-avoidant': {
    name: 'Дезорганизованный тип',
    aka: 'Тревожно-избегающая привязанность, fearful-avoidant',
    flagsTitle: 'Что может быть трудно',
    tagline: 'Иди ко мне. Нет, стой. Нет, иди.',
    color: '#8a5a72',
    coreTrait: 'Хочет близости и боится её',
    traits: { empathy: 7, rationality: 4, autonomy: 5, influence: 3, sensitivity: 9, masking: 6 },
    construct: 'Боязливая привязанность (Bartholomew)',
    science: 'Высокая тревога и высокое избегание одновременно — «боязливый» стиль в четырёхкатегорийной модели Бартоломью: негативный образ и себя, и других. Человек тянется к близости и тут же защищается от неё, потому что ждёт боли. В соцсетях его называют «дезорганизованной привязанностью» — по аналогии с детским дезорганизованным типом, описанным Мэйн и Соломон. Привязанность — это измерения, а не ящики: у взрослых она распределена непрерывно, и стиль может смягчаться.',
    signs: ['Тёплый и открытый — и вдруг закрывается без видимой причины', 'Сам зовёт ближе и сам же отталкивает', 'Не верит, что его можно любить, и не верит, что ему не причинят боль'],
    flags: ['Качели «приближение — бегство»', 'Обрывает связь первым, «пока не бросили его»', 'Резкие разрывы и возвраты'],
    howTo: 'Не отвечайте на отталкивание обидой и не гонитесь: оставайтесь ровным и доступным. Маленькие шаги и предсказуемость важнее громких признаний. Если качели изматывают вас — это повод для границ, а не для спасательства.',
    refs: [
      'Bartholomew, K., & Horowitz, L. M. (1991). Attachment styles among young adults. Journal of Personality and Social Psychology, 61(2), 226–244.',
      'Main, M., & Solomon, J. (1990). Procedures for identifying infants as disorganized/disoriented during the Ainsworth Strange Situation. In Attachment in the Preschool Years. University of Chicago Press.',
      'Fraley, R. C., Hudson, N. W., Heffernan, M. E., & Segal, N. (2015). Are adult attachment styles categorical or dimensional? Journal of Personality and Social Psychology, 109(2), 354–368.',
    ],
  },
};

export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/**
 * Two layers, not one list: everyone has a character and, separately, an attachment style
 * (Bartholomew & Horowitz, 1991; types are prototypes on continuous dimensions, Haslam et al., 2012).
 */
export const LAYERS = Object.freeze({
  character: {
    title: 'Паттерны характера',
    desc: 'Как человек обращается с партнёром: от манипуляций до чуткости. Здоровый характер — это невысокие значения по всем паттернам, поэтому отдельного «нормального» паттерна здесь нет.',
    ids: ['dark-empath', 'grandiose-narcissist', 'vulnerable-narcissist', 'machiavellian', 'psychopath', 'borderline', 'hsp', 'control-freak'],
  },
  attachment: {
    title: 'Стиль привязанности',
    desc: 'Отдельный модуль: как человек сближается. Стиль есть у каждого, при любом характере, и определяется двумя шкалами — тревогой и избеганием.',
    ids: ['secure', 'anxious-preoccupied', 'avoidant', 'fearful-avoidant'],
  },
});

export const CHARACTER_IDS = LAYERS.character.ids;
export const ATTACHMENT_IDS = LAYERS.attachment.ids;

/**
 * Attachment styles are the four quadrants of two dimensions (ECR: Brennan, Clark & Shaver, 1998):
 * anxiety (fear of being left) and avoidance (discomfort with closeness).
 */
export const ATTACHMENT_MAP = Object.freeze({
  secure: { anxiety: 'low', avoidance: 'low', short: 'надёжная' },
  'anxious-preoccupied': { anxiety: 'high', avoidance: 'low', short: 'тревожная' },
  avoidant: { anxiety: 'low', avoidance: 'high', short: 'избегающая' },
  'fearful-avoidant': { anxiety: 'high', avoidance: 'high', short: 'дезорганизованная' },
});

/** Above the scale midpoint counts as high; answering «Отчасти» to everything lands in the secure quadrant. */
const HIGH = 0.5;

/**
 * @param {number} anxiety - 0..1
 * @param {number} avoidance - 0..1
 * @returns {string} attachment style id
 */
export function attachmentQuadrant(anxiety, avoidance) {
  const anx = anxiety > HIGH ? 'high' : 'low';
  const avo = avoidance > HIGH ? 'high' : 'low';
  return ATTACHMENT_IDS.find((id) => ATTACHMENT_MAP[id].anxiety === anx && ATTACHMENT_MAP[id].avoidance === avo);
}

/** «надёжная привязанность» */
export const attachmentLabel = (id) => `${ATTACHMENT_MAP[id].short} привязанность`;

export const ARCHETYPE_SLUGS = Object.freeze({
  'dark-empath': 'dark-empath',
  'dark': 'dark-empath',
  'grandiose-narcissist': 'grandiose-narcissist',
  'narcissist': 'grandiose-narcissist',
  'vulnerable-narcissist': 'vulnerable-narcissist',
  'covert': 'vulnerable-narcissist',
  'covert-narcissist': 'vulnerable-narcissist',
  'machiavellian': 'machiavellian',
  'machiavelli': 'machiavellian',
  'psychopath': 'psychopath',
  'psycho': 'psychopath',
  'hsp': 'hsp',
  'sensitive': 'hsp',
  'anxious-preoccupied': 'anxious-preoccupied',
  'anxious': 'anxious-preoccupied',
  'avoidant': 'avoidant',
  'avoid': 'avoidant',
  'borderline': 'borderline',
  'bpd': 'borderline',
  'fearful-avoidant': 'fearful-avoidant',
  'fearful': 'fearful-avoidant',
  'disorganized': 'fearful-avoidant',
  // The schizoid card folded into the avoidant spectrum; old links keep working.
  'schizoid': 'avoidant',
  'shizo': 'avoidant',
  'shizoid': 'avoidant',
  'secure': 'secure',
  'control-freak': 'control-freak',
  'controller': 'control-freak',
  'control': 'control-freak',
  'anankastic': 'control-freak',
  // Cyrillic aliases
  'шизоид': 'avoidant',
  'шизо': 'avoidant',
  'тревожный': 'anxious-preoccupied',
  'дезорганизованный': 'fearful-avoidant',
  'нарцисс': 'grandiose-narcissist',
  'эмпат': 'dark-empath',
  'макиавелли': 'machiavellian',
  'психопат': 'psychopath',
  'надежный': 'secure',
  'надёжный': 'secure',
  'контролер': 'control-freak',
  'контролёр': 'control-freak',
  'перфекционист': 'control-freak',
});

// List an id here until /img/archetypes/<id>.webp exists: such a card shows a monogram placeholder.
const IMAGES_PENDING = new Set();
export const IMAGES_READY = new Set(ARCHETYPE_IDS.filter((id) => !IMAGES_PENDING.has(id)));

/** @param {string} id */
export const archetypeImage = (id) => (IMAGES_READY.has(id) ? `/img/archetypes/${id}.webp` : null);

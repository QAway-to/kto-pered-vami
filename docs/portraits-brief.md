# Портреты архетипов: единый стиль

Стандарт для любого агента или человека, который делает портрет персонажа (Antigravity, Gemini, Claude, вручную).

Цель: каждый новый портрет выглядит так, будто его нарисовала та же студия, что и остальные карточки в `public/img/archetypes/`.

## Три правила, без которых стиль расползается

1. **Всегда прикладывай картинку-референс.** Это `public/img/archetypes/dark-empath.webp`, один и тот же файл для каждого портрета. Стиль держит картинка, а не слова. По одному тексту каждая генерация уходит в свою сторону; именно поэтому старые портреты получались разными. Если инструмент не принимает WebP, сначала сконвертируй референс в PNG.
2. **Референс — только для стиля.** В промпте обязательно должна быть фраза «STYLE REFERENCE ONLY… Do NOT copy the reference person's face, hair, earrings or clothes». Иначе модель нарисует того же человека в другой одежде.
3. **Не меняй стилевой блок.** Меняется только описание человека и цвет фона. Свет, кадр, формат и манера всегда одни и те же.

## Промпт-шаблон

Копируй целиком и подставляй описание в последний абзац. Промпт пишется на английском: модели держат стиль на нём стабильнее.

```
The attached image is the STYLE REFERENCE ONLY. Paint a new portrait in exactly the same style and rendering:
stylized 2.5D digital painting, Pixar-meets-editorial illustration, soft painterly skin, large expressive eyes,
warm cinematic side light with a soft glow, smooth softly blurred gradient background, chest-up framing with the face
in the upper half, slight head tilt, vertical 4:5. Do NOT copy the reference person's face, hair, earrings or clothes:
draw a completely different person as described below. No text, no logos, no watermark, exactly one person.

<PERSON>
```

### Что писать в `<PERSON>`

Пиши 4–5 предложений, по пунктам ниже. Больше не нужно: длинное описание вытесняет стиль.

- **Кто:** возраст, пол, имя. Имя из `PERSONA_NAMES` в `public/js/lab-data.js`; биография — в `src/personas.js`.
- **Внешность:** волосы, глаза, одна-две приметы (веснушки, щетина).
- **Выражение лица, которое показывает паттерн типа.** Это главное в портрете: тревога в глазах, взгляд «свысока», настороженная улыбка.
- **Одежда и ровно один предмет-символ:** телефон, фотоаппарат, кружка.
- **Фон:** «blurred gradient» в цвете карточки типа (`color` в `public/js/archetypes.js`).
- **Настроение:** одна фраза.

Чего нельзя:
- карикатура и «злодейство»;
- сексуализация;
- оружие и кровь;
- символические сцены на фоне (вихри, предметы, другие люди);
- текст в кадре.

## Как генерировать

- **Antigravity:** встроенная генерация картинок. Приложи `dark-empath.webp` как изображение и вставь промпт целиком.
- **Gemini API:** модель `gemini-3-pro-image`, aspect ratio `4:5`, `responseModalities: ['IMAGE']`, референс — `inline_data`. Ключ никогда не вставляй в код и в чат.
- Делай 2 варианта и выбирай тот, где паттерн типа лучше читается по лицу.

## Технические требования к файлу

- **Формат:** WebP, 640 × 800, качество около 82, до 80 КБ. Обрезка от верха, чтобы не потерять макушку.
- **Путь:** `public/img/archetypes/<id>.webp`, где `<id>` — ключ архетипа из `ARCHETYPES` в `public/js/archetypes.js`.
- **Подключение:** если id стоит в `IMAGES_PENDING` в `public/js/archetypes.js`, убери его оттуда.
- **Проверка:** `npm test`. Тест «every archetype with artwork has its portrait file on disk» проверит, что файл на месте.

## Проверка перед коммитом

- Поставь портрет рядом с `dark-empath.webp`: свет, мягкость кожи и фон должны совпадать.
- В кружке 64 × 64 (ростер Арены) лицо узнаётся.
- Фон перекликается с цветом карточки типа.
- В коммит идут только файл портрета и правка `archetypes.js`. Не используй `git add -A`: в этой папке параллельно работают другие агенты.

## Примеры, сделанные по этому стандарту

### Ника — тревожный тип (`anxious-preoccupied`)

```
A 28-year-old woman, Nika. Warm honey-brown wavy hair loosely tied with strands falling out,
light freckles, big hopeful but worried eyes glancing slightly up, a gentle half-smile with tension in the brows.
Cozy oversized amber knit sweater. She holds a smartphone close to her chest with both hands, the screen glowing softly.
Background: warm amber-to-peach blurred gradient. Mood: tender, anxious waiting for a reply.
```

### Тимур — дезорганизованный тип (`fearful-avoidant`)

```
A 30-year-old man, Timur. Dark tousled hair, short stubble, expressive dark eyes with a guarded,
wistful look, a faint smile that does not reach the eyes. Muted plum jacket over a dark t-shirt, a vintage film camera
on a strap. One arm crossed protectively over his chest. Background: blurred gradient split diagonally, warm rose-gold
light on one side and cool slate-blue shadow on the other. Mood: longing and hesitation at once.
```

# Портреты для двух новых архетипов

Задание для Antigravity или любого генератора. Нужны два портрета в стиле остальных карточек из `public/img/archetypes/`. Главный референс — `borderline.webp`: та же студия, тот же уровень детализации.

## Общие требования

- **Формат:** 640 × 800 (4:5), WebP, качество 85, до 80 КБ.
- **Кадр:** портрет по грудь, лицо в верхней половине кадра, взгляд в камеру или чуть мимо.
- **Стиль:** stylized 2.5D concept art, «Pixar meets editorial illustration». Мягкие формы, выразительная мимика, насыщенный цвет, кинематографичный свет, живописный фон-символ (как вихрь у пограничного типа). Без фотореализма и без аниме.
- **Нельзя:** текст, логотипы, водяные знаки, лишние люди, лишние пальцы, сексуализация.
- **Куда класть:**
  - `public/img/archetypes/anxious-preoccupied.webp`
  - `public/img/archetypes/fearful-avoidant.webp`

  Затем убрать оба id из `IMAGES_PENDING` в `public/js/archetypes.js`. Тест `every archetype with artwork has its portrait file on disk` проверит, что файлы на месте.

**Общий префикс промпта:**

```
Stylized 2.5D concept art portrait, Pixar-meets-editorial illustration, chest-up, 4:5 vertical,
expressive face, rich saturated colors, cinematic warm key light from top-left, soft cool rim light,
painterly symbolic background, high detail hair and fabric, no text, no watermark, single person
```

## 1. Тревожный тип — Ника, 28 лет, SMM-менеджер

Цвет карточки `#c98a3a` (тёплый янтарь). Символ — телефон и ожидание ответа.

```
<prefix>, a 28-year-old woman, warm honey-brown wavy hair loosely tied, soft freckles, big hopeful
but worried eyes looking slightly up, gentle half-smile with tension in the brows, cozy oversized
amber knit sweater, holding a smartphone close to her chest with both hands, the screen glows softly
with three typing dots, background: swirling warm amber and peach clouds with tiny floating message
bubbles fading into the distance, a single small clock in the bokeh, mood: tender, anxious waiting
```

Что должно читаться: тепло и вовлечённость плюс тревога ожидания. Не жертва и не истерика.

## 2. Дезорганизованный тип — Тимур, 30 лет, фотограф

Цвет карточки `#8a5a72` (пыльная слива). Символ — «иди ко мне / отойди».

```
<prefix>, a 30-year-old man, dark tousled hair, short stubble, expressive dark eyes with a guarded
look, one hand reaching slightly toward the viewer, the other arm crossed protectively over his chest,
vintage film camera on a strap, muted plum and dusty-rose layered jacket over a dark t-shirt,
background split diagonally: warm rose-gold light on the reaching side, cool slate-blue shadow on the
guarded side, soft painterly brushstrokes, mood: longing and hesitation at the same time
```

Что должно читаться: противоречие «тянется и закрывается» в одной позе. Не злодей и не холодный тип.

## Проверка перед заливкой

- Оба портрета рядом с `borderline.webp` и `avoidant.webp` выглядят как одна серия.
- В квадратной миниатюре 64 × 64 (ростер Арены) лицо узнаётся.
- Цвет фона перекликается с цветом карточки.

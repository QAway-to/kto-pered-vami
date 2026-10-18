# Кто перед вами

Тренажёр общения по модели DISC для комьюнити (веб + Telegram Mini App).

- **Мой тип** — тест из 12 вопросов, профиль D / I / S / C.
- **Кейсы** — угадайте тип по короткой жизненной ситуации.
- **Диалог** — переписка с ИИ-персонажем со скрытым типом (Claude), затем разбор от ИИ-тренера.

## Запуск

```bash
npm install
DEEPSEEK_API_KEY=sk-... npm start   # http://localhost:3000
npm test
```

Без ключа тест и кейсы работают, а диалоги отключены.

## ИИ-провайдер

| `AI_PROVIDER` | Ключ | Модель | Назначение |
|---|---|---|---|
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-flash` | демо, дёшево |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-opus-5-5` | продакшен |

Переключение — одна переменная окружения, код менять не нужно. Если `AI_PROVIDER` не задан, берётся тот провайдер, чей ключ есть (DeepSeek в приоритете).

## Деплой на Render

1. Render → **New → Blueprint** → выбрать этот репозиторий (`render.yaml` подхватится сам).
2. Ввести `DEEPSEEK_API_KEY`. Поле `ANTHROPIC_API_KEY` пока оставить пустым.
3. Поставить лимит трат у провайдера. `AI_CALLS_PER_HOUR` (по умолчанию 300) — общий лимит ИИ-запросов в час на сервер.

## Telegram Mini App

@BotFather → `/newapp` (или `/setmenubutton`) → указать URL сервиса на Render. Тема (светлая или тёмная) подхватывается из Telegram.

## Стек

Node 22, Express, DeepSeek (OpenAI-совместимый API) или `@anthropic-ai/sdk`, чистый HTML/CSS/JS, дизайн-система Claude.

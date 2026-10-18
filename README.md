# Кто перед вами

Тренажёр общения по модели DISC для комьюнити (веб + Telegram Mini App).

- **Мой тип** — тест из 12 вопросов, профиль D / I / S / C.
- **Кейсы** — угадайте тип по короткой жизненной ситуации.
- **Диалог** — переписка с ИИ-персонажем со скрытым типом (Claude), затем разбор от ИИ-тренера.

## Запуск

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start   # http://localhost:3000
npm test
```

Без `ANTHROPIC_API_KEY` тест и кейсы работают, а диалоги отключены.

## Деплой на Render

1. Render → **New → Blueprint** → выбрать этот репозиторий (`render.yaml` подхватится сам).
2. Ввести `ANTHROPIC_API_KEY`.
3. Поставить лимит трат в Anthropic Console. `AI_CALLS_PER_HOUR` (по умолчанию 300) — общий лимит ИИ-запросов в час на сервер.

## Telegram Mini App

@BotFather → `/newapp` (или `/setmenubutton`) → указать URL сервиса на Render. Тема (светлая или тёмная) подхватывается из Telegram.

## Стек

Node 22, Express, `@anthropic-ai/sdk` (`claude-opus-5-5`, серверный fallback при отказах), чистый HTML/CSS/JS, дизайн-система Claude.

import { createApp } from './src/app.js';
import { createProviderFromEnv } from './src/llm.js';
import { createAnalytics } from './src/analytics.js';
import { createBotApi } from './src/telegram.js';
import { deriveWebhookSecret } from './src/auth.js';

const port = Number(process.env.PORT) || 3000;
const { llm, reason } = createProviderFromEnv(process.env);
const aiCallsPerHour = Number(process.env.AI_CALLS_PER_HOUR) || 300;
const analytics = createAnalytics({ apiKey: process.env.POSTHOG_KEY, host: process.env.POSTHOG_HOST });

if (llm) {
  console.info(`AI provider: ${llm.name} (${llm.model})`);
} else {
  console.warn(`${reason}: AI dialogs are disabled, test and cases still work.`);
}
if (!analytics) console.warn('POSTHOG_KEY not set: product analytics is disabled.');

/**
 * Auth from env. AUTH_MODE=off runs without login (local dev only). Otherwise Telegram auth is required;
 * if it is misconfigured the AI trainings stay closed rather than open to everyone.
 * @returns {Promise<import('./src/auth-routes.js').AuthConfig>}
 */
async function authFromEnv(env) {
  const production = env.NODE_ENV === 'production' || Boolean(env.RENDER);
  if (env.AUTH_MODE === 'off' && production) {
    console.error('AUTH_MODE=off is ignored in production: login stays on.');
  } else if (env.AUTH_MODE === 'off') {
    console.warn('AUTH_MODE=off: login and subscription checks are disabled. Never use this in production.');
    return { mode: 'open' };
  }
  const botToken = env.AUTORIZATION_BOT?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  const sessionSecret = env.SESSION_SECRET ?? '';
  const missing = [
    !botToken && 'AUTORIZATION_BOT',
    !chatId && 'TELEGRAM_CHAT_ID',
    sessionSecret.length < 32 && 'SESSION_SECRET (32+ chars)',
  ].filter(Boolean);
  if (missing.length) {
    console.warn(`Auth is not configured (${missing.join(', ')}): AI trainings are closed.`);
    return { mode: 'unavailable', reason: 'not configured' };
  }

  const bot = createBotApi({ token: botToken });
  let botUsername;
  try {
    botUsername = (await bot.getMe()).username;
  } catch (err) {
    console.error(`Bot check failed: ${err.message}. AI trainings are closed.`);
    return { mode: 'unavailable', reason: 'bot unreachable' };
  }

  const publicUrl = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '') || null;
  if (publicUrl) {
    try {
      await bot.setWebhook(`${publicUrl}/api/telegram/webhook`, deriveWebhookSecret(sessionSecret));
      console.info(`Telegram webhook set for @${botUsername}`);
    } catch (err) {
      console.error(`setWebhook failed: ${err.message}. Browser login through the bot will not work.`);
    }
  } else {
    console.warn('PUBLIC_URL is not set: webhook not registered, browser login through the bot is off.');
  }

  return {
    mode: 'telegram',
    bot,
    botToken,
    botUsername,
    chatId: /^-?\d+$/.test(chatId) ? Number(chatId) : chatId,
    channelUrl: env.TELEGRAM_CHANNEL_URL?.trim() || null,
    sessionSecret,
    publicUrl,
  };
}

const auth = await authFromEnv(process.env);
console.info(`Auth mode: ${auth.mode}`);

createApp({ llm, analytics, aiCallsPerHour, auth }).listen(port, () => {
  console.info(`Listening on :${port}`);
});

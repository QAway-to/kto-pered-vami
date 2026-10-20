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
  // Auth is disabled (open mode) by default or when AUTH_MODE !== 'on'. Set AUTH_MODE=on to require Telegram auth.
  if (env.AUTH_MODE !== 'on') {
    console.warn('Auth is disabled (open mode): login and subscription checks are skipped. Full access to trainings.');
    return { mode: 'open' };
  }
  const botToken = env.AUTORIZATION_BOT?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  const sessionSecret = env.SESSION_SECRET ?? '';
  const missing = [
    !botToken && 'AUTORIZATION_BOT',
    sessionSecret.length < 32 && 'SESSION_SECRET (32+ chars)',
  ].filter(Boolean);
  if (missing.length) {
    console.warn(`Auth is not configured (${missing.join(', ')}): AI trainings are closed.`);
    return { mode: 'unavailable', reason: 'not configured' };
  }
  // The chat ID is optional at start: the bot must already run to answer /chatid in the club chat.
  // Without it nobody counts as a subscriber, so only the free tries work.
  if (!chatId) {
    console.warn('TELEGRAM_CHAT_ID is not set: subscriptions are not checked, everyone gets trial access only. Send /chatid in the club chat to get the ID.');
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
    chatId: !chatId ? null : /^-?\d+$/.test(chatId) ? Number(chatId) : chatId,
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

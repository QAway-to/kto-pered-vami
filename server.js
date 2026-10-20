import { createApp } from './src/app.js';
import { createProviderFromEnv } from './src/llm.js';
import { createAnalytics } from './src/analytics.js';

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

createApp({ llm, analytics, aiCallsPerHour }).listen(port, () => {
  console.info(`Listening on :${port}`);
});

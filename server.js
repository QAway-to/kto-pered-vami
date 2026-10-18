import { createApp } from './src/app.js';
import { createProviderFromEnv } from './src/llm.js';

const port = Number(process.env.PORT) || 3000;
const { llm, reason } = createProviderFromEnv(process.env);
const aiCallsPerHour = Number(process.env.AI_CALLS_PER_HOUR) || 300;

if (llm) {
  console.info(`AI provider: ${llm.name} (${llm.model})`);
} else {
  console.warn(`${reason}: AI dialogs are disabled, test and cases still work.`);
}

createApp({ llm, aiCallsPerHour }).listen(port, () => {
  console.info(`Listening on :${port}`);
});

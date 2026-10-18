import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 3000;
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: 45_000, maxRetries: 1 }) : null;

if (!client) {
  console.warn('ANTHROPIC_API_KEY is not set: AI dialogs are disabled, test and cases still work.');
}

const aiCallsPerHour = Number(process.env.AI_CALLS_PER_HOUR) || 300;

createApp({ client, aiCallsPerHour }).listen(port, () => {
  console.info(`Listening on :${port}`);
});

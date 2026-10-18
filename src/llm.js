// LLM provider layer: the app talks to `provider.complete()`, never to a vendor SDK directly.
// Switch with AI_PROVIDER=deepseek|anthropic (default: whichever key is set, DeepSeek first).

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-5-5';
export const DEEPSEEK_MODEL = 'deepseek-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const CHAT_TIMEOUT_MS = 45_000;
const ANALYSIS_TIMEOUT_MS = 120_000; // the debrief thinks before answering

/** Upstream failure with the HTTP status (0 = network/timeout). */
export class LlmError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

/**
 * @typedef {{role: 'user'|'assistant', content: string}} ChatMessage
 * @typedef {{system: string, messages: ChatMessage[], mode: 'chat'|'analysis', maxTokens: number}} CompleteParams
 * @typedef {{name: string, model: string, complete: (p: CompleteParams) => Promise<string|null>}} LlmProvider
 */

/**
 * @param {Pick<Anthropic, 'beta'>} client
 * @returns {LlmProvider}
 */
export function createClaudeProvider(client) {
  return {
    name: 'anthropic',
    model: CLAUDE_MODEL,
    async complete({ system, messages, mode, maxTokens }) {
      let response;
      try {
        response = await client.beta.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: mode === 'chat' ? 'low' : 'medium' },
          system,
          messages,
        });
      } catch (err) {
        if (err instanceof Anthropic.APIError) throw new LlmError(err.message, err.status ?? 0);
        throw err;
      }
      if (response.stop_reason === 'refusal') return null;
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      return text || null;
    },
  };
}

/**
 * DeepSeek via its OpenAI-compatible chat completions endpoint.
 * Chat turns run without thinking (fast, cheap); the debrief runs with thinking.
 * @param {{apiKey: string, baseUrl?: string, model?: string, fetchImpl?: typeof fetch}} options
 * @returns {LlmProvider}
 */
export function createDeepSeekProvider({
  apiKey,
  baseUrl = DEEPSEEK_BASE_URL,
  model = DEEPSEEK_MODEL,
  fetchImpl = fetch,
}) {
  return {
    name: 'deepseek',
    model,
    async complete({ system, messages, mode, maxTokens }) {
      const isChat = mode === 'chat';
      const body = {
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: maxTokens,
        thinking: { type: isChat ? 'disabled' : 'enabled' },
        ...(isChat ? { temperature: 1.0 } : { reasoning_effort: 'high' }),
      };
      let res;
      try {
        res = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(isChat ? CHAT_TIMEOUT_MS : ANALYSIS_TIMEOUT_MS),
        });
      } catch (err) {
        throw new LlmError(`DeepSeek request failed: ${err?.name ?? 'Error'}`, 0);
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new LlmError(`DeepSeek HTTP ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }
      let data;
      try {
        data = await res.json();
      } catch (err) {
        // The timeout also covers reading the body: report it as a network failure, not bad JSON.
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          throw new LlmError('DeepSeek response timed out', 0);
        }
        throw new LlmError('DeepSeek returned invalid JSON', 502);
      }
      const choice = data?.choices?.[0];
      if (!choice || choice.finish_reason === 'content_filter') return null;
      const text = typeof choice.message?.content === 'string' ? choice.message.content.trim() : '';
      return text || null;
    },
  };
}

/**
 * Picks the provider from env. Returns the provider, or null plus a reason for the startup log.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{llm: LlmProvider|null, reason: string|null}}
 */
export function createProviderFromEnv(env) {
  const deepseekKey = env.DEEPSEEK_API_KEY?.trim();
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const explicit = (env.AI_PROVIDER ?? '').trim().toLowerCase();
  const wanted = explicit || (deepseekKey ? 'deepseek' : anthropicKey ? 'anthropic' : '');

  if (wanted === 'deepseek') {
    return deepseekKey
      ? { llm: createDeepSeekProvider({ apiKey: deepseekKey }), reason: null }
      : { llm: null, reason: 'AI_PROVIDER=deepseek, but DEEPSEEK_API_KEY is not set' };
  }
  if (wanted === 'anthropic') {
    return anthropicKey
      ? {
        llm: createClaudeProvider(new Anthropic({ apiKey: anthropicKey, timeout: ANALYSIS_TIMEOUT_MS, maxRetries: 1 })),
        reason: null,
      }
      : { llm: null, reason: 'AI_PROVIDER=anthropic, but ANTHROPIC_API_KEY is not set' };
  }
  if (explicit) return { llm: null, reason: `Unknown AI_PROVIDER "${explicit}" (expected deepseek or anthropic)` };
  return { llm: null, reason: 'No AI key set (DEEPSEEK_API_KEY or ANTHROPIC_API_KEY)' };
}

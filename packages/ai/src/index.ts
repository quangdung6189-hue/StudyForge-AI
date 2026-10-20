import { z } from 'zod';

export class AIGatewayError extends Error {
  constructor(public readonly code: 'CONFIGURATION' | 'UPSTREAM' | 'INVALID_OUTPUT' | 'TIMEOUT', message: string) { super(message); }
}
export type GatewayConfig = { baseUrl: string; apiKey: string; generateModel: string; reviewModel: string; timeoutMs?: number };

/** OpenAI-compatible chat completions, suitable for 9Router/Gemini routing. Server use only. */
export class AIGateway {
  constructor(private readonly config: GatewayConfig) {
    if (!config.baseUrl || !config.apiKey || !config.generateModel || !config.reviewModel) throw new AIGatewayError('CONFIGURATION', 'AI gateway environment is incomplete');
    const url = new URL(config.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol) || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new AIGatewayError('CONFIGURATION', 'Remote AI gateway must use HTTPS');
  }
  async structured<T extends z.ZodType>(input: {
    schema: T; name: string; system: string; prompt: string; purpose?: 'generate' | 'review';
  }): Promise<z.infer<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(this.config.timeoutMs ?? 120000),
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.purpose === 'review' ? this.config.reviewModel : this.config.generateModel,
          messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.prompt }],
          response_format: { type: 'json_schema', json_schema: { name: input.name, strict: true, schema: z.toJSONSchema(input.schema, { unrepresentable: 'any' }) } },
        }),
      });
    } catch (error) {
      throw new AIGatewayError((error as Error).name === 'TimeoutError' ? 'TIMEOUT' : 'UPSTREAM', 'AI gateway request failed');
    }
    if (!response.ok) throw new AIGatewayError('UPSTREAM', `AI gateway returned HTTP ${response.status}`);
    // Do not include raw model output or API credentials in errors/logs.
    try {
      if (Number(response.headers.get('content-length') ?? 0) > 4_000_000) throw new Error('Response too large');
      const payload = await response.text();
      if (payload.length > 4_000_000) throw new Error('Response too large');
      const data = JSON.parse(payload) as { choices?: { finish_reason?: string; message?: { content?: string; refusal?: string } }[] };
      const choice = data.choices?.[0];
      if (!choice?.message?.content || choice.message.refusal || choice.finish_reason === 'length') throw new Error('Incomplete/refused output');
      return input.schema.parse(JSON.parse(choice.message.content));
    } catch { throw new AIGatewayError('INVALID_OUTPUT', 'AI returned an invalid structured response'); }
  }
}
export function gatewayFromEnv(): AIGateway {
  return new AIGateway({
    baseUrl: process.env.AI_BASE_URL ?? '', apiKey: process.env.AI_API_KEY ?? '',
    generateModel: process.env.AI_MODEL_GENERATE ?? '', reviewModel: process.env.AI_MODEL_REVIEW ?? '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 120000),
  });
}

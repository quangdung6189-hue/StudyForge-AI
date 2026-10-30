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
  /** Stream real provider text; buffer incomplete SSE frames, including split UTF-8. */
  async *streamText(input: { system: string; messages: { role: 'user' | 'assistant'; content: string; images?: string[] }[]; signal?: AbortSignal }): AsyncGenerator<string> {
    const timeout = AbortSignal.timeout(60000), signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, { method: 'POST', redirect: 'error', cache: 'no-store', signal,
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.generateModel, stream: true, max_tokens: 1400, messages: [{ role: 'system', content: input.system }, ...input.messages.map(message => ({ role: message.role, content: message.images?.length ? [{ type: 'text', text: message.content }, ...message.images.map(url => ({ type: 'image_url', image_url: { url } }))] : message.content }))] }),
      });
    } catch { throw new AIGatewayError(timeout.aborted ? 'TIMEOUT' : 'UPSTREAM', 'Không kết nối được AI. Hãy thử lại.'); }
    if (!response.ok || !response.body) throw new AIGatewayError('UPSTREAM', 'AI đang bận. Hãy thử lại sau.');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', output = 0, finished = false;
    const parse = (frame: string) => {
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) return '';
      if (data.trim() === '[DONE]') { finished = true; return ''; }
      const event = JSON.parse(data);
      if (event.error) throw new AIGatewayError('UPSTREAM', 'AI đang bận. Hãy thử lại.');
      const content = event.choices?.[0]?.delta?.content;
      if (event.choices?.[0]?.finish_reason) finished = true;
      return typeof content === 'string' ? content : '';
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, '\n');
        if (buffer.length > 150000) throw new AIGatewayError('INVALID_OUTPUT', 'Phản hồi AI quá lớn.');
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const delta = parse(buffer.slice(0, end)); buffer = buffer.slice(end + 2);
          if (delta) { output += delta.length; if (output > 24000) throw new AIGatewayError('INVALID_OUTPUT', 'Câu trả lời quá dài. Hãy chia nhỏ câu hỏi.'); yield delta; }
        }
        if (done) break;
      }
      if (buffer.trim()) { const delta = parse(buffer); output += delta.length; if (delta) yield delta; }
      if (!output || !finished) throw new AIGatewayError('UPSTREAM', 'Phản hồi AI chưa hoàn tất. Hãy thử lại.');
    } catch(error) { if (error instanceof AIGatewayError) throw error; throw new AIGatewayError(timeout.aborted ? 'TIMEOUT' : 'UPSTREAM', 'Kết nối AI bị ngắt. Hãy thử lại.'); }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  async structured<T extends z.ZodType>(input: {
    schema: T; name: string; system: string; prompt: string; purpose?: 'generate' | 'review';
    normalize?: (value: unknown) => unknown;
    signal?: AbortSignal; timeoutMs?: number; images?: string[];
  }): Promise<z.infer<T>> {
    let response: Response;
    const jsonSchema = z.toJSONSchema(input.schema, { unrepresentable: 'any' });
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs ?? this.config.timeoutMs ?? 120000)]) : AbortSignal.timeout(input.timeoutMs ?? this.config.timeoutMs ?? 120000),
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: input.purpose === 'review' ? this.config.reviewModel : this.config.generateModel,
          stream: false,
          // Keep the schema visible to routers whose provider adapter drops response_format.
          messages: [{ role: 'system', content: `${input.system}\n\nReturn only JSON matching this schema, with every required field (including empty arrays):\n${JSON.stringify(jsonSchema)}` }, { role: 'user', content: input.images?.length ? [{ type: 'text', text: input.prompt }, ...input.images.map(url => ({ type: 'image_url', image_url: { url } }))] : input.prompt }],
          response_format: { type: 'json_schema', json_schema: { name: input.name, strict: true, schema: jsonSchema } },
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
      const content = choice.message.content.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
      const output: unknown = JSON.parse(content);
      return input.schema.parse(input.normalize ? input.normalize(output) : output);
    } catch (error) { throw new AIGatewayError((error as Error).name === 'TimeoutError' ? 'TIMEOUT' : 'INVALID_OUTPUT', 'AI returned an invalid structured response'); }
  }
}
import { config } from 'dotenv';
import path from 'node:path';
import { existsSync } from 'node:fs';

function loadEnvIfNeeded() {
  if (process.env.AI_API_KEY) return;
  let curr = path.resolve(process.cwd());
  while (curr && path.dirname(curr) !== curr) {
    const envPath = path.join(curr, '.env');
    if (existsSync(envPath)) {
      config({ path: envPath, quiet: true });
      break;
    }
    curr = path.dirname(curr);
  }
}

export function gatewayFromEnv(): AIGateway {
  loadEnvIfNeeded();
  return new AIGateway({
    baseUrl: process.env.AI_BASE_URL ?? '', apiKey: process.env.AI_API_KEY ?? '',
    generateModel: process.env.AI_MODEL_GENERATE || 'ag/gemini-3.8-flash-high', reviewModel: process.env.AI_MODEL_REVIEW || 'ag/gemini-3.8-flash-high',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 120000),
  });
}

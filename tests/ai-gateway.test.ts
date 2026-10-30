import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AIGateway, gatewayFromEnv } from '@studyforge/ai';

const config = { baseUrl: 'http://127.0.0.1:20128/v1', apiKey: 'test-only-key', generateModel: 'ag/gemini-3.8-flash-high', reviewModel: 'ag/gemini-3.8-flash-high' };
const input = { schema: z.strictObject({ ok: z.literal(true) }), name: 'Probe', system: 'Return JSON', prompt: 'Check connection' };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('9Router AI gateway', () => {
  it('sends streamed user photos as vision content blocks to the same High model', async () => {
    const fetchMock=vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"Image read"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal('fetch',fetchMock);
    for await(const _ of new AIGateway(config).streamText({system:'Read',messages:[{role:'user',content:'What is shown?',images:['data:image/jpeg;base64,fixture']}]})) {}
    const body=JSON.parse(fetchMock.mock.calls[0][1].body);expect(body.model).toBe(config.generateModel);expect(body.messages[1].content).toEqual([{type:'text',text:'What is shown?'},{type:'image_url',image_url:{url:'data:image/jpeg;base64,fixture'}}]);
  });
  it('streams split UTF-8 SSE frames using Flash High and ignores provider reasoning fields', async () => {
    const bytes = new TextEncoder().encode('data: {"choices":[{"delta":{"reasoning_content":"internal","content":"Đáp"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" án"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({ start(controller) { for (let i=0;i<bytes.length;i+=3) controller.enqueue(bytes.slice(i,i+3)); controller.close(); } })));
    vi.stubGlobal('fetch', fetchMock); const output: string[] = [];
    for await (const text of new AIGateway(config).streamText({ system:'Help', messages:[{role:'user',content:'Test'}] })) output.push(text);
    expect(output.join('')).toBe('Đáp án');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body); expect(body.model).toBe(config.generateModel); expect(body.stream).toBe(true);
  });
  it('rejects a truncated stream instead of silently declaring it complete', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')));
    const collect = async () => { for await (const _ of new AIGateway(config).streamText({system:'Help',messages:[{role:'user',content:'Test'}]})) {} };
    await expect(collect()).rejects.toMatchObject({code:'UPSTREAM'});
  });
  it('explicitly requests non-streaming schema JSON using the configured Flash High model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await new AIGateway(config).structured(input)).toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
    expect(body.model).toBe('ag/gemini-3.8-flash-high');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages[0].content).toContain(JSON.stringify(body.response_format.json_schema.schema));
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:20128/v1/chat/completions');
  });
  it('defaults both generation and review to Flash High without a model override', async () => {
    vi.stubEnv('AI_BASE_URL', config.baseUrl); vi.stubEnv('AI_API_KEY', config.apiKey);
    vi.stubEnv('AI_MODEL_GENERATE', ''); vi.stubEnv('AI_MODEL_REVIEW', '');
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }))));
    vi.stubGlobal('fetch', fetchMock);
    await gatewayFromEnv().structured(input);
    await gatewayFromEnv().structured({ ...input, purpose: 'review' });
    expect(fetchMock.mock.calls.map(call => JSON.parse(call[1].body).model)).toEqual([config.generateModel, config.reviewModel]);
  });
  it('rejects provider authentication errors without exposing the response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream diagnostic', { status: 401 })));
    await expect(new AIGateway(config).structured(input)).rejects.toMatchObject({ code: 'UPSTREAM', message: 'AI gateway returned HTTP 401' });
  });
  it('normalizes a provider envelope before validating all required question fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '[{"ok":true}]' } }] }))));
    const schema = z.strictObject({ questions: z.array(input.schema) });
    expect(await new AIGateway(config).structured({ ...input, schema, normalize: value => Array.isArray(value) ? { questions: value } : value })).toEqual({ questions: [{ ok: true }] });
  });
  it('sends image input to the same configured high model without exposing it in errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] })));
    vi.stubGlobal('fetch', fetchMock);
    await new AIGateway(config).structured({ ...input, images: ['data:image/png;base64,test-fixture'] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe(config.generateModel);
    expect(body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,test-fixture' } });
  });
});

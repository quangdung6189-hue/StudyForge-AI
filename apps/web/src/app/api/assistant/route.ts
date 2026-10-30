import { createHash } from 'node:crypto';
import { db } from '@studyforge/db';
import { gatewayFromEnv, AIGatewayError } from '@studyforge/ai';
import { requireUser } from '@/server/auth';
import { AssistantInput, assistantContext } from '@/server/assistant';
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = AssistantInput.safeParse(await req.json());
    if (!input.success) return Response.json({ error: { code: 'INVALID_INPUT', message: 'Tin nhắn hoặc ảnh chưa hợp lệ. Tối đa 3 ảnh PNG/JPG/WebP đã tối ưu mỗi lượt; hãy chọn lại hoặc chia nhỏ câu hỏi.' } }, { status: 400 });
    const active = await db.attempt.findFirst({ where: { userId: user.id, status: 'started', submittedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
    if (active) return Response.json({ error: { code: 'ACTIVE_EXAM', message: 'Trợ lý tạm dừng khi bạn đang làm bài thi. Hãy nộp bài trước khi hỏi.' } }, { status: 403 });
    const window = Math.floor(Date.now() / 900000), id = createHash('sha256').update(`assistant:${user.id}:${window}`).digest('hex');
    const bucket = await db.rateLimitBucket.upsert({ where: { id }, create: { id, expiresAt: new Date((window + 1) * 900000) }, update: { count: { increment: 1 } } });
    if (bucket.count > 30) return Response.json({ error: { code: 'RATE_LIMITED', message: 'Bạn đã gửi nhiều tin nhắn liên tiếp. Hãy thử lại sau ít phút.' } }, { status: 429, headers: { 'Retry-After': String(Math.ceil(((window + 1) * 900000 - Date.now()) / 1000)) } });
    const gateway = gatewayFromEnv();
    const abort = new AbortController(), signal = AbortSignal.any([req.signal, abort.signal]), encoder = new TextEncoder();
    let open = true;
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (value: unknown) => { if (open) { try { controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)); } catch { open = false; abort.abort(); } } };
        try {
          emit({ event: 'status', message: input.data.lookup ? 'Đang tìm nguồn và kết nối AI…' : 'Đang kết nối AI…' });
          const context = await assistantContext(user.id, input.data, signal);
          emit({ event: 'sources', sources: context.sources, warnings: context.warnings });
          emit({ event: 'status', message: 'Đang trả lời…' });
          for await (const text of gateway.streamText({ system: context.system, messages: input.data.messages, signal })) emit({ event: 'delta', text });
          emit({ event: 'done' });
        } catch(error) { emit({ event: 'error', message: (error as { code?: string }).code === 'NOT_FOUND' ? 'Không tìm thấy tài liệu của bạn.' : error instanceof AIGatewayError ? error.message : 'Chưa hoàn tất câu trả lời. Hãy thử lại.' }); }
        finally { if (open) { open = false; controller.close(); } }
      }, cancel() { open = false; abort.abort(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
  } catch(error) {
    const unauthorized = (error as { code?: string }).code === 'UNAUTHORIZED';
    return Response.json({ error: { code: unauthorized ? 'UNAUTHORIZED' : 'ASSISTANT_UNAVAILABLE', message: unauthorized ? 'Bạn cần đăng nhập để dùng trợ lý.' : 'Trợ lý chưa sẵn sàng. Hãy thử lại sau.' } }, { status: unauthorized ? 401 : 503 });
  }
}

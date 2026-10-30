import { NextResponse } from 'next/server';
import { QuizGenerateSchema } from '@studyforge/contracts';
import { AIGatewayError } from '@studyforge/ai';
import { requireUser } from '@/server/auth';
import { getOwnedDocument } from '@/server/dal';
import { generateQuizQuestions } from '@/server/generator';

export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = QuizGenerateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Chọn dạng câu hỏi, số câu từ 1–100 và cấu hình hợp lệ.' } }, { status: 400 });
    const input = parsed.data;
    if (input.mode === 'ai_generate' && input.questionCount < input.types.length) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Số câu phải đủ cho mỗi dạng đã chọn ít nhất một câu.' } }, { status: 400 });
    const doc = await getOwnedDocument(user.id, input.documentId);
    if (doc.status !== 'ready') return NextResponse.json({ error: { code: 'DOCUMENT_NOT_READY', message: 'Tài liệu chưa đọc xong hoặc cần OCR. Hãy kiểm tra văn bản trước.' } }, { status: 409 });
    const params = { ...input, documentTitle: doc.title, rawText: doc.rawText, chunks: doc.chunks, cacheScope: `${user.id}:${doc.id}:${doc.revision}`, signal: req.signal };
    const result = (questions: Awaited<ReturnType<typeof generateQuizQuestions>>) => ({ documentTitle: doc.title, questions, warnings: questions.length < input.questionCount ? [`Tài liệu chỉ có ${questions.length} câu phù hợp; đã giữ nguyên số câu tìm thấy.`] : [] });
    if (new URL(req.url).searchParams.get('stream') === '1') {
      const abort = new AbortController(), encoder = new TextEncoder();
      let open = true;
      const stream = new ReadableStream({
        async start(controller) {
          const emit = (event: unknown) => { if (open) { try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); } catch { open = false; abort.abort(); } } };
          try {
            const questions = await generateQuizQuestions({ ...params, signal: AbortSignal.any([req.signal, abort.signal]), onProgress: progress => emit({ event: 'progress', ...progress }) });
            emit({ event: 'result', ...result(questions) });
          } catch (error) { emit({ event: 'error', error: generationFailure(error) }); }
          finally { if (open) { open = false; controller.close(); } }
        },
        cancel() { open = false; abort.abort(); },
      });
      return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
    }
    const questions = await generateQuizQuestions(params);
    return NextResponse.json(result(questions), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Dữ liệu gửi lên không hợp lệ.' } }, { status: 400 });
    if (error instanceof AIGatewayError) {
      const message = generationFailure(error).message;
      return NextResponse.json({ error: { code: error.code, message } }, { status: error.code === 'CONFIGURATION' ? 503 : error.code === 'TIMEOUT' ? 504 : 502 });
    }
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: { code: code === 'UNAUTHORIZED' || code === 'NOT_FOUND' ? code : 'GENERATE_ERROR', message: code === 'UNAUTHORIZED' ? 'Bạn cần đăng nhập.' : code === 'NOT_FOUND' ? 'Không tìm thấy tài liệu của bạn.' : 'Không thể tạo đề. Hãy thử lại.' } }, { status: code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 500 });
  }
}

function generationFailure(error: unknown) {
  if (error instanceof AIGatewayError) return { code: error.code, message: error.code === 'CONFIGURATION' ? 'Chưa cấu hình kết nối AI trên máy chủ.' : error.code === 'TIMEOUT' ? 'Một nhóm câu hỏi xử lý quá thời gian. Các nhóm đã xong được giữ lại; bấm Thử tạo lại để tiếp tục.' : error.code === 'UPSTREAM' ? 'Kết nối AI đang gián đoạn. Bấm thử lại để tiếp tục các nhóm còn thiếu.' : error.message };
  return { code: 'GENERATE_ERROR', message: 'Không thể hoàn tất nhóm câu hỏi. Hãy thử lại để tiếp tục.' };
}

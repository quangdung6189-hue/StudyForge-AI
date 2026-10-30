import { requireUser } from '@/server/auth';
import { getOwnedDocument } from '@/server/dal';
import { analyzeDocument } from '@/server/question-sections';
const cell = (value: unknown) => { let text = String(value ?? ''); if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), format = new URL(req.url).searchParams.get('format') ?? 'json';
    if (!['json', 'csv', 'md'].includes(format)) return Response.json({ error: { code: 'INVALID_INPUT', message: 'Chọn định dạng JSON, CSV hoặc Markdown.' } }, { status: 400 });
    const doc = await getOwnedDocument(user.id, (await context.params).id), analysis = analyzeDocument(doc.rawText ?? '');
    let output: string, mime: string;
    if (format === 'json') { output = JSON.stringify({ format: 'studyforge.document.v1', document: { id: doc.id, title: doc.title, revision: doc.revision }, ...analysis }, null, 2); mime = 'application/json'; }
    else if (format === 'md') { output = `# ${doc.title}\n\n${doc.rawText ?? ''}`; mime = 'text/markdown'; }
    else { output = '\uFEFF' + [['number','page','type','stem','options_json','original_answer','explanation','warnings'], ...analysis.questions.map(q => [q.number, q.pageNumber, q.type, q.stem, JSON.stringify(q.options), q.documentAnswer ? q.documentAnswer.acceptedAnswers.join(' / ') || q.documentAnswer.indices.map(i => q.options[i]).join(' / ') : '', q.sourceExplanation ?? '', (q.warnings ?? []).join(' | ')])].map(row => row.map(cell).join(',')).join('\r\n'); mime = 'text/csv'; }
    return new Response(output, { headers: { 'Content-Type': `${mime}; charset=utf-8`, 'Content-Disposition': `attachment; filename="studyforge-${doc.id}.${format}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch(error) { const code = (error as { code?: string }).code; return Response.json({ error: { code: code === 'UNAUTHORIZED' ? code : 'EXPORT_ERROR', message: code === 'UNAUTHORIZED' ? 'Bạn cần đăng nhập.' : 'Chưa xuất được tài liệu. Hãy thử lại.' } }, { status: code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 500 }); }
}

import { requireUser } from '@/server/auth';
import { apiError, invalid } from '@/server/http';
import { getOwnedQuiz } from '@/server/data-access';
import { buildExamDocx } from '@/server/exam-docx';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const versions = Number(url.searchParams.get('versions') ?? 1);
    if (!Number.isInteger(versions) || versions < 1 || versions > 8) return invalid('Số mã đề từ 1 đến 8.');
    const quiz = await getOwnedQuiz(user.id, (await context.params).id);
    const file = await buildExamDocx(quiz, versions, url.searchParams.get('key') !== '0');
    const name = encodeURIComponent(`${quiz.title.slice(0, 60)} - ${versions} ma de.docx`);
    return new Response(new Uint8Array(file), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename*=UTF-8''${name}`, 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

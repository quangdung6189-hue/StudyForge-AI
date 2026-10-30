import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getOwnedDocument } from '@/server/dal';
import { analyzeDocument } from '@/server/question-sections';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const doc = await getOwnedDocument(user.id, id);
    const { counts, total, sourceGroups, warnings, unsupported, pages } = analyzeDocument(doc.rawText ?? doc.chunks.map(c => c.content).join('\n'));
    return NextResponse.json({ counts, total, sourceGroups, warnings, unsupportedCount: unsupported.length, pages, status: doc.status }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: { code: code ?? 'ANALYSIS_ERROR', message: 'Không thể đọc cấu trúc tài liệu.' } }, { status: code === 'UNAUTHORIZED' ? 401 : code === 'NOT_FOUND' ? 404 : 500 });
  }
}

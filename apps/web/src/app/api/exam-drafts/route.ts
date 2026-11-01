import { requireUser } from '@/server/auth';
import { saveExamDraft, listExamDrafts } from '@/server/exam-drafts';
import { boundedBody } from '@/server/upload-errors';
import { examDraftError } from '@/server/exam-draft-errors';

export const runtime = 'nodejs';
export async function GET() {
  try { const user = await requireUser(); return Response.json(await listExamDrafts(user.id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return examDraftError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = JSON.parse((await boundedBody(req, 1500000)).toString('utf8'));
    return Response.json(await saveExamDraft(user.id, body), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return examDraftError(error); }
}
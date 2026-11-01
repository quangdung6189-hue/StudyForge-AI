import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { readExamDraft } from '@/server/exam-drafts';
import { examDraftError } from '@/server/exam-draft-errors';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(), { id } = await context.params; z.uuid().parse(id); return Response.json(await readExamDraft(user.id, id), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return examDraftError(error); }
}
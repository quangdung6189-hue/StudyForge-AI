import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { saveExamDraft, prepareExamQuestions } from '@/server/exam-drafts';
import { examDraftError } from '@/server/exam-draft-errors';
import { saveQuiz } from '@/server/quiz-save';
import { boundedBody } from '@/server/upload-errors';

export const runtime = 'nodejs';
/** Legacy callers use the same validated parser and save a draft, never bypass review/publication. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = z.object({ code: z.string().min(1).max(250000), title: z.string().trim().min(1).max(200), durationMinutes: z.number().int().min(1).max(1440).default(30) }).parse(JSON.parse((await boundedBody(req, 1500000)).toString('utf8')));
    const draft = await saveExamDraft(user.id, { id: crypto.randomUUID(), revision: 0, code: input.code, title: input.title, minutes: input.durationMinutes, sourceDocumentId: null });
    const { questions, documentId } = await prepareExamQuestions(user.id, draft.id, draft.revision);
    const result = await saveQuiz(user.id, { documentId, title: input.title, durationMinutes: input.durationMinutes, questions });
    return Response.json({ ...result, draftId: draft.id, requiresReview: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return examDraftError(error); }
}
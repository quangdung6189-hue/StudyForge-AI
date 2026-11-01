import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { prepareExamQuestions } from '@/server/exam-drafts';
import { boundedBody } from '@/server/upload-errors';
import { examDraftError } from '@/server/exam-draft-errors';

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), { id } = await context.params; z.uuid().parse(id);
    const { revision } = z.strictObject({ revision: z.number().int().positive() }).parse(JSON.parse((await boundedBody(req, 256)).toString('utf8')));
    return Response.json(await prepareExamQuestions(user.id, id, revision), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return examDraftError(error); }
}
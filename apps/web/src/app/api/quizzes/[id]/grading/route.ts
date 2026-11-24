import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { confirmGrade, gradingQueue, suggestGrade } from '@/server/learning';

export const maxDuration = 60;
const Schema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('suggest'), recordId: z.string().uuid(), questionId: z.string().uuid() }),
  z.strictObject({ action: z.literal('confirm'), recordId: z.string().uuid(), questionId: z.string().uuid(), points: z.number().min(0).max(100), feedback: z.string().max(600).default('') }),
]);
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return ok(await gradingQueue(user.id, (await context.params).id)); }
  catch (error) { return apiError(error); }
}
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    await context.params;
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid();
    const input = parsed.data;
    return ok(input.action === 'suggest' ? await suggestGrade(user.id, input.recordId, input.questionId) : await confirmGrade(user.id, input.recordId, input.questionId, input.points, input.feedback));
  } catch (error) { return apiError(error); }
}

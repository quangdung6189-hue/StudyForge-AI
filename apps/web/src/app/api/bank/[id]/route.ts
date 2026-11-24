import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { DifficultySchema } from '@studyforge/contracts';
import { updateQuestionMeta } from '@/server/learning';

const Schema = z.strictObject({ tags: z.array(z.string().max(40)).max(12).optional(), difficulty: DifficultySchema.optional(), topic: z.string().max(200).optional() });
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid();
    return ok(await updateQuestionMeta(user.id, (await context.params).id, parsed.data));
  } catch (error) { return apiError(error); }
}

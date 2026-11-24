import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { checkPracticeAnswer } from '@/server/learning';

const Schema = z.strictObject({ questionId: z.string().uuid(), values: z.array(z.string().max(4000)).min(1).max(20) });
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid('Hãy chọn hoặc nhập đáp án trước khi kiểm tra.');
    return ok(await checkPracticeAnswer(user.id, (await context.params).id, parsed.data.questionId, parsed.data.values));
  } catch (error) { return apiError(error); }
}

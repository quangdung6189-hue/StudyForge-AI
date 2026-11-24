import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { createQuizFromBank } from '@/server/learning';

const Schema = z.strictObject({ questionIds: z.array(z.string().uuid()).min(1).max(100), title: z.string().trim().min(1).max(200), durationMinutes: z.number().int().min(1).max(1440).default(30) });
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid('Chọn từ 1 đến 100 câu và đặt tên đề.');
    return ok(await createQuizFromBank(user.id, parsed.data), { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'INVALID_CITATION') return invalid('Trích dẫn của câu hỏi không còn khớp tài liệu nguồn.');
    return apiError(error);
  }
}

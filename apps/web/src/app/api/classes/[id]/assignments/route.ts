import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { assignQuiz, removeAssignment } from '@/server/learning';

const Schema = z.strictObject({ quizId: z.string().uuid(), dueAt: z.iso.datetime().nullable().optional(), note: z.string().max(500).optional() });
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid('Chọn đề đã xuất bản và hạn nộp hợp lệ.');
    return ok(await assignQuiz(user.id, (await context.params).id, parsed.data), { status: 201 });
  } catch (error) { return apiError(error); }
}
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const assignmentId = new URL(req.url).searchParams.get('assignmentId') ?? '';
    if (!z.string().uuid().safeParse(assignmentId).success) return invalid();
    return ok(await removeAssignment(user.id, (await context.params).id, assignmentId));
  } catch (error) { return apiError(error); }
}

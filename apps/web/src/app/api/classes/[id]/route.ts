import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { deleteClassroom, getClassroom } from '@/server/learning';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return ok(await getClassroom(user.id, (await context.params).id)); }
  catch (error) { return apiError(error); }
}
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return ok(await deleteClassroom(user.id, (await context.params).id)); }
  catch (error) { return apiError(error); }
}

import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { createClassroom, listClassrooms } from '@/server/learning';

const Schema = z.strictObject({ name: z.string().trim().min(1).max(120) });
export async function GET() {
  try { const user = await requireUser(); return ok(await listClassrooms(user.id)); }
  catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid('Hãy đặt tên lớp (tối đa 120 ký tự).');
    return ok(await createClassroom(user, parsed.data.name), { status: 201 });
  } catch (error) { return apiError(error); }
}

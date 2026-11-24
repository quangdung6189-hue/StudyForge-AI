import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { joinClassroom } from '@/server/learning';

const Schema = z.strictObject({ code: z.string().trim().min(4).max(12).regex(/^[A-Za-z0-9]+$/) });
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid('Mã lớp gồm 6 ký tự chữ và số.');
    return ok(await joinClassroom(user.id, parsed.data.code));
  } catch (error) { return apiError(error); }
}

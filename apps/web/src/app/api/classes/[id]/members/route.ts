import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, invalid, ok } from '@/server/http';
import { removeMember } from '@/server/learning';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const memberId = new URL(req.url).searchParams.get('userId') ?? user.id;
    if (!z.string().uuid().safeParse(memberId).success) return invalid();
    return ok(await removeMember(user.id, (await context.params).id, memberId));
  } catch (error) { return apiError(error); }
}

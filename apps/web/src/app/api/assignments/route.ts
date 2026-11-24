import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { myAssignments } from '@/server/learning';

export async function GET() {
  try { const user = await requireUser(); return ok({ items: await myAssignments(user.id) }); }
  catch (error) { return apiError(error); }
}

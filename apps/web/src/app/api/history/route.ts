import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { listAttemptHistory } from '@/server/learning';

export async function GET() {
  try { const user = await requireUser(); return ok(await listAttemptHistory(user.id)); }
  catch (error) { return apiError(error); }
}

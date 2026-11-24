import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { listBankQuestions } from '@/server/learning';

export async function GET() {
  try { const user = await requireUser(); return ok({ items: await listBankQuestions(user.id) }); }
  catch (error) { return apiError(error); }
}

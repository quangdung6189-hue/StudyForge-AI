import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { listStudyCards, studyStats } from '@/server/learning';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const deck = url.searchParams.get('deck')?.slice(0, 80) || undefined;
    const dueOnly = url.searchParams.get('due') === '1';
    const [stats, cards] = await Promise.all([studyStats(user.id), listStudyCards(user.id, { deck, dueOnly })]);
    return ok({ stats, cards });
  } catch (error) { return apiError(error); }
}

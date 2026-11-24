import { requireUser } from '@/server/auth';
import { apiError, ok } from '@/server/http';
import { quizAnalytics, quizAnalyticsCsv } from '@/server/learning';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    if (new URL(req.url).searchParams.get('format') === 'csv') {
      const csv = await quizAnalyticsCsv(user.id, id);
      return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ket-qua-${id.slice(0, 8)}.csv"`, 'Cache-Control': 'no-store' } });
    }
    return ok(await quizAnalytics(user.id, id));
  } catch (error) { return apiError(error); }
}

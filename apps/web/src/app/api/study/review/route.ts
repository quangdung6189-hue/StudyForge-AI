import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { ReviewRatingSchema } from '@studyforge/contracts';
import { reviewStudyCard } from '@/server/learning';

const Schema = z.strictObject({ cardId: z.string().uuid(), rating: ReviewRatingSchema });
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid();
    return ok(await reviewStudyCard(user.id, parsed.data.cardId, parsed.data.rating));
  } catch (error) { return apiError(error); }
}

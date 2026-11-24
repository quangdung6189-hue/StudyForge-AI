import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, body, invalid, ok } from '@/server/http';
import { cardsFromAttempt, cardsFromDocument } from '@/server/learning';

const Schema = z.discriminatedUnion('source', [
  z.strictObject({ source: z.literal('attempt'), attemptId: z.string().uuid() }),
  z.strictObject({ source: z.literal('document'), documentId: z.string().uuid() }),
]);
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Schema.safeParse(await body(req));
    if (!parsed.success) return invalid();
    return ok(parsed.data.source === 'attempt' ? await cardsFromAttempt(user.id, parsed.data.attemptId) : await cardsFromDocument(user.id, parsed.data.documentId));
  } catch (error) { return apiError(error); }
}

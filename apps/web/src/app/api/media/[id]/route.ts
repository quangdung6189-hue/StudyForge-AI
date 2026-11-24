import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { apiError, invalid } from '@/server/http';
import { readMediaAsset } from '@/server/learning';

/** Signed-in users only; ids are unguessable UUIDs referenced from published questions. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return invalid();
    const asset = await readMediaAsset(id);
    return new Response(new Uint8Array(asset.content), { headers: { 'Content-Type': asset.mimeType, 'Content-Length': String(asset.size), 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'none' } });
  } catch (error) { return apiError(error); }
}

import { requireUser } from '@/server/auth';
import { apiError, invalid, ok } from '@/server/http';
import { AUDIO_TYPES, MAX_AUDIO_BYTES, createMediaAsset } from '@/server/learning';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!AUDIO_TYPES.includes(type)) return invalid('Chỉ hỗ trợ tệp âm thanh MP3, M4A, WAV, OGG hoặc WEBM.');
    if (Number(req.headers.get('content-length') ?? 0) > MAX_AUDIO_BYTES) return invalid('Tệp âm thanh tối đa 8 MB.');
    const bytes = new Uint8Array(await req.arrayBuffer());
    return ok(await createMediaAsset(user.id, type, bytes), { status: 201 });
  } catch (error) { return apiError(error); }
}

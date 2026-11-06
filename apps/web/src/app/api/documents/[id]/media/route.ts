import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { db, readWithRetry } from '@studyforge/db';
import { extractDocxMediaAndMath } from '@/server/document-media';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const document = await db.document.findFirst({
      where: { id, ownerId: user.id },
      select: { id: true, fileType: true },
    });
    if (!document) {
      return NextResponse.json({ error: { message: 'Không tìm thấy tài liệu.' } }, { status: 404 });
    }

    const fileRecord = await readWithRetry(() => db.documentFile.findUnique({
      where: { documentId: id },
      select: { content: true, metadata: true },
    }));

    if (!fileRecord) {
      return NextResponse.json({ mediaMap: {} });
    }

    const metadata = (fileRecord.metadata as Record<string, any>) || {};
    if (metadata.mediaMap && Object.keys(metadata.mediaMap).length > 0) {
      return NextResponse.json({ mediaMap: metadata.mediaMap });
    }

    // On-demand extraction from original DOCX content if not already stored in metadata
    if (document.fileType.includes('wordprocessingml') || document.fileType.includes('docx')) {
      const buffer = Buffer.from(fileRecord.content);
      const mediaResult = await extractDocxMediaAndMath(buffer);
      const mediaMap = mediaResult.mediaMap;

      const updatedMetadata = { ...metadata, mediaMap };
      await db.documentFile.update({
        where: { documentId: id },
        data: { metadata: updatedMetadata },
      }).catch(() => {});

      return NextResponse.json({ mediaMap });
    }

    return NextResponse.json({ mediaMap: {} });
  } catch (error) {
    return NextResponse.json({ error: { message: 'Lỗi tải ảnh tài liệu.' } }, { status: 500 });
  }
}

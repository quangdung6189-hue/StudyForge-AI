import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { LocalPrivateStorage } from '@studyforge/storage';
import { requireUser } from '@/server/auth';
import { extractDocumentContent } from '@/server/extractor';

const storage = new LocalPrivateStorage('./.data/storage', async (principal, key) => {
  const doc = await db.document.findFirst({ where: { storageKey: key, ownerId: principal.id } });
  return Boolean(doc);
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Vui lòng chọn ít nhất một file tài liệu' } }, { status: 400 });
    }

    const uploadedDocuments = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = await storage.put({ id: user.id }, new Uint8Array(buffer));

      // Extract text & chunks
      const { rawText, chunks } = await extractDocumentContent(buffer, file.type, file.name);

      const doc = await db.document.create({
        data: {
          ownerId: user.id,
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileType: file.type || 'application/octet-stream',
          size: file.size,
          storageKey,
          status: 'ready',
          rawText,
          chunks: {
            create: chunks.map(c => ({
              chunkIndex: c.chunkIndex,
              content: c.content,
              pageNumber: c.pageNumber,
            })),
          },
        },
      });

      uploadedDocuments.push({
        id: doc.id,
        title: doc.title,
        fileType: doc.fileType,
        size: doc.size,
        status: doc.status,
        chunkCount: chunks.length,
      });
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
    });
  } catch (err: any) {
    const status = err.code === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: { code: err.code || 'UPLOAD_ERROR', message: err.message } }, { status });
  }
}

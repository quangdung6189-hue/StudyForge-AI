import { NextResponse } from 'next/server';
import { db } from '@studyforge/db';
import { LocalPrivateStorage } from '@studyforge/storage';
import { requireUser } from '@/server/auth';
import { extractDocumentContent } from '@/server/extractor';

const storageDir = process.env.PRIVATE_STORAGE_DIR || './.data/storage';
const storage = new LocalPrivateStorage(storageDir, async (principal, key) => {
  const doc = await db.document.findFirst({ where: { storageKey: key, ownerId: principal.id } });
  return Boolean(doc);
});

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: 'Vui lòng chọn ít nhất một file tài liệu' } }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: { code: 'INVALID_INPUT', message: `Tối đa ${MAX_FILES} file mỗi lần tải lên` } }, { status: 400 });
    }

    const uploadedDocuments = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: { code: 'FILE_TOO_LARGE', message: `File ${file.name} vượt quá dung lượng tối đa 25MB` } }, { status: 400 });
      }

      const lowerName = file.name.toLowerCase();
      const hasAllowedExt = ALLOWED_EXTS.some(ext => lowerName.endsWith(ext));
      if (!hasAllowedExt) {
        return NextResponse.json({ error: { code: 'INVALID_FILE_TYPE', message: `Định dạng file ${file.name} không được hỗ trợ (chỉ nhận PDF, DOCX, TXT, PNG, JPG)` } }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = await storage.put({ id: user.id }, new Uint8Array(buffer));

      try {
        // Extract text & chunks
        const { rawText, chunks } = await extractDocumentContent(buffer, file.type, file.name);

        const isImage = file.type.startsWith('image/') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
        const docStatus = isImage ? 'needs_ocr' : 'ready';

        const doc = await db.document.create({
          data: {
            ownerId: user.id,
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileType: file.type || 'application/octet-stream',
            size: file.size,
            storageKey,
            status: docStatus,
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
      } catch (extractErr) {
        // Clean up storage if extraction or DB fails
        await storage.remove({ id: user.id }, storageKey).catch(() => {});
        throw extractErr;
      }
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

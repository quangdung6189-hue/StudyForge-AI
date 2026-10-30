import { NextResponse } from 'next/server';
import { db, isTransientDatabaseError } from '@studyforge/db';
import { requireUser } from '@/server/auth';
import { extractDocumentContent, ExtractorError } from '@/server/extractor';
import { documentStorage, saveExtractionMetadata } from '@/server/document-files';
import { analyzeDocument } from '@/server/question-sections';

export const maxDuration = 300;

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTS = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const storage = documentStorage();
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
        const canonicalType = lowerName.endsWith('.pdf') ? 'application/pdf' : lowerName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : lowerName.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(lowerName) ? 'image/jpeg' : 'text/plain';
        const extraction = await extractDocumentContent(buffer, canonicalType, file.name, { ocr: true, signal: req.signal });
        const { rawText, chunks } = extraction;

        const docStatus = extraction.needsOcr || !rawText.trim() ? 'needs_ocr' : 'ready';

        const doc = await db.document.create({
          data: {
            ownerId: user.id,
            title: file.name.replace(/\.[^/.]+$/, ''),
            fileType: canonicalType,
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
        await saveExtractionMetadata(doc.id, doc.revision, extraction).catch(() => {});

        uploadedDocuments.push({
          id: doc.id,
          title: doc.title,
          fileType: doc.fileType,
          size: doc.size,
          status: doc.status,
          chunkCount: chunks.length,
          warnings: extraction.warnings,
          counts: analyzeDocument(rawText).counts,
        });
      } catch (extractErr) {
        // Clean up storage if extraction or DB fails
        await storage.discardUpload({ id: user.id }, storageKey).catch(() => {});
        throw extractErr;
      }
    }

    return NextResponse.json({
      success: true,
      documents: uploadedDocuments,
    });
  } catch (error) {
    const unauthorized = (error as { code?: string }).code === 'UNAUTHORIZED', transient = isTransientDatabaseError(error);
    const status = unauthorized ? 401 : transient ? 503 : error instanceof ExtractorError ? 422 : 500;
    return NextResponse.json({ error: { code: unauthorized ? 'UNAUTHORIZED' : transient ? 'DATABASE_UNAVAILABLE' : 'UPLOAD_ERROR', message: unauthorized ? 'Bạn cần đăng nhập để tải tài liệu.' : transient ? 'Kết nối dữ liệu đang gián đoạn. Hãy thử tải lại sau vài giây.' : error instanceof ExtractorError ? error.message : 'Chưa lưu được tài liệu. Hãy thử tải lại.' } }, { status, headers: { 'Cache-Control': 'no-store', ...(transient ? { 'Retry-After': '2' } : {}) } });
  }
}

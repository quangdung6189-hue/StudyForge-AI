import { describe, expect, it } from 'vitest';
import { db } from '../packages/db/src';
import { extractDocumentContent } from '../apps/web/src/server/extractor';

const documentId = 'd07b57a5-1a0b-4326-8b4e-c87d0c7015ae';

describe('MathType OLE MTEF decoding through real extractor', () => {
  it('extracts complete exam with equations and no fake fallback images', async () => {
    const docFile = await db.documentFile.findUnique({ where: { documentId } });
    expect(docFile).toBeTruthy();
    const result = await extractDocumentContent(
      Buffer.from(docFile!.content),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Ma_de_0213.docx'
    );
    const text = result.rawText;
    const c9 = text.slice(text.indexOf('Câu 9:'), text.indexOf('Câu 10:'));
    const c16 = text.slice(text.indexOf('Câu 16:'), text.indexOf('Câu 16:') + 350);

    expect(c9).toContain('{}^{235}_{92}U');
    expect(c9).not.toContain('[Hình 6]');
    expect(c16).toContain('l = 10m');
    expect(c16).not.toContain('[Hình 17]');
  });
});


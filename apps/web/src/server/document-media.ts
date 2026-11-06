import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { ommlToLatex } from '@/lib/omml-to-latex';

export type ExtractedMedia = {
  index: number;
  filename: string;
  mimeType: string;
  dataUrl: string;
  rId?: string;
};

export type DocxMediaResult = {
  images: ExtractedMedia[];
  mediaMap: Record<number, string>;
  ommlLatexCount: number;
};

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  wmf: 'image/x-wmf',
  emf: 'image/x-emf',
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

function isEquationFallback(element: Element): boolean {
  let curr: Node | null = element;
  while (curr) {
    if (curr.nodeType === 1) {
      const tag = ((curr as Element).tagName || '').toLowerCase();
      if (tag.endsWith('object') || tag.endsWith('fallback')) return true;
    }
    curr = curr.parentNode;
  }
  return false;
}

/**
 * Extract images and math formulas directly from a DOCX buffer.
 */
export async function extractDocxMediaAndMath(buffer: Buffer): Promise<DocxMediaResult> {
  const zip = await JSZip.loadAsync(buffer);
  const images: ExtractedMedia[] = [];
  const mediaMap: Record<number, string> = {};

  // 1. Read relationships to map rId -> target media path
  const relsEntry = zip.file('word/_rels/document.xml.rels');
  const relsMap = new Map<string, string>(); // rId -> media filename
  if (relsEntry) {
    const relsXml = await relsEntry.async('string');
    const parser = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } });
    const relsDoc = parser.parseFromString(relsXml, 'application/xml');
    const relNodes = Array.from(relsDoc.getElementsByTagName('Relationship'));
    for (const rel of relNodes) {
      const id = rel.getAttribute('Id') || '';
      const target = rel.getAttribute('Target') || '';
      const type = rel.getAttribute('Type') || '';
      if (type.includes('/image') || target.includes('media/')) {
        const cleanTarget = target.replace(/^word\//, '').replace(/^\.\.\//, '');
        relsMap.set(id, cleanTarget);
      }
    }
  }

  // 2. Scan word/document.xml to preserve the exact sequence of REAL images in document flow
  const docEntry = zip.file('word/document.xml');
  let imageCounter = 0;
  let ommlLatexCount = 0;

  if (docEntry) {
    const docXml = await docEntry.async('string');
    const parser = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } });
    const doc = parser.parseFromString(docXml, 'application/xml');

    // Count OMML math
    const mathNodes = Array.from(doc.getElementsByTagName('m:oMath'));
    ommlLatexCount = mathNodes.length;

    // Track image occurrences in document order
    const drawings = Array.from(doc.getElementsByTagName('w:drawing'));
    const picts = Array.from(doc.getElementsByTagName('w:pict'));
    const allImageContainers = [...drawings, ...picts];

    for (const container of allImageContainers) {
      // Skip images that are equation fallbacks (MathType OLE or mc:Fallback for OMML)
      if (isEquationFallback(container)) {
        continue;
      }

      // Find blip r:embed or imagedata r:id
      let rId = '';
      const blips = Array.from(container.getElementsByTagName('a:blip'));
      for (const blip of blips) {
        rId = blip.getAttribute('r:embed') || blip.getAttribute('r:link') || '';
        if (rId) break;
      }
      if (!rId) {
        const imagedatas = Array.from(container.getElementsByTagName('v:imagedata'));
        for (const img of imagedatas) {
          rId = img.getAttribute('r:id') || img.getAttribute('id') || '';
          if (rId) break;
        }
      }

      if (rId && relsMap.has(rId)) {
        const targetPath = relsMap.get(rId)!;
        const mime = getMimeType(targetPath);
        // Browsers cannot render WMF / EMF vector metafiles (usually equation previews); ignore them
        if (mime === 'image/x-wmf' || mime === 'image/x-emf') {
          continue;
        }

        imageCounter++;
        const normalizedPath = targetPath.startsWith('media/') ? `word/${targetPath}` : targetPath.startsWith('word/') ? targetPath : `word/media/${targetPath.split('/').pop()}`;
        const file = zip.file(normalizedPath) || zip.file(`word/${targetPath}`) || zip.file(targetPath);
        if (file) {
          const bytes = await file.async('uint8array');
          const base64 = Buffer.from(bytes).toString('base64');
          const dataUrl = `data:${mime};base64,${base64}`;
          const extracted: ExtractedMedia = {
            index: imageCounter,
            filename: targetPath,
            mimeType: mime,
            dataUrl,
            rId,
          };
          images.push(extracted);
          mediaMap[imageCounter] = dataUrl;
        }
      }
    }
  }

  return { images, mediaMap, ommlLatexCount };
}

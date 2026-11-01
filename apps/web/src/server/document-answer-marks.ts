import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

export type AnswerMarkEvidence = { text: string; mark: 'underline' | 'color' | 'highlight'; value: string; paragraph: number; confidence: 'clear' | 'verify' };
const elements = (node: Document | Element, tag: string): Element[] => Array.from(node.getElementsByTagName(tag));
const val = (node: Element | undefined, tag: string) => node ? elements(node, tag)[0]?.getAttribute('w:val') ?? '' : '';
const compact = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Validate ZIP expansion before Mammoth allocates any XML, media or embedded payloads. */
export async function validateDocxArchive(buffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > 10000) throw new Error('Too many DOCX ZIP entries');
  let total = 0;
  for (const entry of entries) {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid DOCX ZIP entry size');
    total += size;
    if (total > 64000000 || /\.(?:xml|rels)$/i.test(entry.name) && size > 8000000) throw new Error('DOCX expansion exceeds safe limit');
    if (/\.(?:xml|rels)$/i.test(entry.name)) {
      const xml = await entry.async('string');
      if (xml.length > 8000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported DOCX XML');
    }
  }
}

/** Read only bounded OOXML entries. No external resources, macros or uploaded HTML execution. */
export async function readDocxAnswerMarks(buffer: Buffer, rawText: string): Promise<{ rawText: string; evidence: AnswerMarkEvidence[]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = async (name: string) => {
    const entry = zip.file(name); if (!entry) return null;
    // JSZip records uncompressed size; check before allocating the XML string as well.
    const length = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (length && length > 8000000) throw new Error('DOCX XML exceeds safe limit');
    const text = await entry.async('string'); if (text.length > 8000000 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Unsupported DOCX XML');
    return new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() { throw new Error('Invalid DOCX XML'); } } }).parseFromString(text, 'application/xml');
  };
  const document = await xml('word/document.xml'); if (!document) return { rawText, evidence: [], warnings: [] };
  const styles = await xml('word/styles.xml');
  const styleMap = new Map(styles ? elements(styles, 'w:style').map(style => [style.getAttribute('w:styleId') ?? '', style]) : []);
  const inherited = (id: string, tag: string, seen = new Set<string>()): string => {
    if (!id || seen.has(id)) return ''; seen.add(id); const style = styleMap.get(id); if (!style) return '';
    return val(style, tag) || inherited(val(style, 'w:basedOn'), tag, seen);
  };
  const colors = new Map<string, number>();
  const paragraphs = elements(document, 'w:p').map((paragraph, index) => {
    const paragraphStyle = val(paragraph, 'w:pStyle');
    const runs = elements(paragraph, 'w:r').map(run => {
      const text = elements(run, 'w:t').map(node => node.textContent ?? '').join('');
      const style = val(run, 'w:rStyle');
      const runProperties = elements(run, 'w:rPr')[0];
      const property = (tag: string) => val(runProperties, tag) || inherited(style, tag) || inherited(paragraphStyle, tag);
      const colorNode = runProperties ? elements(runProperties, 'w:color')[0] : undefined;
      const color = (colorNode?.getAttribute('w:themeColor') ? `THEME:${colorNode.getAttribute('w:themeColor')}` : property('w:color')).toUpperCase();
      if (text.trim()) colors.set(color || 'AUTO', (colors.get(color || 'AUTO') ?? 0) + text.length);
      return { text, color, underline: property('w:u'), highlight: property('w:highlight') };
    });
    return { index, text: compact(runs.map(run => run.text).join('')), runs };
  });
  const primary = [...colors].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'AUTO';
  const backgroundColors = new Set(paragraphs.filter(paragraph => !/^\*?[A-Ha-h][.)]\s+/u.test(paragraph.text) && !/^\*?(?:phần|nhóm|mục|chương|[ivx]+[.)])/iu.test(paragraph.text)).flatMap(paragraph => paragraph.runs.filter(run => run.text.trim()).map(run => run.color || 'AUTO')));
  const hasReliableBaseline = backgroundColors.size === 1;
  const evidence: AnswerMarkEvidence[] = [];
  for (const paragraph of paragraphs) {
    // Only an option paragraph may supply an answer mark, never a colored heading.
    const option = paragraph.text.match(/^\*?([A-Ha-h])[.)]\s+(.+)$/u); if (!option) continue;
    const inlineOptions = [...paragraph.text.matchAll(/(?:^|\s+)\*?[A-Ha-h][.)]\s+/gu)].length > 1;
    const nonempty = paragraph.runs.filter(run => run.text.trim());
    const labelRuns: typeof nonempty = []; let labelText = '';
    for (const run of nonempty) { if (labelText.length >= 2) break; labelRuns.push(run); labelText += run.text.trim(); }
    const underlinedLabel = /^[A-Ha-h][.)]$/.test(labelText) && labelRuns.every(run => !['', 'none', '0', 'false'].includes(run.underline));
    const markedRuns = nonempty.filter(run => run.color && run.color !== 'AUTO' && run.color !== primary && !['000000', 'FFFFFF'].includes(run.color));
    const highlighted = nonempty.filter(run => run.highlight && !['none', 'white'].includes(run.highlight));
    const competing = (underlinedLabel && (markedRuns.length > 0 || highlighted.length > 0)) || (markedRuns.length > 0 && highlighted.length > 0);
    const covered = markedRuns.reduce((sum, run) => sum + run.text.replace(/\s/g, '').length, 0) / Math.max(1, paragraph.text.replace(/\s/g, '').length);
    if (inlineOptions && (underlinedLabel || markedRuns.length || highlighted.length || nonempty.some(run => run.underline && !['none', '0', 'false'].includes(run.underline)))) evidence.push({ text: paragraph.text, mark: 'underline', value: 'inline-option-spans-unresolved', paragraph: paragraph.index, confidence: 'verify' });
    else if (competing) evidence.push({ text: paragraph.text, mark: 'highlight', value: 'mixed-marks', paragraph: paragraph.index, confidence: 'verify' });
    else if (underlinedLabel) evidence.push({ text: paragraph.text, mark: 'underline', value: 'option-label', paragraph: paragraph.index, confidence: 'clear' });
    else if (hasReliableBaseline && covered > 0.8 && markedRuns.every(run => /^[\dA-F]{6}$/.test(run.color)) && new Set(markedRuns.map(run => run.color)).size === 1) evidence.push({ text: paragraph.text, mark: 'color', value: markedRuns[0].color, paragraph: paragraph.index, confidence: 'clear' });
    else if (markedRuns.length || highlighted.length || nonempty.some(run => run.underline && !['none', '0', 'false'].includes(run.underline))) evidence.push({ text: paragraph.text, mark: highlighted.length ? 'highlight' : markedRuns.length ? 'color' : 'underline', value: highlighted[0]?.highlight || markedRuns[0]?.color || 'partial', paragraph: paragraph.index, confidence: 'verify' });
  }
  const lines = rawText.split('\n'); const warnings: string[] = [];
  // A single consistent alternative ink can be a key; multiple colors need review.
  const distinct = new Set(evidence.filter(mark => mark.mark === 'color' && mark.confidence === 'clear').map(mark => mark.value));
  if (distinct.size > 1) evidence.forEach(mark => { if (mark.mark === 'color') mark.confidence = 'verify'; });
  let clear = 0, unsure = 0;
  for (const mark of evidence) {
    const matches = lines.flatMap((line, index) => compact(line) === mark.text ? [index] : []);
    if (matches.length !== 1) {
      mark.confidence = 'verify';
      for (const index of matches) if (!lines[index].includes('[Cần xác minh]')) lines[index] += ' [Cần xác minh]';
      continue;
    }
    const index = matches[0];
    if (mark.confidence === 'clear') { if (!/\[Đáp án\]/u.test(lines[index])) lines[index] += ' [Đáp án]'; clear++; }
    else { lines[index] += ' [Cần xác minh]'; unsure++; }
  }
  if (clear) warnings.push(`Nhận diện ${clear} dấu đáp án từ màu chữ/gạch chân trong DOCX; vẫn cần giáo viên duyệt.`);
  if (unsure || evidence.some(mark => mark.confidence === 'verify')) warnings.push('Có màu, tô nền hoặc gạch chân chưa rõ quy ước; các câu liên quan cần xác minh, không tự đoán đáp án.');
  return { rawText: lines.join('\n'), evidence, warnings };
}
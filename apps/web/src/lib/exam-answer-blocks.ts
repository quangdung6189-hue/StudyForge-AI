/** Shared, deterministic answer boundaries. Source strings remain intact for citations. */
const answerName = '(?:Đáp án(?: đúng| gợi ý)?|Dap an|Đáp số|Dap so|Trả lời(?: ngắn)?|Tra loi|Answer|Lời đáp|Key|Đ/A|DA)';
const solutionName = '(?:Lời giải(?: chi tiết)?|Bài giải|Hướng dẫn(?: giải| chi tiết)?|Giải thích(?: chi tiết| ngắn)?|Gợi ý(?: trả lời| đáp án)?|Loi giai|Giai thich)';
const prefix = '(?:[-–•]\\s*)?(?:\\*\\*|__)?';
const suffix = '(?:\\*\\*|__)?';
const separator = '(?:[:：=]|[-–—](?=\\s|$))';
const marker = new RegExp(`^\\s*${prefix}(${answerName}|${solutionName})${suffix}\\s*(?:${separator}\\s*${suffix}\\s*(.*)|$)`, 'iu');
const answerKind = new RegExp(`^${answerName}$`, 'iu');
const inline = new RegExp(`(^|[\\s?!.;])(${prefix}(?:${answerName}|${solutionName})${suffix}\\s*${separator}\\s*${suffix})`, 'giu');

export type AnswerMarker = { kind: 'answer' | 'explanation'; value: string };
export function readAnswerMarker(line: string): AnswerMarker | null {
  const match = line.match(marker);
  return match ? { kind: answerKind.test(match[1]) ? 'answer' : 'explanation', value: match[2] ?? '' } : null;
}

/** Bare local Trả lời/Lời giải are not global key sections. */
export function isGlobalAnswerHeading(line: string, nextNonempty = ''): boolean {
  const text = line.replace(/^\s*#{1,6}\s+/, '').replace(/[*_]/g, '').trim();
  if (/^(?:HẾT|BẢNG ĐÁP ÁN|ĐÁP ÁN NHANH|HƯỚNG DẪN CHẤM|ĐÁP ÁN\s+(?:VÀ|PHẦN|TỰ LUẬN|TRẢ LỜI NGẮN)|LỜI GIẢI\s+(?:CHI TIẾT TOÀN ĐỀ|CUỐI ĐỀ))(?=\s|[.:：\-]|$)/iu.test(text)) return true;
  return /^(?:ĐÁP ÁN|DAP AN|LỜI GIẢI|HƯỚNG DẪN GIẢI)\s*[:：]?\s*$/iu.test(text) && /^(?:Câu\s+(?:\d+\s*)+$|\d+[.)]\s*[A-H](?:\s|$)|(?:Câu hỏi|Câu|Cau|Question|Bài|Bai)\s*\d+[.:)]|(?:PHẦN|PHAN|PART|SECTION|MỤC)\s+(?:[IVX]+|\d+)|[IVX]+[.)])/iu.test(nextNonempty.replace(/^\s*#{1,6}\s+/, '').replace(/[*_]/g, '').trim());
}

/** Local answer tables can precede more exam sections; only final written keys stay active. */
export function isWrittenAnswerHeading(line: string, nextNonempty = ''): boolean {
  const text = line.replace(/^\s*#{1,6}\s+/, '').replace(/[*_]/g, '').trim();
  return /^(?:HƯỚNG DẪN CHẤM|ĐÁP ÁN\s+(?:VÀ|PHẦN|TỰ LUẬN|TRẢ LỜI NGẮN)|LỜI GIẢI\s+(?:CHI TIẾT TOÀN ĐỀ|CUỐI ĐỀ))(?=\s|[.:：\-]|$)/iu.test(text)
    || /^(?:ĐÁP ÁN|DAP AN|LỜI GIẢI|HƯỚNG DẪN GIẢI)\s*[:：]?\s*$/iu.test(text) && isGlobalAnswerHeading(line, nextNonempty)
    || /^(?:BẢNG ĐÁP ÁN|ĐÁP ÁN NHANH)/iu.test(text) && question.test(nextNonempty.trim());
}

export type QuestionContent = {
  body: string[];
  answers: { text: string; quote: string }[];
  explanation: string;
  answerTail: string[];
  region?: 'body' | 'answer' | 'explanation';
};

export function nextNonemptyLines(lines: string[]): string[] {
  const next = new Array<string>(lines.length); let value = '';
  for (let index = lines.length - 1; index >= 0; index--) { next[index] = value; if (lines[index].trim()) value = lines[index]; }
  return next;
}

/** Explicit separators mark boundaries; bare labels are accepted only as an entire line. */
export function splitQuestionContent(lines: string[]): QuestionContent {
  const body: string[] = [], answers: { text: string; quote: string }[] = [], explanations: string[] = [], answerTail: string[] = [];
  let region: 'body' | 'answer' | 'explanation' = 'body';
  for (const original of lines) {
    const boundaries = [...original.matchAll(inline)].map(match => match.index! + match[1].length);
    const offsets = [...new Set([0, ...boundaries, original.length])].sort((a, b) => a - b);
    const fragments = offsets.length === 1 ? [''] : offsets.slice(0, -1).map((offset, index) => original.slice(offset, offsets[index + 1]));
    for (const fragment of fragments) {
      const found = readAnswerMarker(fragment);
      if (found) {
        answerTail.push(fragment.trim());
        region = found.kind === 'answer' ? 'answer' : 'explanation';
        if (region === 'answer') answers.push({ text: found.value.trim(), quote: fragment.trim() });
        else if (found.value.trim()) explanations.push(found.value.trim());
      } else if (region === 'answer') {
        const value = fragment.trim();
        const item = answers[answers.length - 1];
        item.quote += '\n' + fragment;
        if (value) { item.text += (item.text ? '\n' : '') + value; answerTail.push(fragment); }
      } else if (region === 'explanation') { explanations.push(fragment); answerTail.push(fragment); }
      else body.push(fragment.replace(/^ +| +$/g, ''));
    }
  }
  return { body: body.filter(line => line.trim()), answers, explanation: explanations.join('\n').trim(), answerTail, region };
}

/** Wrapping does not prove reasoning: preserve every answer line until an explicit label. */
export function textAnswerParts(content: QuestionContent) {
  return { answers: content.answers, explanation: content.explanation };
}

export function writtenAnswerValues(text: string, essay = false): string[] {
  return essay ? (text.trim() ? [text.trim()] : []) : [...new Set(text.split('|').map(value => value.trim()).filter(Boolean))];
}

/** Alternative order is irrelevant, but source characters/numbers are never rewritten. */
export function sameWrittenAnswers(left: string[], right: string[]): boolean {
  return JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());
}

export function conflictingWrittenAnswers(answers: { text: string }[], essay = false): boolean {
  const keys = answers.map(item => writtenAnswerValues(item.text, essay)).filter(values => values.length);
  return keys.some(values => !sameWrittenAnswers(values, keys[0]));
}

export type WrittenAnswer = { number: string; section: string; text: string; quote: string; explanation: string };
const question = /^(?:Câu hỏi|Câu|Cau|Question|Bài|Bai)\s*(\d+)\s*[.:)]\s*(.*)$/iu;
const sectionKey = (text: string) => text.match(/(?:PHẦN|PHAN|PART|SECTION)\s+([IVX]+|\d+)(?=\W|$)/iu)?.[1].toUpperCase() ?? text.match(/^([IVX]+)[.)]/iu)?.[1].toUpperCase() ?? '';
export function writtenAnswerSections(lines: string[]): WrittenAnswer[] {
  const output: WrittenAnswer[] = []; let active = false, section = '', current: { number: string; section: string; lines: string[]; quote: string[] } | undefined;
  const nextLines = nextNonemptyLines(lines);
  const flush = () => {
    if (!current) return;
    const parsed = splitQuestionContent(current.lines);
    const texts = parsed.answers.length ? parsed.answers.map(item => item.text) : [parsed.body.join('\n').trim()];
    for (const text of texts) if (text || parsed.explanation) output.push({ number: current.number, section: current.section, text, quote: current.quote.join('\n'), explanation: parsed.explanation });
    current = undefined;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim(), next = nextLines[index];
    if (isGlobalAnswerHeading(line, next)) { flush(); active = isWrittenAnswerHeading(line, next); section = sectionKey(line) || section; continue; }
    if (!active) continue;
    if (/^(?:PHẦN|PHAN|PART|SECTION)\s+(?:[IVX]+|\d+)|^[IVX]+[.)]/iu.test(line)) { flush(); section = sectionKey(line); continue; }
    const match = line.match(question);
    if (match) { flush(); current = { number: match[1], section, lines: [match[2]], quote: [lines[index]] }; }
    else if (current) { current.lines.push(lines[index]); current.quote.push(lines[index]); }
  }
  flush(); return output;
}

export function matchingWrittenAnswers(entries: WrittenAnswer[], number: number | string, section: string, uniqueNumber: boolean): WrittenAnswer[] {
  const key = sectionKey(section);
  const candidates = entries.filter(entry => Number(entry.number) === Number(number));
  const exact = candidates.filter(entry => !!key && entry.section === key);
  return exact.length ? exact : uniqueNumber ? candidates.filter(entry => !entry.section) : [];
}
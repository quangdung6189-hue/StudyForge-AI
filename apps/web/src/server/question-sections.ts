import type { QuestionType } from '@studyforge/contracts';
import { bottomUpLayout, unglueExamText } from '@/lib/exam-layout';
import { conflictingWrittenAnswers, isGlobalAnswerHeading, isWrittenAnswerHeading, matchingWrittenAnswers, nextNonemptyLines, readAnswerMarker, sameWrittenAnswers, splitQuestionContent, textAnswerParts, writtenAnswerSections, writtenAnswerValues } from '@/lib/exam-answer-blocks';

export type SourceQuestion = {
  key: string; type: QuestionType; stem: string; options: string[]; sourceText: string;
  number?: string; group?: string; section?: string; pageNumber?: number;
  warnings?: string[]; sourceExplanation?: string;
  documentAnswer?: { indices: number[]; acceptedAnswers: string[]; quote: string };
};
export type UnclassifiedQuestion = { key: string; type: 'unsupported'; stem: string; reason: string; pageNumber: number; number?: string; section?: string; documentAnswer?: SourceQuestion['documentAnswer']; sourceExplanation?: string; warnings?: string[] };
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');
const compact = (text: string) => text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const compactLayout = (text: string) => text.split('\n').map(line => line.includes('\t') ? line.replace(/^ +| +$/g, '') : line.replace(/ +/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^[ \n]+|[ \n]+$/g, '');
const emptyCounts = () => ({ single: 0, multiple: 0, boolean: 0, short: 0, fill: 0 });

export function analyzeDocument(text: string) {
  const pages = unglueExamText(text).text.split('\f').map(page => page.replace(/(^|\n)(Câu[ \t]+\d+(?:[ \t]+\d+)*[ \t]*)(\n(?:[ \t]*\n)*)(?=Đáp án[ \t]+[A-F*])/giu, '$1BẢNG ĐÁP ÁN\n$2$3'));
  const written = writtenAnswerSections(pages.join('\f').split(/\n|\f/));
  const repeated = new Map<string, number>();
  for (const page of pages) for (const line of new Set(page.split('\n').map(line => line.trim()).filter(Boolean))) repeated.set(line, (repeated.get(line) ?? 0) + 1);
  type Block = { number: string; lines: string[]; type?: QuestionType | 'unsupported'; section: string; pageNumber: number; plain: boolean; region: 'body' | 'answer' | 'explanation' };
  const blocks: Block[] = [];
  const warnings: string[] = [];
  let current: Block | undefined, section: QuestionType | 'unsupported' | undefined, sectionName = '', inAnswers = false, inWrittenAnswers = false;
  const answerTables = new Map<string, Map<string, { answer: string; quote: string }>>();
  let answerNumbers: string[] = [], answerHeader = '';
  const finish = () => { if (current) blocks.push(current); current = undefined; };
  for (const [pageIndex, page] of pages.entries()) {
    const pageLines = page.split('\n'), nextLines = nextNonemptyLines(pageLines);
    for (const [lineIndex, originalLine] of pageLines.entries()) {
    const line = originalLine.trim(), normalized = fold(line);
    // Page furniture must not become the last option of the previous question.
    if (/^(?:trang\s*\d+(?:\s*\/\s*\d+)?|--\s*\d+\s+of\s+\d+\s*--)$/i.test(normalized) || /\btrang\s+\d+\s*$/.test(normalized) && !/^cau\s+\d/.test(normalized)) continue;
    const heading = /^(?:(?:phan|muc|section)\s+(?:[ivxlcdm]+|\d+)[\s.:)\-]*|[ivxlcdm]+[.)]\s+)/.test(normalized);
    const nextLine = nextLines[lineIndex];
    const isAnswerHeading = isGlobalAnswerHeading(line, nextLine) || /^(?:doi chieu rieng|tai lieu tham khao)/.test(normalized);
    if (isAnswerHeading) { finish(); inAnswers = true; if (isWrittenAnswerHeading(line, nextLine)) inWrittenAnswers = true; continue; }
    if (heading || /^(?:trac nghiem|cau hoi)\s+(?:dung|tra loi|nhieu|chon|dien)/.test(normalized)) {
      const kind = /dung\s*[/\-–]?\s*sai/.test(normalized) ? 'boolean'
        : /tra loi ngan|tu luan ngan/.test(normalized) ? 'short'
        : /dien tu|dien khuyet/.test(normalized) ? 'fill'
        : /ghep (?:doi|cap)|noi cot|sap xep|tu luan|chung minh|ve hinh/.test(normalized) ? 'unsupported'
        : /nhieu (?:lua chon|dap an) dung|chon nhieu/.test(normalized) ? 'multiple'
        : /trac nghiem|lua chon|mot dap an/.test(normalized) ? 'single' : undefined;
      if (kind) { finish(); section = kind; sectionName = line; if (!inWrittenAnswers) inAnswers = false; continue; }
    }
    if ((repeated.get(line) ?? 0) > 1 && !/^cau\s+\d/.test(normalized) && !/^[a-d][.)]/i.test(line) && !heading && /on tap|de (?:kiem tra|cuong)|nam hoc|truong |mon hoc/.test(normalized)) continue;
    if (inAnswers) {
      if (!line && answerHeader) { answerHeader += '\n'; continue; }
      const numbers = line.match(/^Câu\s+((?:\d+\s*)+)$/iu);
      if (numbers) { answerNumbers = numbers[1].trim().split(/\s+/); answerHeader = line; continue; }
      const answers = line.match(/^Đáp án\s+([A-F*\s]+)$/iu);
      const row = line.match(/^(\d+)\s*[.):\-]?\s+([A-F])\s*$/iu);
      const pairs = [...line.matchAll(/(?:^|[\s,|;])(?:Câu\s*)?(\d+)\s*[-.:=]?\s*([A-F])(?=[\s,|;]|$)/giu)];
      if (!answerTables.has(sectionName)) answerTables.set(sectionName, new Map());
      if (!answerTables.has('')) answerTables.set('', new Map());
      if (answers && answerNumbers.length) {
        const values = answers[1].trim().split(/\s+/);
        if (values.length === answerNumbers.length) answerNumbers.forEach((number, i) => {
          const ans = values[i].replace('*', '');
          answerTables.get(sectionName)!.set(number, { answer: ans, quote: `${answerHeader}\n${line}` });
          answerTables.get('')!.set(number, { answer: ans, quote: `${answerHeader}\n${line}` });
        });
      } else if (pairs.length >= 2) {
        for (const pair of pairs) {
          answerTables.get(sectionName)!.set(pair[1], { answer: pair[2].toUpperCase(), quote: line });
          answerTables.get('')!.set(pair[1], { answer: pair[2].toUpperCase(), quote: line });
        }
      } else if (row) {
        answerTables.get(sectionName)!.set(row[1], { answer: row[2], quote: line });
        answerTables.get('')!.set(row[1], { answer: row[2], quote: line });
      }
      continue;
    }
    const question = line.match(/^(?:(?:Câu hỏi|Câu|Cau|Question|Bài|Bai)\s*(\d+)\s*[.:)]?|(?:(\d+)\s*[.)]))\s+(.+)$/iu);
    if (question && !(question[2] && current && (!current.plain || current.region !== 'body'))) {
      finish(); const content = splitQuestionContent([question[3]]);
      current = { number: question[1] ?? question[2], lines: [question[3]], type: section, section: sectionName, pageNumber: pageIndex + 1, plain: !!question[2], region: content.region ?? 'body' };
    } else if (section === 'short' && (!current || current.region === 'body' || readAnswerMarker(nextLine)?.kind === 'answer') && /\?\s*$/.test(line) && !/^(?:[A-Ha-h][.)]|Đáp án|Trả lời)/iu.test(line)) {
      finish(); current = { number: String(blocks.filter(block => block.section === sectionName).length + 1), lines: [line], type: section, section: sectionName, pageNumber: pageIndex + 1, plain: true, region: 'body' };
    } else if (current) { current.lines.push(originalLine); const content = splitQuestionContent([line]); if (content.region && content.region !== 'body') current.region = content.region; }
    }
  }
  finish();
  const questions: SourceQuestion[] = [], unsupported: UnclassifiedQuestion[] = [];
  for (const [index, block] of blocks.entries()) {
    const fullText = compactLayout(block.lines.join('\n'));
    const separated = splitQuestionContent(block.lines);
    const layout = bottomUpLayout(separated.body, block.section);
    const textParts = textAnswerParts(separated);
    const answerItem = textParts.answers[0];
    const answerLine = answerItem ? [answerItem.quote, answerItem.text] : undefined;
    const sourceText = compactLayout(separated.body.join('\n'));
    const sourceExplanation = textParts.explanation || undefined;
    const linearized = layout.lines.join('\n').replace(/(?<!^)(?<!\n)\s*([B-Fb-f])[.)]\s+(?=[^\n]{1,200})/g, "\n$1) ");
    const markers = [...linearized.matchAll(/(?:^|\n|[ \t]+)\*?([A-Fa-f])[.)]\s+/g)];
    const uppercase = markers.filter(match => match[1] === match[1].toUpperCase());
    const lower = markers.filter(match => match[1] === match[1].toLowerCase());
    const inlineBoolean = /dung\s*[/\-–]?\s*sai/.test(fold(sourceText.slice(0, 100))) || !block.type && markers.filter((match, i) => /\s(?:ĐÚNG|SAI|Đ|S)\s*$/iu.test(linearized.slice(match.index! + match[0].length, markers[i + 1]?.index ?? sourceText.length).trim())).length >= 2;
    const isMultipleStem = /(?:chọn|những|các)\s+(?:phát biểu|đáp án|mệnh đề|khẳng định|ý|câu)\s+(?:đúng|nào đúng)|chọn nhiều|nhiều hơn một đáp án|chọn tất cả/i.test(fold(linearized));
    let type = layout.choiceFooter ? layout.kind as 'single' | 'multiple' : layout.kind === 'essay' ? 'unsupported' : inlineBoolean ? 'boolean' : block.type ?? layout.kind ?? (uppercase.length >= 2 ? 'single' : lower.length >= 2 ? 'boolean' : /_{2,}|\.{3,}|\(\s*\.{2,}\s*\)|\u2026/.test(linearized) ? 'fill' : /tinh|bao nhieu|gom may|co may|qua trinh nao|neu ten|viet dap|tra loi ngan|dien vao|dien tu|hoan thanh/.test(fold(linearized)) ? 'short' : 'unsupported');
    if (isMultipleStem && type === 'single') type = 'multiple';
    const writtenWarnings: string[] = [];
    if (/\[Cần xác minh\]/iu.test(fullText)) writtenWarnings.push('Định dạng đáp án chưa rõ; cần giáo viên đối chiếu bản gốc, không tự điền.');
    if (conflictingWrittenAnswers(textParts.answers, type === 'unsupported')) writtenWarnings.push('Các dòng đáp án trả lời chưa thống nhất; cần đối chiếu bản gốc.');
    if (type === 'unsupported') {
      unsupported.push({ key: String(index + 1), type, stem: `Câu ${block.number}. ${sourceText}`, number: block.number, section: block.section, reason: 'Dạng tự luận, ghép đôi, sắp xếp hoặc chưa đủ dấu hiệu để chấm tự động. Cần kiểm tra trước khi chuyển dạng.', pageNumber: block.pageNumber, ...(answerItem?.text && !writtenWarnings.length ? { documentAnswer: { indices: [], acceptedAnswers: [answerItem.text], quote: answerItem.quote } } : {}), ...(sourceExplanation ? { sourceExplanation } : {}), ...(writtenWarnings.length ? { warnings: writtenWarnings } : {}) }); continue;
    }
    const base = { number: block.number, group: `${block.section}:${block.number}:${index}`, section: block.section, pageNumber: block.pageNumber, sourceText, ...(sourceExplanation ? { sourceExplanation } : {}) };
    if (type === 'boolean' && markers.length) {
      const intro = linearized.slice(0, markers[0].index).trim();
      const originalRows = sourceText.split('\n');
      const verdictHeader = originalRows.findIndex(line => /(?:^|\t)\s*ĐÚNG\s*\t\s*SAI\s*$/iu.test(line));
      const verdictRows = verdictHeader >= 0 ? originalRows.slice(verdictHeader + 1).filter(line => line.trim()) : [];
      markers.forEach((match, i) => {
        const raw = linearized.slice(match.index! + match[0].length, markers[i + 1]?.index ?? linearized.length).trim();
        const key = raw.match(/\s+(ĐÚNG|SAI|Đ|S)(?:\s+[xX✗✘])?\s*$/iu);
        const statement = key ? raw.slice(0, key.index).trim() : raw;
        if (!statement) return;
        const uncertain = /\[Cần xác minh\]/iu.test(fullText) || layout.notices.some(notice => notice.requiresReview);
        const direct = markers.length === 1 && answerLine && /^(?:Đúng|Sai|Đ|S)$/iu.test(answerLine[1].trim()) ? answerLine[1].trim() : undefined;
        const listed = answerLine ? [...answerLine[1].matchAll(/([a-h])\s*[-:=]\s*(Đúng|Sai|Đ|S)(?=\s*[,;]|\s*$)/giu)].filter(item => item[1].toLowerCase() === match[1].toLowerCase()) : [];
        const listedVerdict = listed[0]?.[2];
        const verdict = key?.[1] ?? listedVerdict ?? direct;
        const isFalse = (value: string) => ['s', 'sai'].includes(fold(value));
        const conflict = !!(key && listedVerdict && isFalse(key[1]) !== isFalse(listedVerdict)) || new Set(listed.map(item => isFalse(item[2]))).size > 1;
        const originalQuote = verdictRows[i] || (key ? raw.slice(-Math.min(raw.length, 1800)) : answerLine?.[0].trim());
        const answer = verdict && !uncertain && !conflict && originalQuote ? { indices: [fold(verdict) === 'sai' || fold(verdict) === 's' ? 1 : 0], acceptedAnswers: [], quote: originalQuote } : undefined;
        questions.push({ ...base, key: `${index + 1}${match[1]}`, type, stem: `Câu ${block.number}. ${intro}\n${match[1]}) ${statement}`, options: ['Đúng', 'Sai'], ...(answer ? { documentAnswer: answer } : {}) });
      });
      continue;
    }
    const choiceMarkers = type === 'single' || type === 'multiple' ? uppercase : [];
    const rawOptions = choiceMarkers.map((match, i) => linearized.slice(match.index! + match[0].length, choiceMarkers[i + 1]?.index ?? linearized.length).trim());
    const marked = rawOptions.flatMap((option, i) => /\[\s*Đáp án\s*\*?\s*\]|[✓✔√☑]|\[[xX✓✔√]\]/iu.test(option) || choiceMarkers[i]?.[0].includes('*') || /\s*\*$/.test(option.trim()) ? [i] : []);
    const localWarnings: string[] = type === 'short' || type === 'fill' ? [...writtenWarnings] : [];
    if (rawOptions.some(option => /\[\s*Đáp án\s*\*/iu.test(option)) || /chua thong nhat|can doi chieu|tham khao/.test(fold(sourceExplanation ?? ''))) localWarnings.push('Đáp án gốc có ghi chú hoặc chưa thống nhất; cần đối chiếu giáo viên.');
    // Footnotes are not answer options. Preserve their uncertainty as a warning.
    const options = rawOptions.map(option => option.split(/\n\s*\*\s+/)[0].replace(/\[\s*Đáp án\s*\*?\s*\]|[✓✔√☑]|\[[xX✓✔√]\]/giu, '').replace(/\s*\*$/g, '').trim());
    const stem = `Câu ${block.number}. ${linearized.slice(0, choiceMarkers[0]?.index ?? linearized.length).trim()}`;
    let documentAnswer: SourceQuestion['documentAnswer'];
    const tableAnswer = type === 'single' || type === 'multiple' ? (answerTables.get(block.section)?.get(block.number) ?? answerTables.get('')?.get(block.number)) : undefined;
    const answer = answerLine?.[1].trim() ?? tableAnswer?.answer;
    if (marked.length && (type === 'multiple' || marked.length === 1)) documentAnswer = { indices: marked, acceptedAnswers: [], quote: rawOptions[marked[0]].split(/\n\s*\*\s+/)[0].trim() };
    else if (answer && (type === 'single' || type === 'multiple') && /^[A-F](?:\s*[,;]\s*[A-F])*[.]?$/i.test(answer)) {
      const indices = [...answer.toUpperCase().matchAll(/[A-F]/g)].map(m2 => m2[0].charCodeAt(0) - 65);
      if (indices.every(i => i < options.length) && new Set(indices).size === indices.length && (type === 'multiple' ? indices.length >= 2 : indices.length === 1)) documentAnswer = { indices, acceptedAnswers: [], quote: answerLine?.[0].trim() ?? tableAnswer!.quote };
    } else if (answer && (type === 'short' || type === 'fill')) documentAnswer = { indices: [], acceptedAnswers: answer.split('|').map(value => value.trim()).filter(Boolean), quote: answerLine![0].trim() };
    if (type === 'boolean') {
      const verdict = answer && /^(?:Đúng|Sai|Đ|S)$/iu.test(answer) ? fold(answer) : undefined;
      if (verdict) documentAnswer = { indices: [verdict === 'sai' || verdict === 's' ? 1 : 0], acceptedAnswers: [], quote: answerLine![0].trim() };
    }
    if (/\[Cần xác minh\]/iu.test(fullText)) { documentAnswer = undefined; if (!localWarnings.length) localWarnings.push('Định dạng đáp án chưa rõ; cần giáo viên đối chiếu bản gốc, không tự điền.'); }
    if ((type === 'short' || type === 'fill') && writtenWarnings.length) documentAnswer = undefined;
    if (layout.notices.some(notice => notice.requiresReview)) { documentAnswer = undefined; localWarnings.push(...layout.notices.map(notice => notice.message)); }
    if (marked.length && answer && (type === 'single' || type === 'multiple') && /^[A-F](?:\s*[,;]\s*[A-F])*[.]?$/i.test(answer)) {
      const explicit = [...answer.toUpperCase().matchAll(/[A-F]/g)].map(match => match[0].charCodeAt(0) - 65);
      if ([...marked].sort().join() !== [...explicit].sort().join()) { documentAnswer = undefined; localWarnings.push('Dấu tại phương án và dòng/bảng đáp án mâu thuẫn; cần xác minh.'); }
    }
    const finalOptions = type === 'boolean' ? ['Đúng', 'Sai'] : options;
    if ((type === 'single' || type === 'multiple') && finalOptions.length < 2) { warnings.push(`Câu ${block.number}: chưa đọc đủ phương án; cần kiểm tra bố cục.`); continue; }
    questions.push({ ...base, key: String(index + 1), type, stem, options: finalOptions, ...(documentAnswer ? { documentAnswer } : {}), ...(localWarnings.length ? { warnings: localWarnings } : {}) });
  }
  const numberCounts = new Map<string, number>();
  for (const block of blocks) numberCounts.set(block.number, (numberCounts.get(block.number) ?? 0) + 1);
  for (const q of [...questions.filter(question => question.type === 'short' || question.type === 'fill'), ...unsupported]) {
    const unique = numberCounts.get(q.number ?? '') === 1;
    const matches = matchingWrittenAnswers(written, q.number ?? '', q.section ?? '', unique).filter(item => item.text.trim());
    if (!matches.length) continue;
    const parts = textAnswerParts({ body: [], answers: matches.map(item => ({ text: item.text, quote: item.quote })), explanation: matches.map(item => item.explanation).filter(Boolean).join('\n'), answerTail: [] });
    if (matches.some(item => /\[Cần xác minh\]/iu.test(item.quote))) {
      q.documentAnswer = undefined; q.warnings = [...(q.warnings ?? []), 'Phần đáp án cuối đề có dấu cần xác minh; đối chiếu bản gốc trước khi dùng.'];
    }
    const values = [...new Set(parts.answers.flatMap(item => writtenAnswerValues(item.text, q.type === 'unsupported')))];
    if (conflictingWrittenAnswers(parts.answers, q.type === 'unsupported') || q.documentAnswer && !sameWrittenAnswers(q.documentAnswer.acceptedAnswers, values)) {
      const message = `Câu ${q.number}: phần đáp án cuối đề mâu thuẫn, cần đối chiếu.`;
      q.documentAnswer = undefined; q.warnings = [...(q.warnings ?? []), message];
    } else if (!q.documentAnswer && !q.warnings?.length) q.documentAnswer = { indices: [], acceptedAnswers: values, quote: parts.answers[0].quote };
    q.sourceExplanation ||= parts.explanation || undefined;
  }
  const counts = emptyCounts(); for (const q of questions) counts[q.type]++;
  if (unsupported.length) warnings.push(`${unsupported.length} câu cần duyệt dạng; chưa tự chuyển thành trả lời ngắn.`);
  for (const q of unsupported) for (const warning of q.warnings ?? []) warnings.push(`Câu ${q.number}: ${warning}`);
  if (questions.some(q => q.warnings?.length)) warnings.push('Có đáp án gốc được đánh dấu cần đối chiếu; xem cảnh báo tại từng câu.');
  return { questions, unsupported, counts, total: questions.length, sourceGroups: new Set(questions.map(q => q.group)).size, pages: pages.length, warnings };
}

export function detectSourceQuestions(text: string): SourceQuestion[] { return analyzeDocument(text).questions; }
export function selectSourceQuestions(questions: SourceQuestion[], types: QuestionType[], count: number) {
  const selected = new Set<SourceQuestion>();
  for (const type of types) { const first = questions.find(q => q.type === type); if (first && selected.size < count) selected.add(first); }
  for (const q of questions) if (selected.size < count && types.includes(q.type)) selected.add(q);
  return questions.filter(q => selected.has(q));
}

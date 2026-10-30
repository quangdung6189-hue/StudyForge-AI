import type { QuestionType } from '@studyforge/contracts';

export type SourceQuestion = {
  key: string; type: QuestionType; stem: string; options: string[]; sourceText: string;
  number?: string; group?: string; section?: string; pageNumber?: number;
  warnings?: string[]; sourceExplanation?: string;
  documentAnswer?: { indices: number[]; acceptedAnswers: string[]; quote: string };
};
export type UnclassifiedQuestion = { key: string; type: 'unsupported'; stem: string; reason: string; pageNumber: number };
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd');
const compact = (text: string) => text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const emptyCounts = () => ({ single: 0, multiple: 0, boolean: 0, short: 0, fill: 0 });

export function analyzeDocument(text: string) {
  const pages = text.normalize('NFC').replace(/\r/g, '').split('\f').map(page => page.replace(/(^|\n)(Câu[ \t]+\d+(?:[ \t]+\d+)*[ \t]*)(\n(?:[ \t]*\n)*)(?=Đáp án[ \t]+[A-F*])/giu, '$1BẢNG ĐÁP ÁN\n$2$3'));
  const repeated = new Map<string, number>();
  for (const page of pages) for (const line of new Set(page.split('\n').map(line => line.trim()).filter(Boolean))) repeated.set(line, (repeated.get(line) ?? 0) + 1);
  type Block = { number: string; lines: string[]; type?: QuestionType | 'unsupported'; section: string; pageNumber: number };
  const blocks: Block[] = [];
  const warnings: string[] = [];
  let current: Block | undefined, section: QuestionType | 'unsupported' | undefined, sectionName = '', inAnswers = false;
  const answerTables = new Map<string, Map<string, { answer: string; quote: string }>>();
  let answerNumbers: string[] = [], answerHeader = '';
  const finish = () => { if (current) blocks.push(current); current = undefined; };
  for (const [pageIndex, page] of pages.entries()) for (const originalLine of page.split('\n')) {
    const line = originalLine.trim(), normalized = fold(line);
    // Page furniture must not become the last option of the previous question.
    if (/^(?:trang\s*\d+(?:\s*\/\s*\d+)?|--\s*\d+\s+of\s+\d+\s*--)$/i.test(normalized) || /\btrang\s+\d+\s*$/.test(normalized) && !/^cau\s+\d/.test(normalized)) continue;
    const heading = /^(?:(?:phan|muc|section)\s+(?:[ivxlcdm]+|\d+)[\s.:)\-]*|[ivxlcdm]+[.)]\s+)/.test(normalized);
    const isAnswerHeading = /^(?:(?:phan|muc)\s+(?:[ivxlcdm]+|\d+)[\s.:)\-]*)?(?:bang dap an|dap an nhanh|huong dan (?:tra loi|giai)|doi chieu rieng|tai lieu tham khao)/.test(normalized) || /^(?:dap an|loi giai)\s*[:.\-]?\s*$/.test(normalized);
    if (isAnswerHeading) { finish(); inAnswers = true; continue; }
    if (heading || /^(?:trac nghiem|cau hoi)\s+(?:dung|tra loi|nhieu|chon|dien)/.test(normalized)) {
      const kind = /dung\s*[/\-–]?\s*sai/.test(normalized) ? 'boolean'
        : /tra loi ngan|tu luan ngan/.test(normalized) ? 'short'
        : /dien tu|dien khuyet/.test(normalized) ? 'fill'
        : /ghep (?:doi|cap)|noi cot|sap xep|tu luan|chung minh|ve hinh/.test(normalized) ? 'unsupported'
        : /nhieu (?:lua chon|dap an) dung|chon nhieu/.test(normalized) ? 'multiple'
        : /trac nghiem|lua chon|mot dap an/.test(normalized) ? 'single' : undefined;
      if (kind) { finish(); section = kind; sectionName = line; inAnswers = false; continue; }
    }
    if ((repeated.get(line) ?? 0) > 1 && !/^cau\s+\d/.test(normalized) && !/^[a-d][.)]/i.test(line) && !heading && /on tap|de (?:kiem tra|cuong)|nam hoc|truong |mon hoc/.test(normalized)) continue;
    if (inAnswers) {
      if (!line && answerHeader) { answerHeader += '\n'; continue; }
      const numbers = line.match(/^Câu\s+((?:\d+\s*)+)$/iu);
      if (numbers) { answerNumbers = numbers[1].trim().split(/\s+/); answerHeader = line; continue; }
      const answers = line.match(/^Đáp án\s+([A-F*\s]+)$/iu);
      const row = line.match(/^(\d+)\s*[.):\-]?\s+([A-F])\s*$/iu);
      if (!answerTables.has(sectionName)) answerTables.set(sectionName, new Map());
      if (answers && answerNumbers.length) {
        const values = answers[1].trim().split(/\s+/);
        if (values.length === answerNumbers.length) answerNumbers.forEach((number, i) => answerTables.get(sectionName)!.set(number, { answer: values[i].replace('*', ''), quote: `${answerHeader}\n${line}` }));
      } else if (row) answerTables.get(sectionName)!.set(row[1], { answer: row[2], quote: line });
      continue;
    }
    const question = line.match(/^(?:(?:Câu|Cau|Question)\s*(\d+)\s*[.:)]?|(?:(\d+)\s*[.)]))\s+(.+)$/iu);
    if (question) {
      finish(); current = { number: question[1] ?? question[2], lines: [question[3]], type: section, section: sectionName, pageNumber: pageIndex + 1 };
    } else if (current) current.lines.push(originalLine);
  }
  finish();
  const questions: SourceQuestion[] = [], unsupported: UnclassifiedQuestion[] = [];
  for (const [index, block] of blocks.entries()) {
    const fullText = compact(block.lines.join('\n'));
    const answerLine = fullText.match(/(?:^|\n)[ \t]*(?:Đáp án|Dap an|Đáp số|Dap so|Trả lời|Tra loi)\s*:\s*([^\n]+)/iu);
    const solutionLine = fullText.match(/(?:^|\n)[ \t]*(?:Lời giải|Hướng dẫn giải|Giải thích(?: ngắn)?|Ghi chú)\s*:/iu);
    const sourceText = fullText.slice(0, Math.min(answerLine?.index ?? fullText.length, solutionLine?.index ?? fullText.length)).trim();
    const sourceExplanation = solutionLine ? fullText.slice(solutionLine.index! + solutionLine[0].length).trim() : undefined;
    const linearized = sourceText.replace(/(?<!^)(?<!\n)\s*([B-Fb-f])[.)]\s+(?=[^\n]{1,200})/g, "\n$1) ");
    const markers = [...linearized.matchAll(/(?:^|\n|[ \t]+)([A-Fa-f])[.)]\s+/g)];
    const uppercase = markers.filter(match => match[1] === match[1].toUpperCase());
    const lower = markers.filter(match => match[1] === match[1].toLowerCase());
    const inlineBoolean = /dung\s*[/\-–]?\s*sai/.test(fold(sourceText.slice(0, 100))) || !block.type && markers.filter((match, i) => /\s(?:ĐÚNG|SAI|Đ|S)\s*$/iu.test(linearized.slice(match.index! + match[0].length, markers[i + 1]?.index ?? sourceText.length).trim())).length >= 2;
    const type = inlineBoolean ? 'boolean' : block.type ?? (uppercase.length >= 2 ? 'single' : lower.length >= 2 ? 'boolean' : /_{2,}|\.{3,}|\(\s*\.{2,}\s*\)|\u2026/.test(linearized) ? 'fill' : /tinh|bao nhieu|neu ten|viet dap|tra loi ngan|dien vao|dien tu|hoan thanh/.test(fold(linearized)) ? 'short' : 'unsupported');
    if (type === 'unsupported') {
      unsupported.push({ key: String(index + 1), type, stem: `Câu ${block.number}. ${sourceText}`, reason: 'Dạng tự luận, ghép đôi, sắp xếp hoặc chưa đủ dấu hiệu để chấm tự động. Cần kiểm tra trước khi chuyển dạng.', pageNumber: block.pageNumber }); continue;
    }
    const base = { number: block.number, group: `${block.section}:${block.number}:${index}`, section: block.section, pageNumber: block.pageNumber, sourceText, ...(sourceExplanation ? { sourceExplanation } : {}) };
    if (type === 'boolean' && markers.length) {
      const intro = linearized.slice(0, markers[0].index).trim();
      markers.forEach((match, i) => {
        const raw = linearized.slice(match.index! + match[0].length, markers[i + 1]?.index ?? sourceText.length).trim();
        const key = raw.match(/\s+(ĐÚNG|SAI|Đ|S)\s*$/iu);
        const statement = key ? raw.slice(0, key.index).trim() : raw;
        if (!statement) return;
        const answer = key ? { indices: [fold(key[1]) === 'sai' || fold(key[1]) === 's' ? 1 : 0], acceptedAnswers: [], quote: raw.slice(-Math.min(raw.length, 1800)) } : undefined;
        questions.push({ ...base, key: `${index + 1}${match[1]}`, type, stem: `Câu ${block.number}. ${intro}\n${match[1]}) ${statement}`, options: ['Đúng', 'Sai'], ...(answer ? { documentAnswer: answer } : {}) });
      });
      continue;
    }
    const choiceMarkers = type === 'single' || type === 'multiple' ? uppercase : [];
    const rawOptions = choiceMarkers.map((match, i) => linearized.slice(match.index! + match[0].length, choiceMarkers[i + 1]?.index ?? sourceText.length).trim());
    const marked = rawOptions.flatMap((option, i) => /\[\s*Đáp án\s*\*?\s*\]|[✓✔]/iu.test(option) ? [i] : []);
    const localWarnings: string[] = [];
    if (rawOptions.some(option => /\[\s*Đáp án\s*\*/iu.test(option)) || /chua thong nhat|can doi chieu|tham khao/.test(fold(sourceExplanation ?? ''))) localWarnings.push('Đáp án gốc có ghi chú hoặc chưa thống nhất; cần đối chiếu giáo viên.');
    // Footnotes are not answer options. Preserve their uncertainty as a warning.
    const options = rawOptions.map(option => option.split(/\n\s*\*\s+/)[0].replace(/\[\s*Đáp án\s*\*?\s*\]|[✓✔]/giu, '').trim());
    const stem = `Câu ${block.number}. ${sourceText.slice(0, choiceMarkers[0]?.index ?? sourceText.length).trim()}`;
    let documentAnswer: SourceQuestion['documentAnswer'];
    const tableAnswer = type === 'single' || type === 'multiple' ? answerTables.get(block.section)?.get(block.number) : undefined;
    const answer = answerLine?.[1].trim() ?? tableAnswer?.answer;
    if (marked.length && (type === 'multiple' || marked.length === 1)) documentAnswer = { indices: marked, acceptedAnswers: [], quote: rawOptions[marked[0]].split(/\n\s*\*\s+/)[0].trim() };
    else if (answer && (type === 'single' || type === 'multiple') && /^[A-F](?:\s*[,;]\s*[A-F])*[.]?$/i.test(answer)) {
      const indices = [...answer.toUpperCase().matchAll(/[A-F]/g)].map(m2 => m2[0].charCodeAt(0) - 65);
      if (indices.every(i => i < options.length) && new Set(indices).size === indices.length && (type === 'multiple' ? indices.length >= 2 : indices.length === 1)) documentAnswer = { indices, acceptedAnswers: [], quote: answerLine?.[0].trim() ?? tableAnswer!.quote };
    } else if (answer && (type === 'short' || type === 'fill')) documentAnswer = { indices: [], acceptedAnswers: [answer], quote: answerLine![0].trim() };
    if (type === 'boolean') {
      const verdict = answer && /^(?:Đúng|Sai|Đ|S)$/iu.test(answer) ? fold(answer) : undefined;
      if (verdict) documentAnswer = { indices: [verdict === 'sai' || verdict === 's' ? 1 : 0], acceptedAnswers: [], quote: answerLine![0].trim() };
    }
    const finalOptions = type === 'boolean' ? ['Đúng', 'Sai'] : options;
    if ((type === 'single' || type === 'multiple') && finalOptions.length < 2) { warnings.push(`Câu ${block.number}: chưa đọc đủ phương án; cần kiểm tra bố cục.`); continue; }
    questions.push({ ...base, key: String(index + 1), type, stem, options: finalOptions, ...(documentAnswer ? { documentAnswer } : {}), ...(localWarnings.length ? { warnings: localWarnings } : {}) });
  }
  const counts = emptyCounts(); for (const q of questions) counts[q.type]++;
  if (unsupported.length) warnings.push(`${unsupported.length} câu cần duyệt dạng; chưa tự chuyển thành trả lời ngắn.`);
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

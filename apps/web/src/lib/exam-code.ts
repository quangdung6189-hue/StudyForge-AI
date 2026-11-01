import type { QuestionType } from '@studyforge/contracts';
import { bottomUpLayout, unglueExamText } from './exam-layout';

export type ExamIssue = { code: string; message: string; line: number; severity: 'error' | 'warning' };
export type ExamOption = { id: string; letter: string; text: string };
export type ExamStatement = ExamOption & { verdict: boolean | null };
export type ExamQuestion = {
  id: string; globalIndex: number; number: number; stem: string; group: string; type: QuestionType;
  options: ExamOption[]; statements: ExamStatement[]; correctOptionIds: string[]; acceptedAnswers: string[];
  points: number; explanation: string; startLine: number; endLine: number; sourceText: string;
  issues: ExamIssue[]; answerEvidence: string[];
  classification?: 'ESSAY';
};
export const QUESTION_LABELS: Record<QuestionType, string> = { single: 'Trắc nghiệm một đáp án', multiple: 'Trắc nghiệm nhiều đáp án', boolean: 'Đúng – Sai', short: 'Trả lời ngắn', fill: 'Điền từ' };
export const normalizeLine = (value: string) => (value ?? '').replace(/\u00a0/g, ' ').trim();
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase();

/** Stable browser/server identity; not a secret or a security token. */
export function examId(value: string): string {
  const words = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (const char of value) for (let i = 0; i < 4; i++) words[i] = Math.imul(words[i] ^ char.charCodeAt(0), 0x01000193 + i * 2) >>> 0;
  const hex = words.map(word => word.toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function isSectionHeader(value: string): boolean {
  const text = fold(normalizeLine(value));
  if (/^\[!b:\$.*\$\]$/.test(text)) return true;
  if (/^(truong|ubnd|phong gd|de cuong|de kiem tra|huong dan cham|bang dap an)\b/.test(text)) return true;
  return /^(?:cau\s*\d+[.:]\s*)?(?:(?:phan|nhom|muc|chuong|chu de|part|section)\s+(?:[ivxlcdm]+|\d+|sinh)\b|[ivx]+[.)]\s+|(?:trac nghiem|cau hoi dung|dung\s*[/–-]?\s*sai|tra loi ngan|tu luan|dien tu)\s*(?:$|[.:]|nhieu|mot|dung|tra|chon))/.test(text);
}
const headerKind = (text: string): QuestionType | undefined => {
  const value = fold(text);
  return /dung\s*[/–-]?\s*sai/.test(value) ? 'boolean' : /tra loi ngan/.test(value) ? 'short' : /dien tu|dien khuyet/.test(value) ? 'fill' : /chon nhieu|nhieu dap an/.test(value) ? 'multiple' : /trac nghiem|lua chon/.test(value) ? 'single' : undefined;
};
const qStart = /^(?:Câu hỏi|Câu|Cau|Question|Bài|Bai)\s*(\d+)\s*[.:)]\s*(.*)$|^(\d+)[.)]\s+(.+)$/iu;
const answerStart = /^(?:Đáp án(?: đúng)?|Dap an|Đáp số|Dap so|Answer|Trả lời)\s*[:\-]\s*(.*)$/iu;
const solutionStart = /^(?:Lời giải|Hướng dẫn(?: chi tiết| giải)?|Giải thích(?: chi tiết| ngắn)?)\s*:?\s*(.*)$/iu;

export function parseExamCode(code: string): { questions: ExamQuestion[]; groups: string[]; issues: ExamIssue[] } {
  const lines = unglueExamText(code).text.split('\n');
  const questions: ExamQuestion[] = [], groups: string[] = [], issues: ExamIssue[] = [];
  let group = '', kind: QuestionType | undefined, current: { start: number; number: number; lines: string[]; group: string; kind?: QuestionType; plain: boolean } | undefined;
  let inTable = false, tableSection = '', numbers: string[] = [];
  const table = new Map<string, { answer: string; quote: string }>();
  const occurrences = new Map<string, number>();
  const flush = (end: number) => {
    if (!current) return;
    const block = current; current = undefined;
    const key = `${block.group}:${block.number}`, occurrence = occurrences.get(key) ?? 0; occurrences.set(key, occurrence + 1);
    const id = examId(`${key}:${occurrence}`);
    const localIssues: ExamIssue[] = [], answerEvidence: string[] = [];
    const add = (issue: string, message: string, severity: 'error' | 'warning' = 'error') => localIssues.push({ code: issue, message, severity, line: block.start + 1 });
    let first = block.lines[0] ?? '', points = 1, type = block.kind;
    const explicitType = first.match(/\[type:(single|multiple|boolean|short|fill)\]/i);
    if (explicitType) { type = explicitType[1].toLowerCase() as QuestionType; first = first.replace(explicitType[0], '').trim(); }
    const point = first.match(/\[([\d.,]+)\s*(?:điểm|đ|points?)\]/iu);
    if (point) { points = Number(point[1].replace(',', '.')); first = first.replace(point[0], '').trim(); }
    const layout = bottomUpLayout([first, ...block.lines.slice(1)], block.group, explicitType ? type : undefined);
    if (layout.kind && layout.kind !== 'essay' && !explicitType) type = layout.kind;
    if (layout.choiceFooter) type = layout.kind === 'multiple' ? 'multiple' : 'single';
    for (const notice of layout.notices) add(notice.code, notice.message, notice.requiresReview ? 'error' : 'warning');
    if (layout.kind === 'essay') add('ESSAY_REQUIRES_MANUAL_GRADING', 'Câu tự luận được giữ nguyên; không đưa vào chấm trắc nghiệm tự động.');
    first = layout.lines[0] ?? first;
    if (!(points > 0 && points <= 100)) add('INVALID_POINTS', 'Điểm câu phải lớn hơn 0 và không quá 100.');
    const stemLines = [first], options: ExamOption[] = [], statements: ExamStatement[] = [];
    const marked: string[] = [], answers: string[] = []; let explanation = '', inSolution = false;
    const checkboxLetters = new Set<string>();
    const verdicts = new Map<string, boolean>();
    const optionStart = layout.choiceFooter ? layout.lines.findIndex((line, index) => index > 0 && /^\*?A[.)]\s+/.test(line)) : -1;
    for (const [bodyIndex, raw] of layout.lines.slice(1).entries()) {
      const line = normalizeLine(raw); if (!line) continue;
      const answer = line.match(answerStart);
      if (answer) { answers.push(answer[1]); answerEvidence.push(line); continue; }
      const solution = line.match(solutionStart);
      if (solution) { inSolution = true; explanation = solution[1]; continue; }
      if (inSolution) { explanation += '\n' + raw; continue; }
      if (layout.kind === 'essay' || optionStart > 0 && bodyIndex + 1 < optionStart) { stemLines.push(raw); continue; }
      const choices = [...line.matchAll(/(?:^|\s+)(\*?)([A-Ha-h])[.)]\s+(.*?)(?=(?:\s+\*?[A-Ha-h][.)]\s+)|$)/gu)];
      const checkbox = line.match(/^\[([xX ]?)\]\s+(.+)$/);
      if (checkbox) checkboxLetters.add(String.fromCharCode(65 + options.length));
      if (choices.length || checkbox) {
        const entries = checkbox ? [{ label: String.fromCharCode(65 + options.length), text: checkbox[2], marked: checkbox[1].toLowerCase() === 'x', lower: false }] : choices.map(m => ({ label: m[2].toUpperCase(), text: m[3], marked: !!m[1], lower: m[2] === m[2].toLowerCase() }));
        for (const entry of entries) {
          let text = entry.text.trim();
          const isMarked = entry.marked || /\[\s*Đáp án\s*\]|(?:^|\s)[✓✔]\s*$/iu.test(text);
          text = text.replace(/\[\s*Đáp án\s*\]|(?:^|\s)[✓✔]\s*$/giu, '').trim();
          if (entry.lower || type === 'boolean') {
            type = 'boolean';
            const verdict = text.match(/\s+(ĐÚNG|SAI|Đ|S)(?:\s+[xX✗✘])?\s*$/iu);
            let value: boolean | null = verdict ? !['s', 'sai'].includes(fold(verdict[1])) : isMarked ? true : null;
            if (isMarked && value === false) add('ANSWER_CONFLICT', `Ý ${entry.label.toLowerCase()} vừa có dấu đánh đúng vừa có đáp án Sai.`);
            if (verdict) text = text.slice(0, verdict.index).trim();
            if (value !== null) { verdicts.set(entry.label, value); answerEvidence.push(raw); }
            statements.push({ id: examId(`${id}:${entry.label}`), letter: entry.label.toLowerCase(), text, verdict: value });
          } else {
            options.push({ id: examId(`${id}:${entry.label}`), letter: entry.label, text });
            if (isMarked) { marked.push(entry.label); answerEvidence.push(raw); }
          }
        }
      } else if (options.length) options[options.length - 1].text += '\n' + raw;
      else if (statements.length) statements[statements.length - 1].text += '\n' + raw;
      else stemLines.push(raw);
    }
    const stem = stemLines.join('\n').trim();
    if (!stem) add('EMPTY_STEM', 'Thiếu nội dung câu hỏi.');
    if (/\[(?:cần xác minh|can xac minh|verify)\]/iu.test(block.lines.join('\n'))) add('REQUIRES_REVIEW', 'Dấu màu/ký hiệu chưa rõ hoặc có mâu thuẫn. Đối chiếu bản gốc trước khi dùng.');
    if (occurrence) add('DUPLICATE_NUMBER', `Trùng số Câu ${block.number} trong cùng phần.`, 'warning');
    type ??= options.length ? 'single' : /_{2,}|\(\.{2,}\)|\(…\)/.test(stem) ? 'fill' : 'short';
    if (checkboxLetters.size && !explicitType && !block.kind) type = 'multiple';
    if (!layout.choiceFooter && !options.length && !statements.length && !explicitType && !block.kind && /phân tích|chứng minh|trình bày|vẽ hình|ghép đôi|sắp xếp/iu.test(stem)) add('UNSUPPORTED', 'Câu tự luận dài/ghép đôi/sắp xếp cần chọn lại dạng, không tự coi là trả lời ngắn.');
    if (!layout.choiceFooter && /tự luận/iu.test(block.group) && !/trả lời ngắn/iu.test(block.group) && !explicitType) add('UNSUPPORTED', 'Phần tự luận chưa được hỗ trợ chấm tự động. Chọn lại dạng và xác minh nội dung.');
    const tableAnswer = table.get(`${block.group}:${block.number}`);
    if (tableAnswer) { answers.push(tableAnswer.answer); answerEvidence.push(tableAnswer.quote); }
    const chosen = new Set(marked); const acceptedAnswers: string[] = [];
    for (const answer of answers) {
      if (!answer.trim()) continue;
      if (type === 'boolean') {
        const parts = [...answer.matchAll(/([a-h])\s*[-:=]\s*(Đúng|Sai|Đ|S|true|false)(?=\s*[,;]|\s*$)/giu)];
        if (!parts.length) { add('INVALID_BOOLEAN', 'Đáp án đúng–sai cần dạng a - Đ, b - S.'); continue; }
        if (answer.replace(/([a-h])\s*[-:=]\s*(Đúng|Sai|Đ|S|true|false)(?=\s*[,;]|\s*$)/giu, '').replace(/[,;\s]/g, '')) add('INVALID_BOOLEAN', 'Dòng đáp án đúng–sai còn ký hiệu chưa đọc được.');
        for (const part of parts) {
          const letter = part[1].toUpperCase(), value = !['s', 'sai', 'false'].includes(fold(part[2]));
          if (!statements.some(statement => statement.letter.toUpperCase() === letter)) add('INVALID_BOOLEAN', `Đáp án ý ${part[1]} không có nhận định tương ứng.`);
          if (verdicts.has(letter) && verdicts.get(letter) !== value) add('ANSWER_CONFLICT', `Ý ${part[1]} có đáp án mâu thuẫn.`);
          verdicts.set(letter, value);
        }
      } else if (type === 'short' || type === 'fill') acceptedAnswers.push(...answer.split('|').map(value => value.trim()).filter(Boolean));
      else {
        if (!/^[A-H](?:\s*[,;|]\s*[A-H])*\.?$/i.test(answer)) { add('INVALID_ANSWER', 'Đáp án lựa chọn phải là A–H, nhiều đáp án cách nhau bằng dấu phẩy.'); continue; }
        const letters = [...answer.toUpperCase().matchAll(/[A-H]/g)].map(m => m[0]);
        if (chosen.size && [...chosen].sort().join() !== [...new Set(letters)].sort().join()) add('ANSWER_CONFLICT', 'Ký hiệu tại phương án và dòng/bảng đáp án không khớp.');
        letters.forEach(letter => chosen.add(letter));
      }
    }
    if (type === 'boolean') {
      if (new Set(statements.map(statement => statement.letter)).size !== statements.length) add('DUPLICATE_STATEMENT', 'Trùng nhãn nhận định đúng–sai.');
      for (const statement of statements) { statement.verdict = verdicts.get(statement.letter.toUpperCase()) ?? null; if (statement.verdict === null) add('MISSING_ANSWER', `Ý ${statement.letter} chưa có đáp án Đúng/Sai.`); }
      if (!statements.length) add('INVALID_BOOLEAN', 'Câu đúng–sai cần các ý a), b), c), d).');
    } else if (type === 'single' || type === 'multiple') {
      if (options.length < 2 || options.length > 8) add('INVALID_OPTIONS', 'Cần từ 2 đến 8 phương án cho câu trắc nghiệm.');
      if (new Set(options.map(o => o.letter)).size !== options.length) add('DUPLICATE_OPTION', 'Trùng ký hiệu phương án.');
      if (options.some((option, index) => option.letter !== String.fromCharCode(65 + index))) add('OPTION_SEQUENCE', 'Nhãn phương án phải liên tục A, B, C… Kiểm tra phương án bị thiếu hoặc sai thứ tự.');
      if ([...chosen].some(letter => !options.some(option => option.letter === letter))) add('INVALID_ANSWER', 'Đáp án tham chiếu phương án không tồn tại.');
      if (!chosen.size) add('MISSING_ANSWER', 'Chưa có đáp án. Hệ thống không tự chọn A.');
      if (chosen.size > 1 && type === 'single') {
        if (explicitType?.[1] === 'single' || block.kind === 'single' && !explicitType) add('MULTIPLE_IN_SINGLE', 'Câu một đáp án đang có nhiều lựa chọn đúng.'); else type = 'multiple';
      }
    } else if (!acceptedAnswers.length) add('MISSING_ANSWER', 'Chưa có đáp án trả lời ngắn/điền từ.');
    if ((type === 'short' || type === 'fill') && (options.length || statements.length)) add('TYPE_CONFLICT', 'Dạng trả lời ngắn không được có phương án lựa chọn.');
    questions.push({ id, globalIndex: questions.length + 1, number: block.number, stem, group: block.group, type, options, statements, correctOptionIds: options.filter(option => chosen.has(option.letter)).map(option => option.id), acceptedAnswers: [...new Set(acceptedAnswers)], points, explanation: explanation.trim(), startLine: block.start + 1, endLine: end, sourceText: lines.slice(block.start, end).join('\n'), issues: localIssues, answerEvidence, ...(layout.kind === 'essay' ? { classification: 'ESSAY' as const } : {}) });
  };
  // Collect answer tables first, including sections whose numbering restarts.
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeLine(lines[i]);
    if (/^(HẾT|BẢNG ĐÁP ÁN|ĐÁP ÁN NHANH)\b/iu.test(line)) { inTable = true; continue; }
    if (!inTable) { if (isSectionHeader(line)) tableSection = line.replace(/^\[!b:\$|\$\]$/g, '').trim(); continue; }
    if (isSectionHeader(line) && !/bảng đáp án/iu.test(line)) { tableSection = line.replace(/^\[!b:\$|\$\]$/g, '').trim(); numbers = []; continue; }
    const row = line.match(/^Câu\s+([\d\s\t|]+)$/iu);
    if (row) { numbers = row[1].split(/[\s|]+/).filter(Boolean); continue; }
    const choices = line.match(/^(?:Chọn|Đáp án)\s+(.+)$/iu);
    if (choices && numbers.length) { const values = choices[1].split(/[\t|]+| {2,}/).filter(Boolean); const cells = values.length === numbers.length ? values : choices[1].split(/\s+/); if (cells.length === numbers.length) numbers.forEach((number, index) => table.set(`${tableSection}:${number}`, { answer: cells[index], quote: line })); }
  }
  inTable = false;
  for (let index = 0; index < lines.length; index++) {
    const line = normalizeLine(lines[index]);
    if (/^(HẾT|BẢNG ĐÁP ÁN|ĐÁP ÁN NHANH)\b/iu.test(line)) { flush(index); inTable = true; continue; }
    if (inTable) continue;
    if (isSectionHeader(line)) { flush(index); group = line.replace(/^\[!b:\$|\$\]$/g, '').trim(); kind = headerKind(group); if (!groups.includes(group)) groups.push(group); continue; }
    if (/^(?:Trang\s+\d+(?:\s*\/\s*\d+)?|--\s*\d+\s+of\s+\d+\s*--)$/iu.test(line)) continue;
    const match = line.match(qStart);
    if (match && !(match[3] && current && !current.plain)) { flush(index); current = { start: index, number: Number(match[1] ?? match[3]), lines: [match[2] ?? match[4]], group, kind, plain: !!match[3] }; }
    else if (kind === 'short' && /\?\s*$/.test(line) && !/^(?:[A-Ha-h][.)]|Đáp án|Trả lời)/iu.test(line)) {
      flush(index); current = { start: index, number: questions.filter(question => question.group === group).length + 1, lines: [line], group, kind, plain: true };
    } else if (current) current.lines.push(lines[index]);
  }
  flush(lines.length);
  issues.push(...questions.flatMap(question => question.issues));
  return { questions, groups, issues };
}

export function questionCode(q: ExamQuestion): string {
  const header = `Câu ${q.number}: [type:${q.type}] [${Number(q.points.toFixed(4))}đ] ${q.stem}`;
  const lines = [header];
  if (q.type === 'boolean') {
    q.statements.forEach(statement => lines.push(`${statement.letter}) ${statement.text}`));
    const answers = q.statements.filter(statement => statement.verdict !== null).map(statement => `${statement.letter} - ${statement.verdict ? 'Đ' : 'S'}`);
    if (answers.length) lines.push(`Đáp án: ${answers.join(', ')}`);
  } else if (q.type === 'short' || q.type === 'fill') { if (q.acceptedAnswers.length) lines.push(`Đáp án: ${q.acceptedAnswers.join(' | ')}`); }
  else { q.options.forEach(option => lines.push(`${option.letter}. ${option.text}`)); const selected = q.options.filter(option => q.correctOptionIds.includes(option.id)); if (selected.length) lines.push(`Đáp án: ${selected.map(option => option.letter).join(', ')}`); }
  // An ordinary visual edit must not turn an unparsed/contradictory fragment into a verified key.
  // Keep a blocking marker until the teacher explicitly verifies the changed question.
  if (q.issues.some(issue => issue.severity === 'error' && !['MISSING_ANSWER', 'INVALID_POINTS'].includes(issue.code)) && !q.stem.includes('[Cần xác minh]')) lines[0] += ' [Cần xác minh]';
  if (q.explanation) lines.push(`Lời giải: ${q.explanation}`);
  return lines.join('\n');
}

export function replaceExamQuestion(code: string, question: ExamQuestion, patch: Partial<ExamQuestion> | null): string {
  const lines = unglueExamText(code).text.split('\n');
  lines.splice(question.startLine - 1, question.endLine - question.startLine + 1, ...(patch ? [questionCode({ ...question, ...patch }), ''] : []));
  return lines.join('\n');
}

export function normalizeExamCode(code: string): string {
  const parsed = parseExamCode(code); let next = unglueExamText(code).text;
  // Work in place, keeping preambles, section headings and unclassified text/table blocks.
  for (let index = parsed.questions.length - 1; index >= 0; index--) {
    const question = parsed.questions[index];
    // Formatting is not a repair operation: never erase malformed answer/type evidence.
    if (question.issues.some(issue => issue.severity === 'error' && !['MISSING_ANSWER', 'REQUIRES_REVIEW', 'ANSWER_CONFLICT'].includes(issue.code))) continue;
    next = replaceExamQuestion(next, question, {});
  }
  return next;
}

export function allocateExamPoints(code: string, total = 10): string {
  const { questions } = parseExamCode(code); if (!questions.length) return code;
  const units = Math.round(total * 100), base = Math.floor(units / questions.length), remainder = units % questions.length;
  const lines = unglueExamText(code).text.split('\n');
  for (let i = 0; i < questions.length; i++) {
    const line = questions[i].startLine - 1, points = (base + (i < remainder ? 1 : 0)) / 100;
    const old = /\[[\d.,]+\s*(?:điểm|đ|points?)\]/iu;
    lines[line] = old.test(lines[line]) ? lines[line].replace(old, `[${points}đ]`) : lines[line].replace(qStart, (_match, number, rest, plain, plainRest) => `Câu ${number ?? plain}: [${points}đ] ${rest ?? plainRest}`);
  }
  return lines.join('\n');
}

export function readExamImport(text: string): { code: string; title?: string; minutes?: number } {
  let result: { code: string; title?: string; minutes?: number } = { code: text };
  if (text.trimStart().startsWith('{')) {
    let value: unknown;
    try { value = JSON.parse(text); } catch { throw new Error('JSON bản soạn không hợp lệ.'); }
    const data = value as { format?: unknown; code?: unknown; title?: unknown; minutes?: unknown } | null;
    if (!data || data.format !== 'studyforge.exam.v1' || typeof data.code !== 'string') throw new Error('JSON phải có format studyforge.exam.v1 và trường code dạng văn bản.');
    if (data.title !== undefined && (typeof data.title !== 'string' || data.title.length > 200)) throw new Error('Tên đề trong JSON chưa hợp lệ.');
    if (data.minutes !== undefined && (typeof data.minutes !== 'number' || !Number.isInteger(data.minutes) || data.minutes < 1 || data.minutes > 1440)) throw new Error('Thời gian trong JSON phải từ 1–1440 phút.');
    result = { code: data.code, ...(typeof data.title === 'string' ? { title: data.title } : {}), ...(typeof data.minutes === 'number' ? { minutes: data.minutes } : {}) };
  }
  if (!result.code.trim()) throw new Error('Chưa có nội dung để nhập.');
  if (result.code.length > 250000) throw new Error('Bản soạn quá dài, tối đa 250.000 ký tự.');
  return result;
}

export const EXAM_SAMPLE = `PHẦN I. TRẮC NGHIỆM\n\nCâu 1: Hai cộng hai bằng bao nhiêu?\nA. 3\n*B. 4\nC. 5\nD. 6\n\nPHẦN II. ĐÚNG – SAI\n\nCâu 1: Xét các nhận định sau:\na) Hai cộng hai bằng bốn.\nb) Hai cộng hai bằng năm.\nĐáp án: a - Đ, b - S\n\nPHẦN III. TRẢ LỜI NGẮN\n\nCâu 1: Thủ đô của Việt Nam là gì?\nĐáp án: Hà Nội | Ha Noi`;
import { z } from 'zod';
import { parseExamCode } from '@/lib/exam-code';
import { foldExamText, unglueExamText } from '@/lib/exam-layout';

export const ExamParserProSchema = z.object({
  format: z.literal('studyforge.exam-parser-pro.v1'),
  exam_metadata: z.object({ title: z.string(), subject: z.string().nullable(), grade: z.number().int().min(1).max(12).nullable(), total_questions: z.number().int().nonnegative() }),
  questions: z.array(z.object({
    id: z.string(), original_number: z.string().nullable(), display_number: z.number().int(), section: z.string(),
    type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY']),
    question_stem: z.string(), options: z.array(z.object({ key: z.string(), text: z.string() })),
    sub_statements: z.array(z.object({ key: z.string(), text: z.string(), is_true: z.boolean().nullable() })),
    correct_answer: z.string().nullable(), answer_source: z.enum(['EXTRACTED', 'AI_SOLVED']).nullable(), explanation: z.string(),
    needs_review: z.boolean(), diagnostics: z.array(z.string()), source_text: z.string(),
  })),
  warnings: z.array(z.string()),
});
export type ExamParserProDTO = z.infer<typeof ExamParserProSchema>;

/** Deterministic export never calls AI or invents unknown subject, grade or answer keys. */
export function parseExamPro(text: string, title: string): ExamParserProDTO {
  const repaired = unglueExamText(text), parsed = parseExamCode(repaired.text);
  const header = foldExamText([title, ...text.slice(0, 3000).split('\n').filter(line => /^(?:môn|mon|lớp|lop|khối|khoi|đề|de)\b/iu.test(line.trim()))].join('\n'));
  const grade = header.match(/(?:lớp|lop|khối|khoi)\s*[:\-]?\s*(1[0-2]|[1-9])\b/iu);
  const subjects: [RegExp, string][] = [[/\bvat li|\bvat ly/, 'Vật lí'], [/\bhoa hoc/, 'Hóa học'], [/\bsinh hoc/, 'Sinh học'], [/\btin hoc/, 'Tin học'], [/\bngu van/, 'Ngữ văn'], [/\btieng anh/, 'Tiếng Anh'], [/\btoan(?: hoc)?\b/, 'Toán'], [/\blich su/, 'Lịch sử'], [/\bdia li|\bdia ly/, 'Địa lí'], [/\bkhoa hoc tu nhien/, 'Khoa học tự nhiên']];
  const result: ExamParserProDTO = {
    format: 'studyforge.exam-parser-pro.v1',
    exam_metadata: { title, subject: subjects.find(([pattern]) => pattern.test(header))?.[1] ?? null, grade: grade ? Number(grade[1]) : null, total_questions: parsed.questions.length },
    questions: parsed.questions.map((q, index) => {
      const blocked = q.issues.some(issue => issue.severity === 'error' && !['ESSAY_REQUIRES_MANUAL_GRADING', 'UNSUPPORTED', 'MISSING_ANSWER'].includes(issue.code));
      const incomplete = q.issues.some(issue => issue.code === 'MISSING_ANSWER');
      const essay = q.classification === 'ESSAY';
      const answer = blocked || incomplete ? null : q.type === 'boolean' ? q.statements.every(statement => statement.verdict !== null) ? q.statements.map(statement => `${statement.letter}: ${statement.verdict ? 'Đ' : 'S'}`).join(', ') : null : q.type === 'short' || q.type === 'fill' ? q.acceptedAnswers.join(' | ') || null : q.options.filter(option => q.correctOptionIds.includes(option.id)).map(option => option.letter).join(', ') || null;
      return {
        id: `Q${index + 1}`, original_number: q.sourceText.match(/^\s*((?:Câu hỏi|Câu|Cau|Question|Bài|Bai)\s*\d+|\d+[.)])/iu)?.[1] ?? null, display_number: index + 1, section: q.group,
        type: essay ? 'ESSAY' : q.type === 'boolean' ? 'TRUE_FALSE' : q.type === 'single' || q.type === 'multiple' ? 'MULTIPLE_CHOICE' : 'SHORT_ANSWER',
        question_stem: q.stem, options: essay ? [] : q.options.map(option => ({ key: option.letter, text: option.text })),
        sub_statements: essay ? [] : q.statements.map(statement => ({ key: statement.letter, text: statement.text, is_true: blocked ? null : statement.verdict })),
        correct_answer: answer, answer_source: answer !== null ? 'EXTRACTED' : null, explanation: q.explanation,
        needs_review: true, diagnostics: q.issues.map(issue => issue.message), source_text: q.sourceText,
      };
    }),
    warnings: [...repaired.notices.map(notice => notice.message), 'Đáp án chưa có được giữ null; dùng chế độ AI phân tích trên hệ thống nếu cần gợi ý và duyệt trước khi xuất bản.', 'Tự luận được lưu để giáo viên duyệt, không tự đưa vào engine chấm trắc nghiệm.'],
  };
  return ExamParserProSchema.parse(result);
}
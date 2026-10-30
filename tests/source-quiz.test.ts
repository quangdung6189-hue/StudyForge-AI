import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sourceQuiz } from '../apps/web/src/server/source-quiz';
const text = 'I. Trắc nghiệm\nCâu 1. Hai cộng hai bằng mấy?\nA. 3\nB. 4 [Đáp án]\nCâu 2. Chưa có đáp án.\nA. Một\nB. Hai\nII. Đúng sai\nCâu 1. Với 2 + 2 = 4:\na) Kết quả bằng bốn. ĐÚNG\nb) Kết quả bằng năm. SAI\nIII. Trả lời ngắn\nCâu 1. Tính 2 + 2.\nĐáp án: 4';
describe('Deterministic original-answer creation', () => {
  it('keeps real keys for three formats, excludes unknown keys, and never invents a source explanation', () => {
    const chunk = { id: randomUUID(), content: text };
    const questions = sourceQuiz({ rawText: text, chunks:[chunk], documentTitle:'Source', questionCount:100, types:['single','boolean','short'] });
    expect(questions).toHaveLength(4); expect(new Set(questions.map(q=>q.type))).toEqual(new Set(['single','boolean','short']));
    expect(questions.every(q=>!q.reviewed && q.answerOrigin==='document')).toBe(true);
    expect(questions.every(q=>q.explanation.includes('Tài liệu chưa kèm lời giải'))).toBe(true);
    expect(questions.every(q=>chunk.content.includes(q.sourceRefs[0].quote))).toBe(true);
  });
  it('does not treat a key that is absent from saved chunks as verified', () => {
    expect(()=>sourceQuiz({ rawText:text,chunks:[{id:randomUUID(),content:'Unrelated text'}],documentTitle:'Source',questionCount:3,types:['single'] })).toThrow('đáp án gốc xác thực');
  });
});

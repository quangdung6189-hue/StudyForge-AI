import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AIGatewayError } from '@studyforge/ai';
import { detectSourceQuestions, selectSourceQuestions } from '../apps/web/src/server/question-sections';
import { generateQuizQuestions, GenerationOutputSchema } from '../apps/web/src/server/generator';

const provider = vi.hoisted(() => ({ structured: vi.fn() }));
vi.mock('@studyforge/ai', async importOriginal => ({ ...await importOriginal<object>(), gatewayFromEnv: () => provider }));
export const mixedExam = `PHẦN I. Trắc nghiệm nhiều phương án lựa chọn
Câu 1. Hai cộng hai bằng bao nhiêu?
A. 3   B. 4   C. 5   D. 6
PHẦN II. Trắc nghiệm đúng sai
Câu 1. Với phép tính 2 + 2 = 4, xét các nhận định:
a) Kết quả là số chẵn.
b) Kết quả bằng 5.
PHẦN III. Trả lời ngắn
Câu 1. Tính 2 + 2.
ĐÁP ÁN
1. B
`;
const chunk = { id: randomUUID(), chunkIndex: 0, content: mixedExam };
const input = { documentTitle: 'Số học', rawText: mixedExam, chunks: [chunk], mode: 'ai_generate' as const, questionCount: 3, types: ['single', 'boolean', 'short'] as const };
const params = () => ({ ...input, types: [...input.types] });
function fixture() {
  return { questions: ['single', 'boolean', 'short'].map((type, slot) => ({
    slot, type, stem: `Câu hỏi ${slot + 1}`, options: type === 'short' ? [] : type === 'boolean' ? ['Đúng', 'Sai'] : ['3', '4', '5', '6'], correctIndices: type === 'short' ? [] : [type === 'single' ? 1 : 0], acceptedAnswers: type === 'short' ? ['4'] : [],
    solution: { conclusion: 'Kết quả đúng là số bốn.', reasoning: ['Phép cộng gộp hai nhóm, mỗi nhóm có hai đơn vị.', 'Đếm tổng số đơn vị của cả hai nhóm được bốn đơn vị.'], pitfalls: 'Không nhầm phép cộng hai số với phép ghép chữ số.' },
    difficulty: 'comprehension', topic: 'Số học', sourceRefs: [{ chunkId: chunk.id, quote: '2 + 2 = 4' }],
  })) };
}
beforeEach(() => { provider.structured.mockReset(); });
describe('Vietnamese mixed-format source recognition', () => {
  it('distinguishes repeated numbering across sections and splits true/false statements with shared context', () => {
    const source = detectSourceQuestions(mixedExam);
    expect(source.map(q => q.type)).toEqual(['single', 'boolean', 'boolean', 'short']);
    expect(source[0].options).toEqual(['3', '4', '5', '6']);
    expect(source[1].stem).toContain('2 + 2 = 4');
    expect(source[1].stem).not.toContain('b)');
    expect(source[3].stem).not.toContain('ĐÁP ÁN');
    expect(selectSourceQuestions(source, ['single', 'boolean', 'short'], 3).map(q => q.type)).toEqual(['single', 'boolean', 'short']);
  });
  it('does not split decimal commas or interpret uppercase options as true/false subparts', () => {
    const source = detectSourceQuestions('PHẦN III. Trả lời ngắn\nCâu 2. Tính 1,5 + 2,5.\nCâu 3. Tính 2.5 + 1.5.');
    expect(source).toHaveLength(2);
    expect(source.every(q => q.type === 'short' && !q.options.length)).toBe(true);
  });
  it('keeps explicit answer keys separate from choices and recognizes fill sections', () => {
    const source = detectSourceQuestions('PHẦN I. Trắc nghiệm\nCâu 1. Tính 2 + 2.\nA. 3   B. 4\nĐáp án: B\nLời giải: Hai cộng hai bằng bốn.\nPHẦN II. Điền từ\nCâu 1. Hai cộng hai bằng ____.\nĐáp án: 4');
    expect(source[0].options).toEqual(['3', '4']);
    expect(source[0].documentAnswer?.indices).toEqual([1]);
    expect(source[1].type).toBe('fill');
    expect(source[1].documentAnswer?.acceptedAnswers).toEqual(['4']);
    expect(source[0].sourceText).not.toContain('Lời giải');
  });
});
describe('AI quiz validation', () => {
  it('assigns server UUIDs, detailed solutions, and AI origin with review required', async () => {
    const output = GenerationOutputSchema.parse(fixture());
    provider.structured.mockResolvedValue(output);
    const questions = await generateQuizQuestions(params());
    expect(questions.map(q => q.type)).toEqual(['single', 'boolean', 'short']);
    expect(questions[0].options.find(o => o.id === questions[0].correctOptionIds[0])?.text).toBe('4');
    expect(questions.every(q => q.answerOrigin === 'ai_suggested' && !q.reviewed && q.explanation.includes('Bước 2:'))).toBe(true);
    expect(questions.map(q => q.difficulty)).toEqual(['recognition', 'comprehension', 'application']);
    expect(provider.structured.mock.calls[0][0].prompt).toContain(chunk.id);
  });
  it('preserves selected original questions and never claims AI answers are from the document', async () => {
    const original = selectSourceQuestions(detectSourceQuestions(mixedExam), [...input.types], 3);
    const output = fixture(); output.questions.forEach((q, i) => { q.stem = original[i].stem; q.options = original[i].options; });
    provider.structured.mockResolvedValue(output);
    const questions = await generateQuizQuestions({ ...params(), mode: 'extract_existing' });
    expect(questions.map(q => q.stem)).toEqual(original.map(q => q.stem));
    expect(questions.every(q => q.answerOrigin === 'ai_suggested')).toBe(true);
  });
  it('labels a documented answer only when the exact original key is also cited', async () => {
    const content = 'PHẦN I. Trắc nghiệm\nCâu 1. Tính 2 + 2.\nA. 3   B. 4\nĐáp án: B';
    const original = detectSourceQuestions(content)[0];
    const output = fixture(); output.questions = [output.questions[0]];
    output.questions[0].stem = original.stem; output.questions[0].options = original.options;
    output.questions[0].sourceRefs[0].quote = 'Tính 2 + 2.';
    provider.structured.mockResolvedValue(output);
    const [question] = await generateQuizQuestions({ ...params(), rawText: content, chunks: [{ ...chunk, content }], types: ['single'], questionCount: 1, mode: 'extract_existing' });
    expect(question.answerOrigin).toBe('document');
    expect(question.reviewed).toBe(false);
    expect(question.sourceRefs.some(ref => ref.quote === 'Đáp án: B')).toBe(true);
  });
  it.each(['wrong type', 'wrong count', 'fake quote', 'bad answer', 'duplicate slot', 'duplicate stem'])('rejects %s instead of silently returning sample questions', async issue => {
    const output = fixture();
    if (issue === 'wrong type') output.questions[2].type = 'single';
    if (issue === 'wrong count') output.questions.pop();
    if (issue === 'fake quote') output.questions[0].sourceRefs[0].quote = 'Không có trong tài liệu';
    if (issue === 'bad answer') output.questions[0].correctIndices = [10];
    if (issue === 'duplicate slot') output.questions[1].slot = 0;
    if (issue === 'duplicate stem') output.questions[1].stem = output.questions[0].stem;
    provider.structured.mockResolvedValue(output);
    await expect(generateQuizQuestions(params())).rejects.toBeInstanceOf(AIGatewayError);
  });
  it('uses deterministic original text and options even if the provider attempts to rewrite them', async () => {
    provider.structured.mockResolvedValue(fixture());
    const questions = await generateQuizQuestions({ ...params(), mode: 'extract_existing' });
    expect(questions[0].stem).toContain('Hai cộng hai');
    expect(questions[0].stem).not.toBe('Câu hỏi 1');
    expect(questions[0].options.map(option => option.text)).toEqual(['3', '4', '5', '6']);
  });
  it('batches at most three questions with two calls in flight and reports completed work', async () => {
    let active = 0, maximum = 0, call = 0;
    provider.structured.mockImplementation(async ({ prompt }) => {
      active++; maximum = Math.max(maximum, active); const batch = call++;
      const plan = JSON.parse(prompt.match(/Kế hoạch: (.+)\n/)![1]);
      await new Promise(resolve => setTimeout(resolve, 5)); active--;
      return { questions: plan.map((item: { slot: number; type: string; difficulty: string }) => {
        const base = fixture().questions[item.slot % 3];
        return { ...base, ...item, stem: `Câu độc lập nhóm ${batch} vị trí ${item.slot}` };
      }) };
    });
    const progress: number[] = [];
    const questions = await generateQuizQuestions({ ...params(), questionCount: 6, onProgress: value => progress.push(value.completed) });
    expect(questions).toHaveLength(6); expect(provider.structured).toHaveBeenCalledTimes(2); expect(maximum).toBe(2);
    expect(progress.at(-1)).toBe(6); expect(progress).toContain(3);
  });
  it('preserves original worked solutions without waiting for AI to rewrite them', async () => {
    const content = 'II. Đúng/Sai\nCâu 1. Xét 2 + 2 = 4.\nA. Tổng bằng bốn. ĐÚNG\nB. Tổng bằng năm. SAI\nGiải thích ngắn: Gộp hai nhóm có hai phần tử được tổng bốn phần tử. Vì thế tổng bằng năm là sai và tổng bằng bốn là đúng.';
    const questions = await generateQuizQuestions({ ...params(), rawText: content, chunks: [{ ...chunk, content }], mode: 'extract_existing', questionCount: 2, types: ['boolean'] });
    expect(provider.structured).not.toHaveBeenCalled(); expect(questions).toHaveLength(2);
    expect(questions.every(q => q.answerOrigin === 'document' && q.explanation.includes('Lời giải trong tài liệu:') && !q.reviewed)).toBe(true);
  });
  it('propagates gateway failure with no fake success', async () => {
    const error = new AIGatewayError('UPSTREAM', 'unavailable');
    provider.structured.mockRejectedValue(error);
    let caught: unknown;
    try { await generateQuizQuestions(params()); } catch (failure) { caught = failure; }
    expect(caught instanceof Error).toBe(true);
    expect((caught as AIGatewayError).code).toBe('UPSTREAM');
  });
  it('uses chunks beyond the former first-ten truncation', async () => {
    provider.structured.mockResolvedValue(fixture());
    await generateQuizQuestions({ ...params(), chunks: [...Array.from({ length: 11 }, (_, i) => ({ id: randomUUID(), chunkIndex: i, content: `Phần ${i}` })), { ...chunk, chunkIndex: 11 }] });
    expect(provider.structured.mock.calls[0][0].prompt).toContain(`[Chunk ${chunk.id}]`);
  });
  it('rejects unreadable, oversized, and unrecognized source documents before calling AI', async () => {
    await expect(generateQuizQuestions({ ...params(), chunks: [] })).rejects.toBeInstanceOf(AIGatewayError);
    await expect(generateQuizQuestions({ ...params(), chunks: [{ ...chunk, content: 'a'.repeat(160_001) }] })).rejects.toBeInstanceOf(AIGatewayError);
    await expect(generateQuizQuestions({ ...params(), mode: 'extract_existing', rawText: 'Một đoạn kiến thức không có câu hỏi đánh số.' })).rejects.toBeInstanceOf(AIGatewayError);
    expect(provider.structured).not.toHaveBeenCalled();
  });
});

import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { generateQuizQuestions, GenerationOutputSchema, ExtractionOutputSchema } from '../apps/web/src/server/generator';

config({ quiet: true });
const configured = ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL_GENERATE', 'AI_MODEL_REVIEW'].every(key => Boolean(process.env[key]));
console.log(JSON.stringify({ configured, missing: ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL_GENERATE', 'AI_MODEL_REVIEW'].filter(key => !process.env[key]) }));
if (!configured) process.exit(2);
if (process.argv.includes('--diagnose')) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (String(args[0]).endsWith('/chat/completions')) {
      try {
        const payload = await response.clone().json();
        const choice = payload.choices?.[0];
        const content = choice?.message?.content;
        let validation: unknown = 'not_json';
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            const result = (process.argv.includes('--extract') ? ExtractionOutputSchema : GenerationOutputSchema).safeParse(Array.isArray(parsed) ? { questions: parsed } : parsed);
            validation = result.success ? 'valid' : result.error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code, message: issue.message }));
          } catch { validation = { fenced: /^\s*```/.test(content), contentLength: content.length }; }
        }
        console.log(JSON.stringify({ diagnostic: { status: response.status, finishReason: choice?.finish_reason, contentType: typeof content, validation } }));
      } catch {
        const raw = await response.clone().text();
        console.log(JSON.stringify({ diagnostic: { status: response.status, readableJson: false, contentType: response.headers.get('content-type'), serverSentEvents: raw.trimStart().startsWith('data:'), length: raw.length } }));
      }
    }
    return response;
  };
}
const content = `Kiến thức: Hai nhóm, mỗi nhóm 2 phần tử, gộp lại có 4 phần tử. Phép cộng 2 + 2 = 4. Số 4 là số chẵn vì chia hết cho 2.
PHẦN I. Trắc nghiệm
Câu 1. Hai cộng hai bằng bao nhiêu?
A. 3   B. 4   C. 5   D. 6
PHẦN II. Đúng sai
Câu 1. Xét phép tính 2 + 2 = 4.
a) Kết quả là số chẵn.
b) Kết quả bằng 5.
PHẦN III. Trả lời ngắn
Câu 1. Tính 2 + 2.`;
async function main() { try {
  const questions = await generateQuizQuestions({ documentTitle: 'Kiểm tra bộ tạo đề', rawText: content, chunks: [{ id: randomUUID(), chunkIndex: 0, content }], mode: process.argv.includes('--extract') ? 'extract_existing' : 'ai_generate', questionCount: 3, types: ['single', 'boolean', 'short'] });
  console.log(JSON.stringify({ success: true, count: questions.length, types: questions.map(q => q.type), detailedSolutions: questions.every(q => q.explanation.includes('Bước 2:')), citations: questions.every(q => q.sourceRefs.length > 0), reviewRequired: questions.every(q => !q.reviewed) }));
} catch (error) {
  console.log(JSON.stringify({ success: false, code: (error as { code?: string }).code ?? 'ERROR', message: (error as Error).message }));
  process.exitCode = 1;
} }
void main();

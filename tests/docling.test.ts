import { afterEach, describe, expect, it, vi } from 'vitest';
import { readWithDocling } from '../apps/web/src/server/docling';
import { parseExamCode } from '../apps/web/src/lib/exam-code';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Optional private Docling adapter',()=>{
 it('sends the current typed file-source API contract with inline output, without fetching user URLs',async()=>{
  vi.stubEnv('DOCLING_BASE_URL','http://127.0.0.1:5001');vi.stubEnv('DOCLING_API_KEY','test-only');
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',document:{text_content:'Câu 1. Nội dung gốc.',md_content:null,json_content:null}})));vi.stubGlobal('fetch',mock);
  const result=await readWithDocling(Buffer.from('source'),'source.docx');
  const body=JSON.parse(mock.mock.calls[0][1].body);
  expect(body.sources).toEqual([{kind:'file',filename:'source.docx',base64_string:Buffer.from('source').toString('base64')}]);expect(body.target.kind).toBe('inbody');expect(result.method).toBe('docling');expect(result.rawText).toContain('Nội dung gốc');
 });
 it('rejects remote plaintext transports and marks partial conversion as uncertain',async()=>{
  vi.stubEnv('DOCLING_BASE_URL','http://public-reader.example');await expect(readWithDocling(Buffer.from('source'),'file.pdf')).rejects.toThrow('HTTPS');
  vi.stubEnv('DOCLING_BASE_URL','https://private-reader.example');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'partial_success',document:{text_content:'Partial text.'}}))));
  expect((await readWithDocling(Buffer.from('source'),'file.pdf')).needsOcr).toBe(true);
 });
 it('keeps markdown answer labels separate and repairs glued reread boundaries consistently',async()=>{
  vi.stubEnv('DOCLING_BASE_URL','http://127.0.0.1:5001');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',document:{md_content:'PHẦN III. TRẢ LỜI NGẮN\nCâu 1: Tổng?\n**Trả lời:** 4\n**Giải thích:** Cộng hai nhóm.Câu 2: Giá trị?\nĐáp án: 1/2'}}))));
  const read=await readWithDocling(Buffer.from('source'),'written.pdf');
  const parsed=parseExamCode(read.rawText);
  expect(parsed.questions).toHaveLength(2);expect(parsed.questions[0].acceptedAnswers).toEqual(['4']);
  expect(parsed.questions[0].stem).toBe('Tổng?');expect(parsed.questions[1].acceptedAnswers).toEqual(['1/2']);
  expect(read.chunks.some(chunk=>chunk.content.includes('**Trả lời:** 4'))).toBe(true);
 });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ user: vi.fn(), document: vi.fn() }));
vi.mock('@/server/auth', () => ({ requireUser: fixture.user }));
vi.mock('@/server/dal', () => ({ getOwnedDocument: fixture.document }));
import { GET } from '../apps/web/src/app/api/documents/[id]/export/route';
const context = { params: Promise.resolve({ id: 'private-document' }) };
beforeEach(() => {
  fixture.user.mockReset().mockResolvedValue({ id: 'owner' });
  fixture.document.mockReset().mockResolvedValue({ id: 'private-document', title: 'Đề cương lớp 8', revision: 1, rawText: 'PHẦN I. TRẮC NGHIỆM\nCâu 18: Ghép bảng\na) Cột một\nb) Cột hai\nA. 1-b\nB. 2-a\nC. 3-c\nD. 4-d\nĐáp án: B\nPHẦN IV. TỰ LUẬN\nCâu 20: Giải thích nguyên nhân.' });
});
describe('Private Exam-Parser-Pro export contract', () => {
  it('exports four-category JSON with preserved context and manual-review essay', async () => {
    const response = await GET(new Request('http://localhost/api/documents/private-document/export?format=exam-pro'), context);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Disposition')).toContain('.exam-pro.json');
    const data = await response.json();
    expect(data.format).toBe('studyforge.exam-parser-pro.v1');
    expect(data.questions.map((q: { type: string }) => q.type)).toEqual(['MULTIPLE_CHOICE', 'ESSAY']);
    expect(data.questions[0].question_stem).toContain('a) Cột một');
    expect(data.questions[0]).toMatchObject({ original_number: 'Câu 18', display_number: 1, correct_answer: 'B', answer_source: 'EXTRACTED', needs_review: true });
    expect(fixture.document).toHaveBeenCalledWith('owner', 'private-document');
  });
  it('does not query a private document without a session', async () => {
    fixture.user.mockRejectedValue({ code: 'UNAUTHORIZED' });
    const response = await GET(new Request('http://localhost/export?format=exam-pro'), context);
    expect(response.status).toBe(401); expect(fixture.document).not.toHaveBeenCalled();
  });
  it('keeps owner enforcement and existing JSON export shape', async () => {
    fixture.document.mockRejectedValueOnce({ code: 'NOT_FOUND' });
    expect((await GET(new Request('http://localhost/export?format=exam-pro'), context)).status).toBe(404);
    const legacy = await GET(new Request('http://localhost/export?format=json'), context);
    expect((await legacy.json()).format).toBe('studyforge.document.v1');
  });
});
import { describe, it, expect } from 'vitest';
import { parseExamCode, isSectionHeader, normalizeLine } from '../apps/web/src/components/lucian/CodeExamStudio';

describe('Azota Code Exam Parser', () => {
  it('normalizes non-breaking spaces and trims lines', () => {
    expect(normalizeLine('Câu 1:\u00A0Thành phần xương  ')).toBe('Câu 1: Thành phần xương');
  });

  it('correctly identifies section headers and document preambles', () => {
    expect(isSectionHeader('[!b:$I. TRẮC NGHIỆM$]')).toBe(true);
    expect(isSectionHeader('Câu 1. PHẦN SINH')).toBe(true);
    expect(isSectionHeader('Câu 2. Trắc nghiệm nhiều lựa chọn')).toBe(true);
    expect(isSectionHeader('II. Trắc nghiệm đúng sai:')).toBe(true);
    expect(isSectionHeader('III. Trắc nghiệm trả lời ngắn')).toBe(true);
    expect(isSectionHeader('IV. Tự luận:')).toBe(true);
    expect(isSectionHeader('ĐỀ CƯƠNG ÔN TẬP GIỮA HK 1')).toBe(true);
    expect(isSectionHeader('Câu 1: Cơ thể người gồm mấy phần?')).toBe(false);
  });

  it('parses standard multiple-choice questions with answers', () => {
    const raw = `
[!b:$I. TRẮC NGHIỆM$]
Câu 1: Xương gồm những chất nào?
A. Hữu cơ
B. Vô cơ
C. Hữu cơ và vô cơ
D. Không khoáng chất
Đáp án: C
`;
    const { questions, groups } = parseExamCode(raw);
    expect(groups).toContain('I. TRẮC NGHIỆM');
    expect(questions.length).toBe(1);
    expect(questions[0].number).toBe(1);
    expect(questions[0].type).toBe('single');
    expect(questions[0].options.length).toBe(4);
    expect(questions[0].correctOptionIds.length).toBe(1);
  });

  it('parses inline multiple options on a single line', () => {
    const raw = `
Câu 1: Cơ có hai tính chất cơ bản là:
A. co và dãn.    B. gấp và duỗi.    C. phồng và xẹp.    D. kéo và đẩy.
Đáp án: A
`;
    const { questions } = parseExamCode(raw);
    expect(questions.length).toBe(1);
    expect(questions[0].options.length).toBe(4);
    expect(questions[0].options[0].letter).toBe('A');
    expect(questions[0].options[1].letter).toBe('B');
  });

  it('correctly classifies short answer questions without options', () => {
    const raw = `
[!b:$III. Trắc nghiệm trả lời ngắn$]
Câu 1: 16g CuO.
Đáp án: 0.2 mol

Câu 2: Cơ thể người có mấy phần chính?
`;
    const { questions } = parseExamCode(raw);
    expect(questions.length).toBe(2);
    expect(questions[0].type).toBe('short');
    expect(questions[0].options.length).toBe(0);
    expect(questions[0].acceptedAnswers).toContain('0.2 mol');

    expect(questions[1].type).toBe('short');
    expect(questions[1].options.length).toBe(0);
  });

  it('assigns unique globalIndex across multiple sections that restart at Câu 1', () => {
    const raw = `
[!b:$PHẦN I$]
Câu 1: Hỏi 1
A. 1
B. 2
Đáp án: A

[!b:$PHẦN II$]
Câu 1: Hỏi 2
a) Đúng
b) Sai
Đáp án: a - Đ, b - S
`;
    const { questions } = parseExamCode(raw);
    expect(questions.length).toBe(2);
    expect(questions[0].globalIndex).toBe(1);
    expect(questions[0].number).toBe(1);
    expect(questions[1].globalIndex).toBe(2);
    expect(questions[1].number).toBe(1);
  });
});


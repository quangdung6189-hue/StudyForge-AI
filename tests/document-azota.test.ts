import { describe, expect, it } from 'vitest';
import { analyzeDocument } from '../apps/web/src/server/question-sections';

describe('Azota-style crammed layout reading', () => {
  it('splits A/B/C/D crammed on one visual row into separate options', () => {
    const text = `PHAN I. TRAC NGHIEM\nCau 1. 2 + 2 bang may?\nA. 1 B. 2 C. 3 D. 4\nDap an: D`;
    const result = analyzeDocument(text);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options).toEqual(['1', '2', '3', '4']);
    expect(result.questions[0].documentAnswer?.indices).toEqual([3]);
  });
  it('detects Dien tu blanks and short answers with Vietnamese phrasing', () => {
    const text = `PHAN II. DIEN TU\nCau 1. Dien tu thich hop: Ha Noi la (...) cua Viet Nam.\nDap an: thu do`;
    const result = analyzeDocument(text);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].type).toBe('fill');
    expect(result.questions[0].documentAnswer?.acceptedAnswers).toEqual(['thu do']);
  });
});
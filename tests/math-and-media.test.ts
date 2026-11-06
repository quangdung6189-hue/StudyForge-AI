import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { ommlToLatex, formatOmmlAsLatex } from '../apps/web/src/lib/omml-to-latex';
import { normalizeMathText, hasMathContent } from '../apps/web/src/lib/math-normalizer';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathText } from '../apps/web/src/components/common/MathText';

import { detectImageRefs, parseExamCode } from '../apps/web/src/lib/exam-code';

describe('OMML to LaTeX Conversion', () => {
  const parser = new DOMParser();

  it('converts fraction m:f to \\frac{num}{den}', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:f>
        <m:num><m:r><m:t>1</m:t></m:r></m:num>
        <m:den><m:r><m:t>2</m:t></m:r></m:den>
      </m:f>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toBe('$\\frac{1}{2}$');
  });

  it('converts superscript m:sSup to {base}^{sup}', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:r><m:t>Q = </m:t></m:r>
      <m:sSup>
        <m:e><m:r><m:t>L</m:t></m:r></m:e>
        <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
      </m:sSup>
      <m:r><m:t>m</m:t></m:r>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toBe('$Q = {L}^{2}m$');
  });

  it('converts square root m:rad to \\sqrt{base}', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:rad>
        <m:deg/>
        <m:e><m:r><m:t>3</m:t></m:r></m:e>
      </m:rad>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toBe('$\\sqrt{3}$');
  });

  it('converts parentheses delimiter m:d to \\left( ... \\right)', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:d>
        <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
        <m:e><m:r><m:t>x + y</m:t></m:r></m:e>
      </m:d>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toBe('$\\left(x + y\\right)$');
  });

  it('converts greek symbols and math operators', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:r><m:t>Δt × λ = Ω</m:t></m:r>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toContain('\\Delta');
    expect(result).toContain('\\times');
    expect(result).toContain('\\lambda');
    expect(result).toContain('\\Omega');
  });
});

describe('Math Normalizer', () => {
  it('normalizes Q = L^(2)m. to proper exponents', () => {
    const input = 'Q = L^(2)m.';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('L^{2}m');
    expect(normalized).toContain('$');
  });

  it('normalizes Q = Lm^(2). to proper exponents', () => {
    const input = 'Q = Lm^(2).';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('Lm^{2}');
  });

  it('normalizes scientific notation 10^(-3) to 10^{-3}', () => {
    const input = 'Giá trị là 5 * 10^(-3) m/s';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('10^{-3}');
  });

  it('preserves already wrapped LaTeX equations', () => {
    const input = 'Phương trình $E = mc^2$ và $Q = L^2 m$';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('$E = mc^2$');
    expect(normalized).toContain('$Q = L^2 m$');
  });

  it('detects math content correctly', () => {
    expect(hasMathContent('$x^2$')).toBe(true);
    expect(hasMathContent('Q = L^(2)m')).toBe(true);
    expect(hasMathContent('\\frac{1}{2}')).toBe(true);
    expect(hasMathContent('Thủ đô của Việt Nam là Hà Nội')).toBe(false);
  });
});

describe('Image Reference and Media Mapping', () => {
  it('maps [Hình 25] to mediaMap entry with sourceIndex 25 and src', () => {
    const mediaMap = { 25: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
    const stem = 'Một căn phòng có thể tích phần không gian bên trong là [Hình 25].';
    const detection = detectImageRefs(stem, [], '', mediaMap);

    expect(detection.hasImage).toBe(true);
    expect(detection.imageRefs).toHaveLength(1);
    expect(detection.imageRefs[0].placeholder).toBe('[Hình 25]');
    expect(detection.imageRefs[0].sourceIndex).toBe(25);
    expect(detection.imageRefs[0].src).toBe(mediaMap[25]);
  });

  it('integrates mediaMap into parseExamCode', () => {
    const mediaMap = { 1: 'data:image/png;base64,abc123' };
    const code = 'Câu 1: Cho sơ đồ mạch điện như [Hình 1].\nA. R1\n*B. R2\nĐáp án: B';
    const parsed = parseExamCode(code, mediaMap);

    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0].hasImage).toBe(true);
    expect(parsed.questions[0].imageRefs[0].src).toBe(mediaMap[1]);
  });

describe('MathText Component Live Rendering', () => {
  it('renders complex math formulas into KaTeX HTML', () => {
    // 1. Quadratic equation formula with square root and fraction
    const quadraticText = 'Nghiệm phương trình: $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$';
    const html1 = renderToStaticMarkup(React.createElement(MathText, { text: quadraticText }));
    expect(html1).toContain('class="katex"');
    expect(html1).toContain('sqrt');

    // 2. Integral formula
    const integralText = 'Tích phân: $\\int_{0}^{\\pi} \\sin(x) dx = 2$';
    const html2 = renderToStaticMarkup(React.createElement(MathText, { text: integralText }));
    expect(html2).toContain('class="katex"');
    expect(html2).toContain('int');

    // 3. Physics formula with greek letter and delta
    const physicsText = 'Nhiệt lượng: $Q = mc\\Delta t$ và $F = G\\frac{m_1 m_2}{r^2}$';
    const html3 = renderToStaticMarkup(React.createElement(MathText, { text: physicsText }));
    expect(html3).toContain('class="katex"');
    expect(html3).toContain('Delta');

    // 4. Pseudo math normalized automatically: Q = L^(2)m.
    const pseudoText = 'Phương án: Q = L^(2)m.';
    const html4 = renderToStaticMarkup(React.createElement(MathText, { text: pseudoText }));
    expect(html4).toContain('class="katex"');
  });

  it('renders real image thumbnail when [Hình 25] has mediaMap entry', () => {
    const text = 'Một căn phòng có thể tích phần không gian bên trong là [Hình 25].';
    const testImageSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageMap = { 25: testImageSrc };

    const html = renderToStaticMarkup(React.createElement(MathText, { text, imageMap }));

    // Verify the image tag is rendered with exact src and alt
    expect(html).toContain('<img');
    expect(html).toContain(`src="${testImageSrc}"`);
    expect(html).toContain('alt="[Hình 25]"');
    expect(html).toContain('Một căn phòng có thể tích phần không gian bên trong là');
  });

  it('renders placeholder badge when image is not yet in mediaMap', () => {
    const text = 'Xem sơ đồ tại [Hình 99] để trả lời.';
    const html = renderToStaticMarkup(React.createElement(MathText, { text }));

    expect(html).not.toContain('<img');
    expect(html).toContain('[Hình 99]');
    expect(html).toContain('math-image-tag');
  });

  it('preserves multi-line layout and spacing', () => {
    const multilineText = 'Dòng 1: Đề bài\n\nDòng 2: Nội dung dẫn\n\nA. Phương án 1';
    const html = renderToStaticMarkup(React.createElement(MathText, { text: multilineText }));

    expect(html).toContain('<br/>');
    expect(html).toContain('Dòng 1: Đề bài');
    expect(html).toContain('Dòng 2: Nội dung dẫn');
  });
});

});

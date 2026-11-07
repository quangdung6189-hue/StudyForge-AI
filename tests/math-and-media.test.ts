import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { ommlToLatex, formatOmmlAsLatex } from '../apps/web/src/lib/omml-to-latex';
import { normalizeMathText, hasMathContent } from '../apps/web/src/lib/math-normalizer';
import JSZip from 'jszip';
import { preprocessDocxMathAndImages } from '../apps/web/src/server/docx-preprocessor';
import { extractDocumentContent } from '../apps/web/src/server/extractor';

import { sanitizeExamText, isMathStar } from '../apps/web/src/lib/text-sanitizer';

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
  it('converts nuclear isotope m:sPre to {}^{235}_{92}U', () => {
    const xml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
      <m:sPre>
        <m:sub><m:r><m:t>92</m:t></m:r></m:sub>
        <m:sup><m:r><m:t>235</m:t></m:r></m:sup>
        <m:e><m:r><m:t>U</m:t></m:r></m:e>
      </m:sPre>
    </m:oMath>`;
    const doc = parser.parseFromString(xml, 'application/xml');
    const result = formatOmmlAsLatex(doc.documentElement);
    expect(result).toBe('${}^{235}_{92}{U}$');
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

  it('never swallows prose after equation or leaks formula boundary across sentences', () => {
    const input = 'Lấy g = 10 m/s^(2). Để lực từ do từ trường của Trái Đất tác dụng lên đoạn dây bằng 1% trọng lực';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('$g = 10 m/s^{2}$');
    expect(normalized).toContain('. Để lực từ do từ trường của Trái Đất tác dụng');
    expect(normalized).not.toContain('Đểlựctừ');
  });

  it('normalizes subscript comparison options V_(1) < V_(2)', () => {
    const input = 'A. V_(1) < V_(2).';
    const normalized = normalizeMathText(input);
    expect(normalized).toContain('$V_1 < V_2$');
  });


  it('detects math content correctly', () => {
    expect(hasMathContent('$x^2$')).toBe(true);
    expect(hasMathContent('Q = L^(2)m')).toBe(true);
    expect(hasMathContent('\\frac{1}{2}')).toBe(true);
    expect(hasMathContent('Thủ đô của Việt Nam là Hà Nội')).toBe(false);
  });

  it('normalizes physics vectors, Celsius degrees, Ohm and micro units', () => {
    // Vector
    const vecInput = 'Lực vec(F) tác dụng làm vật chuyển động';
    expect(normalizeMathText(vecInput)).toContain('\\vec{F}');

    // Degree Celsius
    const tempInput = 'Nhiệt độ sôi là 100 độ C hoặc 100°C';
    expect(normalizeMathText(tempInput)).toContain('100^\\circ\\text{C}');

    // Ohm
    const ohmInput = 'Điện trở R = 50 ôm';
    expect(normalizeMathText(ohmInput)).toContain('50\\ \\Omega');

    // Micro unit
    const capInput = 'Tụ điện C = 10 μF';
    expect(normalizeMathText(capInput)).toContain('10\\ \\mu\\text{F}');

    // Delta
    const deltaInput = 'Biến thiên nhiệt độ Δt = 15 K';
    expect(normalizeMathText(deltaInput)).toContain('\\Delta t');
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

describe('Text Sanitizer and Special Character Cleaning', () => {
  it('cleans Word private-use area Wingdings and Symbol bullets', () => {
    // 0xF0B7 is a bullet, 0xF0FC is a checkmark, 0xF0D8 is an arrow
    const dirty = 'Tiêu đề\uF0B7 Ý 1 \uF0FC Đúng \uF0D8 Tiếp theo';
    const cleaned = sanitizeExamText(dirty);
    expect(cleaned).toContain('•');
    expect(cleaned).toContain('✓');
    expect(cleaned).toContain('→');
    expect(cleaned).not.toContain('\uF0B7');
  });

  it('strips zero-width characters and soft hyphens', () => {
    const dirty = 'Từ\u200Bkhóa\uFEFF tiếng\u00AD Việt';
    const cleaned = sanitizeExamText(dirty);
    expect(cleaned).toBe('Từkhóa tiếng Việt');
  });

  it('distinguishes math multiplication star from answer option star', () => {
    expect(isMathStar('Tính 2 * 3 = 6', 7)).toBe(true);
    expect(isMathStar('*A. Đáp án A', 0)).toBe(false);
  });
});

describe('Option Images Isolation', () => {
  it('correctly assigns position=option for images inside choices A-D', () => {
    const code = `Câu 1: Quan sát các đồ thị sau:
A. [Hình 1]
B. [Hình 2]
C. [Hình 3]
D. [Hình 4]
Đáp án: A`;
    const parsed = parseExamCode(code, { 1: 'data:img1', 2: 'data:img2', 3: 'data:img3', 4: 'data:img4' });
    expect(parsed.questions).toHaveLength(1);
    const q = parsed.questions[0];

    // All 4 image refs must have position === 'option'
    expect(q.imageRefs).toHaveLength(4);
    expect(q.imageRefs.every(ref => ref.position === 'option')).toBe(true);

    // Stem should have NO stem images
    const stemImages = q.imageRefs.filter(ref => ref.position === 'stem');
    expect(stemImages).toHaveLength(0);
  });
});

describe('Diagram Axis Floating Text Cleaning', () => {
  it('strips diagram axis floating labels between question mark and options A-D', () => {
    const code = `Câu 13: Một khối khí lí tưởng biến đổi từ trạng thái (1) có thể tích V_(1) sang trạng thái (2) có thể tích V_(2). Đồ thị biểu diễn mối liên hệ giữa áp suất p và nhiệt độ tuyệt đối T được thể hiện trong hình vẽ bên. Biểu thức nào sau đây là đúng khi so sánh giá trị của V_(1) và V_(2)?
(1)
T
p
0
(2)
A. V_(1) < V_(2).
B. V_(1) = V_(2).
C. V_(1) = 2V_(2).
D. V_(1) > V_(2).
Đáp án: A`;
    const parsed = parseExamCode(code);
    expect(parsed.questions).toHaveLength(1);
    const q = parsed.questions[0];
    // Stem should NOT contain floating diagram labels (1), T, p, 0, (2)
    expect(q.stem).not.toContain('\n(1)');
    expect(q.stem).not.toContain('\nT\n');
    expect(q.stem).not.toContain('\np\n');
    expect(q.stem).not.toContain('\n0\n');
    expect(q.stem).not.toContain('\n(2)');
    expect(q.stem).toContain('so sánh giá trị của V_(1) và V_(2)?');
  });
});

describe('DOCX Math Preprocessor & Nuclear Isotope Extraction', () => {
  it('unwraps mc:AlternateContent, converts m:oMath to LaTeX, and strips fallback image', async () => {
    const zip = new JSZip();
    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:v="urn:schemas-microsoft-com:vml">
  <w:body>
    <w:p>
      <w:r><w:t>Hạt nhân </w:t></w:r>
      <mc:AlternateContent>
        <mc:Choice Requires="w14">
          <m:oMath>
            <m:sPre>
              <m:sub><m:r><m:t>92</m:t></m:r></m:sub>
              <m:sup><m:r><m:t>235</m:t></m:r></m:sup>
              <m:e><m:r><m:t>U</m:t></m:r></m:e>
            </m:sPre>
          </m:oMath>
        </mc:Choice>
        <mc:Fallback>
          <w:pict>
            <v:shape id="_x0000_i1025" type="#_x0000_t75">
              <v:imagedata r:id="rId6" o:title=""/>
            </v:shape>
          </w:pict>
        </mc:Fallback>
      </mc:AlternateContent>
      <w:r><w:t> có</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
    zip.file('word/document.xml', docXml);
    const rawBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const preprocessed = await preprocessDocxMathAndImages(rawBuffer);
    expect(preprocessed.convertedEquationCount).toBe(1);

    // Verify processed XML in zip
    const processedZip = await JSZip.loadAsync(preprocessed.buffer);
    const processedXml = await processedZip.file('word/document.xml')!.async('string');
    expect(processedXml).toContain('{}^{235}_{92}{U}');
    expect(processedXml).not.toContain('mc:Fallback');
    expect(processedXml).not.toContain('v:imagedata');
  });
});



import JSZip from 'jszip';
import { versionLayout } from '@studyforge/core';
import type { FullQuestionDTO } from '@studyforge/contracts';

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ' };
const mapChars = (text: string, table: Record<string, string>, mark: string) =>
  [...text].every(ch => table[ch]) ? [...text].map(ch => table[ch]).join('') : `${mark}(${text})`;

/** Readable plain text for Word from the KaTeX-flavoured source (formulas stay legible without an equation editor). */
export function plainMath(input: string): string {
  return input
    .replace(/\$\$?([^$]+)\$\$?/g, (_, body: string) => body)
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]*)\}/g, '$1')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\xrightarrow\{([^{}]*)\}/g, '→($1)')
    .replace(/\\(?:rightarrow|to|longrightarrow)/g, '→')
    .replace(/\\rightleftharpoons/g, '⇌')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\(?:uparrow)/g, '↑').replace(/\\downarrow/g, '↓')
    .replace(/\\circ/g, '°').replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\(?:le|leq)\b/g, '≤').replace(/\\(?:ge|geq)\b/g, '≥').replace(/\\neq\b/g, '≠').replace(/\\approx\b/g, '≈').replace(/\\pm\b/g, '±')
    .replace(/\\(alpha|beta|gamma|delta|Delta|lambda|mu|pi|omega|Omega|theta|rho|sigma)\b/g, (_, g: string) => ({ alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', lambda: 'λ', mu: 'μ', pi: 'π', omega: 'ω', Omega: 'Ω', theta: 'θ', rho: 'ρ', sigma: 'σ' })[g] ?? g)
    .replace(/_\{([^{}]*)\}|_([0-9a-z+-])/g, (_, a?: string, b?: string) => mapChars(a ?? b ?? '', SUB, '_'))
    .replace(/\^\{([^{}]*)\}|\^([0-9n+-])/g, (_, a?: string, b?: string) => mapChars(a ?? b ?? '', SUP, '^'))
    .replace(/\\,|\\;|\\!|\\ /g, ' ')
    .replace(/\\([{}%&#_])/g, '$1');
}

const xml = (text: string) => text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
type Run = { text: string; bold?: boolean; italic?: boolean; size?: number };
function para(runs: Run[] | string, options: { align?: 'center' | 'right'; spaceAfter?: number; indent?: number; keepNext?: boolean } = {}) {
  const list = typeof runs === 'string' ? [{ text: runs }] : runs;
  const ppr = `<w:pPr>${options.keepNext ? '<w:keepNext/>' : ''}<w:spacing w:after="${options.spaceAfter ?? 80}"/>${options.indent ? `<w:ind w:left="${options.indent}"/>` : ''}${options.align ? `<w:jc w:val="${options.align}"/>` : ''}</w:pPr>`;
  const body = list.map(run => {
    const rpr = `<w:rPr>${run.bold ? '<w:b/>' : ''}${run.italic ? '<w:i/>' : ''}${run.size ? `<w:sz w:val="${run.size}"/><w:szCs w:val="${run.size}"/>` : ''}</w:rPr>`;
    return plainMath(run.text).split('\n').map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${rpr}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');
  }).join('');
  return `<w:p>${ppr}${body}</w:p>`;
}
const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const L = (i: number) => String.fromCharCode(65 + i);

type Quiz = { id: string; title: string; durationMinutes: number; questions: FullQuestionDTO[] };

export async function buildExamDocx(quiz: Quiz, versions: number, includeKey: boolean): Promise<Buffer> {
  const body: string[] = [];
  const keys: { code: number; lines: string[] }[] = [];
  for (let v = 0; v < versions; v++) {
    const code = 101 + v;
    const layout = versionLayout(quiz.questions, quiz.id, v);
    if (v) body.push(pageBreak);
    body.push(
      para([{ text: quiz.title.toUpperCase(), bold: true, size: 28 }], { align: 'center', spaceAfter: 60 }),
      para([{ text: `Thời gian làm bài: ${quiz.durationMinutes >= 1440 ? 'không giới hạn' : `${quiz.durationMinutes} phút`} · ${quiz.questions.length} câu`, italic: true }], { align: 'center', spaceAfter: 60 }),
      para([{ text: `MÃ ĐỀ ${code}`, bold: true, size: 26 }], { align: 'right', spaceAfter: 120 }),
      para('Họ và tên: ................................................................   Lớp: .................   SBD: ..............', { spaceAfter: 200 }),
    );
    const key: string[] = [];
    layout.forEach((item, index) => {
      const q = item.question;
      body.push(para([{ text: `Câu ${index + 1}`, bold: true }, { text: ` (${q.points} điểm). ${q.stem}` }], { keepNext: true, spaceAfter: 60 }));
      if (q.type === 'single' || q.type === 'multiple') {
        item.options.forEach((o, i) => body.push(para([{ text: `${L(i)}. `, bold: true }, { text: o.text }], { indent: 360, spaceAfter: 40 })));
        key.push(`Câu ${index + 1}: ${item.options.map((o, i) => (q.correctOptionIds.includes(o.id) ? L(i) : '')).filter(Boolean).join(', ')}`);
      } else if (q.type === 'boolean') {
        body.push(para('☐ Đúng        ☐ Sai', { indent: 360 }));
        key.push(`Câu ${index + 1}: ${q.options.find(o => q.correctOptionIds.includes(o.id))?.text ?? ''}`);
      } else if (q.type === 'ordering') {
        body.push(para([{ text: 'Sắp xếp các mục sau theo thứ tự đúng:', italic: true }], { indent: 360, spaceAfter: 40 }));
        item.options.forEach((o, i) => body.push(para([{ text: `${L(i)}. `, bold: true }, { text: o.text }], { indent: 360, spaceAfter: 40 })));
        body.push(para('Thứ tự: ..........................................', { indent: 360 }));
        key.push(`Câu ${index + 1}: ${q.correctOptionIds.map(id => L(item.options.findIndex(o => o.id === id))).join(' – ')}`);
      } else if (q.type === 'matching') {
        body.push(para([{ text: 'Nối mỗi mục ở cột 1 với một mục ở cột 2:', italic: true }], { indent: 360, spaceAfter: 40 }));
        item.left.forEach((o, i) => body.push(para([{ text: `${i + 1}. `, bold: true }, { text: o.text }], { indent: 360, spaceAfter: 30 })));
        item.right.forEach((o, i) => body.push(para([{ text: `${String.fromCharCode(97 + i)}. `, bold: true }, { text: o.text }], { indent: 720, spaceAfter: 30 })));
        body.push(para('Ghép: 1 – ....   2 – ....   3 – ....   4 – ....', { indent: 360 }));
        key.push(`Câu ${index + 1}: ${(q.pairs ?? []).map(p => `${item.left.findIndex(o => o.id === p.leftId) + 1}-${String.fromCharCode(97 + item.right.findIndex(o => o.id === p.rightId))}`).join(', ')}`);
      } else {
        body.push(para('Trả lời: ........................................................................................', { indent: 360 }));
        key.push(`Câu ${index + 1}: ${q.acceptedAnswers.join(' / ')}`);
      }
    });
    body.push(para([{ text: '— HẾT —', bold: true }], { align: 'center' }));
    keys.push({ code, lines: key });
  }
  if (includeKey) {
    body.push(pageBreak, para([{ text: 'ĐÁP ÁN CÁC MÃ ĐỀ', bold: true, size: 28 }], { align: 'center', spaceAfter: 200 }));
    for (const k of keys) {
      body.push(para([{ text: `Mã đề ${k.code}`, bold: true, size: 26 }], { spaceAfter: 80, keepNext: true }));
      k.lines.forEach(line => body.push(para(line, { indent: 360, spaceAfter: 30 })));
    }
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.file('word/document.xml', document);
  zip.file('word/styles.xml', styles);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

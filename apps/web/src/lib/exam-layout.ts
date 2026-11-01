import type { QuestionType } from '@studyforge/contracts';

export type LayoutNotice = { code: string; message: string; requiresReview: boolean };
export const foldExamText = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase();
const answer = /^(?:Đáp án(?: đúng)?|Dap an|Đáp số|Trả lời|Tra loi|Answer|Lời giải|Giải thích(?: ngắn)?|Hướng dẫn giải|Ghi chú)\s*[:\-]/iu;

/** Layout-only repair. Never changes numbers, units, formulas, answers or source numbering. */
export function unglueExamText(value: string): { text: string; notices: LayoutNotice[] } {
  let text = value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
  const original = text;
  text = text.replace(/([^\s])(?=(?:Câu|Cau|Question|Bài)\s*\d+\s*[.:)]\s*)/gu, '$1\n');
  text = text.replace(/([^\s])(?=(?:PHẦN|PHAN|Phần)\s+[IVXABC\d]+(?:[.:)]|\s))/gu, '$1\n');
  text = text.replace(/([^\sIVX\n])(?=[IVX]+[.]\s*Trắc nghiệm)/gu, '$1\n');
  // Split option boundaries only where multiple explicit labels establish an option run.
  text = text.split('\n').map(line => {
    if (answer.test(line)) return line;
    const labels = [...line.matchAll(/\*?([A-H])[.)]\s+/g)];
    if (new Set(labels.map(label => label[1])).size < 2) return line;
    let next = line;
    for (let index = labels.length - 1; index >= 0; index--) {
      const offset = labels[index].index!;
      if (offset > 0 && !/[A-Z]/.test(line[offset - 1])) next = next.slice(0, offset).trimEnd() + '\n' + next.slice(offset);
    }
    return next;
  }).join('\n');
  return { text, notices: text === original ? [] : [{ code: 'BOUNDARIES_SPLIT', message: 'Đã tách ranh giới câu/phương án bị dính; giữ nguyên số câu và nội dung gốc.', requiresReview: false }] };
}

export type BottomUpLayout = { lines: string[]; kind?: QuestionType | 'essay'; notices: LayoutNotice[]; choiceFooter: boolean };

/** Inspect terminal answer alternatives before interpreting a/b lists or a section hint. */
export function bottomUpLayout(input: string[], section = '', explicitType?: QuestionType): BottomUpLayout {
  // Keep empty final table cells; trim() would turn a false-column X into a true-column X.
  const lines = input.map(line => line.replace(/^ +| +$/g, '')).filter(line => line.trim());
  const metaIndex = lines.findIndex((line, index) => index > 0 && answer.test(line));
  const body = lines.slice(0, metaIndex < 0 ? lines.length : metaIndex), tail = metaIndex < 0 ? [] : lines.slice(metaIndex);
  const notices: LayoutNotice[] = [];
  const heading = foldExamText(section);
  const labels = body.flatMap((line, index) => {
    const match = line.match(/^\*?([A-H])[.)]\s+(.+)$/u);
    return match ? [{ label: match[1], text: line, index }] : [];
  });
  if (labels.length && body.some(line => /^[A-H]\d[^\s]*$/u.test(line))) notices.push({ code: 'OCR_OPTION_LABEL_UNRESOLVED', message: 'Có dòng nghi lỗi OCR nhãn/số (ví dụ D15/0). Giữ nguyên nội dung, cần đối chiếu bản gốc; không tự bổ sung chữ số.', requiresReview: true });
  // Last option block: prose before it (including matching tables and a/b lists) stays stem.
  let footer = labels;
  const lastA = labels.map(label => label.label).lastIndexOf('A');
  if (lastA >= 0) footer = labels.slice(lastA);
  const unique = new Set(footer.map(label => label.label));
  const complete = unique.size >= 4 && ['A', 'B', 'C', 'D'].every(label => unique.has(label)) && unique.size === footer.length;
  const missingA = footer.length === 3 && ['B', 'C', 'D'].every(label => unique.has(label));
  if (complete || missingA && footer[0].index >= 2) {
    let start = footer[0].index;
    if (missingA) {
      start--;
      footer = [{ label: 'A', text: `A. ${body[start]}`, index: start }, ...footer];
      notices.push({ code: 'INFERRED_OPTION_LABEL', message: 'Khôi phục nhãn A bị thiếu theo cụm B–D; cần đối chiếu bản gốc.', requiresReview: true });
    }
    const entries = footer.map((label, index) => ({ label: label.label, content: [label.text, ...body.slice(label.index + 1, footer[index + 1]?.index ?? body.length)].join('\n') }));
    const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label));
    if (entries.map(entry => entry.label).join() !== sorted.map(entry => entry.label).join()) notices.push({ code: 'OPTIONS_REORDERED', message: 'Đã xếp phương án theo nhãn A–D, giữ nguyên nội dung và đáp án theo nhãn.', requiresReview: false });
    if (/dung\s*[/–-]?\s*sai|tra loi ngan|tu luan|dien tu/.test(heading)) notices.push({ code: 'FOOTER_OVERRIDES_SECTION', message: 'Cụm phương án lựa chọn cuối câu được ưu tiên hơn tiêu đề phần.', requiresReview: false });
    const kind = explicitType === 'multiple' || /chon nhieu|nhieu dap an/.test(heading) ? 'multiple' : 'single';
    if (explicitType && !['single', 'multiple'].includes(explicitType)) notices.push({ code: 'TYPE_LAYOUT_CONFLICT', message: 'Dạng khai báo không khớp cụm A–D cuối câu; cần kiểm tra.', requiresReview: true });
    return { lines: [...body.slice(0, start), ...sorted.map(entry => entry.content), ...tail], kind, notices, choiceFooter: true };
  }
  // Lost option labels: use a strict section + lead + four independent short lines.
  if (/trac nghiem.*(?:nhieu lua chon|khach quan)|multiple choice/.test(heading) && !labels.length && body.length >= 5) {
    const candidates = body.slice(-4);
    if (candidates.every(line => line.length <= 200 && !/[?]$/.test(line) && !/^(?:[a-h][.)]|\d+[.)-]|\[)/i.test(line))) {
      notices.push({ code: 'INFERRED_FOUR_OPTIONS', message: 'Bốn dòng cuối có thể là phương án mất nhãn; đã gợi ý A–D, cần xác minh.', requiresReview: true });
      return { lines: [...body.slice(0, -4), ...candidates.map((line, index) => `${String.fromCharCode(65 + index)}. ${line}`), ...tail], kind: 'single', notices, choiceFooter: true };
    }
  }
  if (/tu luan/.test(heading) && !/tra loi ngan|tu luan ngan/.test(heading)) return { lines, kind: 'essay', notices, choiceFooter: false };
  if (!labels.length && /^(?:trinh bay|giai thich|neu bien phap|de xuat bien phap|chung minh|phan tich|viet.*giai thich)/.test(foldExamText(body[0] ?? '').replace(/^\[[^\]]+\]\s*/g, ''))) return { lines, kind: 'essay', notices, choiceFooter: false };
  const tableHeader = body.findIndex(line => /(?:^|\t)\s*ĐÚNG\s*\t\s*SAI\s*$/iu.test(line));
  if (tableHeader >= 0) {
    const rows = body.slice(tableHeader + 1).map(line => line.split('\t'));
    if (rows.length && rows.length <= 8 && rows.every(cells => cells.length === 3 && cells[0].trim())) {
      let invalid = false;
      const statements = rows.map((cells, index) => {
        const label = cells[0].trim().match(/^([a-h])[.)]\s+/i)?.[1].toLowerCase() ?? String.fromCharCode(97 + index);
        const statement = cells[0].trim().replace(/^(?:[a-h]|\d+)[.)-]\s+/i, '');
        const marks = cells.slice(1).map(cell => cell.trim());
        if (marks.some(mark => mark && !/^(?:x|✓|✔)$/iu.test(mark)) || marks.every(Boolean)) invalid = true;
        const verdict = marks.every(mark => !mark) || marks.every(Boolean) ? '' : marks[0] ? ' ĐÚNG' : ' SAI';
        return `${label}) ${statement}${verdict}`;
      });
      if (invalid) notices.push({ code: 'INVALID_VERDICT_TABLE', message: 'Bảng Đúng/Sai có ô đánh dấu mâu thuẫn hoặc không hợp lệ.', requiresReview: true });
      return { lines: [body.slice(0, tableHeader).join('\n') || 'Xác định tính đúng sai của các nhận định.', ...statements, ...tail], kind: 'boolean', notices, choiceFooter: false };
    }
    notices.push({ code: 'UNRESOLVED_VERDICT_TABLE', message: 'Chưa đọc đủ cột/nhận định trong bảng Đúng/Sai; cần đối chiếu file gốc.', requiresReview: true });
    return { lines, kind: 'boolean', notices, choiceFooter: false };
  }
  if (/dung\s*[/–-]?\s*sai/.test(heading) || body.slice(1).some(line => /^[a-h][)]\s+/u.test(line))) {
    if (!body.slice(1).some(line => /^\*?[a-hA-H][.)]\s+/u.test(line))) {
      if (body.length === 1) return { lines: ['Xác định nhận định đúng hay sai.', `a) ${body[0]}`, ...tail.map(line => line.replace(/^(Đáp án|Trả lời)\s*:\s*(Đúng|Sai|Đ|S)\s*$/iu, '$1: a - $2'))], kind: 'boolean', notices, choiceFooter: false };
      const numeric = body.slice(1).every(line => /^\d+[.)-]\s+/.test(line));
      if (numeric || /phat bieu nao dung.*phat bieu nao sai|tinh dung.*sai|nhan dinh.*dung.*sai/.test(foldExamText(body[0]))) {
        if (body.length - 1 > 8) return { lines, kind: 'boolean', notices: [...notices, { code: 'UNRESOLVED_STATEMENTS', message: 'Quá nhiều dòng nhận định để phục hồi nhãn an toàn; cần kiểm tra.', requiresReview: true }], choiceFooter: false };
        notices.push({ code: 'INFERRED_STATEMENT_LABELS', message: 'Gợi ý nhãn nhận định từ danh sách/bảng; cần xác minh thứ tự.', requiresReview: true });
        return { lines: [body[0], ...body.slice(1).map((line, index) => `${String.fromCharCode(97 + index)}) ${numeric ? line.replace(/^\d+[.)-]\s+/, '') : line}`), ...tail], kind: 'boolean', notices, choiceFooter: false };
      }
    }
    return { lines, kind: 'boolean', notices, choiceFooter: false };
  }
  if (/tra loi ngan|tu luan ngan/.test(heading) || !labels.length && /bao nhieu|gom may|co may|ten goi|thuat ngu|qua trinh nao|tinh\s|dem\s/.test(foldExamText(body[0] ?? ''))) return { lines, kind: 'short', notices, choiceFooter: false };
  return { lines, notices, choiceFooter: false };
}
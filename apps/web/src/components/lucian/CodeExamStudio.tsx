'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@animate-ui/react/utils/motion';
import type { FullQuestionDTO, QuestionType } from '@studyforge/contracts';
import './code-exam-studio.css';

export type ParsedOption = {
  id: string;
  letter: string;
  text: string;
};

export type ParsedQuestion = {
  id: string;
  globalIndex: number;
  number: number;
  stem: string;
  group?: string;
  type: QuestionType;
  options: ParsedOption[];
  correctOptionIds: string[];
  acceptedAnswers: string[];
  points: number;
};

const SAMPLE_TEMPLATES: Record<string, { label: string; text: string }> = {
  sample1: {
    label: 'Mẫu 1: Trắc nghiệm chuẩn',
    text: `[!b:$I. TRẮC NGHIỆM NHIỀU LỰA CHỌN$]
Câu 1: Thành phần cấu tạo của xương gồm những chất nào?
A. Chủ yếu là chất hữu cơ (cốt giao)
B. Chủ yếu là chất vô cơ (muối khoáng)
C. Chất hữu cơ (cốt giao) và chất vô cơ (muối khoáng)
D. Không chứa khoáng chất
Đáp án: C

Câu 2: Cơ có hai tính chất cơ bản, đó là:
A. co và dãn.
B. gấp và duỗi.
C. phồng và xẹp.
D. kéo và đẩy.
Đáp án: A`,
  },
  sample2: {
    label: 'Mẫu 2: Phương án trên 1 dòng',
    text: `[!b:$I. TRẮC NGHIỆM NHANH$]
Câu 1: Thủ đô của Việt Nam là thành phố nào?
A. TP. Hồ Chí Minh    B. Hà Nội    C. Đà Nẵng    D. Cần Thơ
Đáp án: B

Câu 2: Số nguyên tố chẵn duy nhất là số mấy?
A. 0    B. 1    C. 2    D. 4
Đáp án: C`,
  },
  sample3: {
    label: 'Mẫu 3: Điền từ & Tự luận ngắn',
    text: `[!b:$II. ĐIỀN TỪ VÀ TRẢ LỜI NGẮN$]
Câu 1: Điền từ thích hợp vào chỗ trống: Quá trình quang hợp ở thực vật diễn ra chủ yếu tại bào quan (...).
Đáp án: lục lạp

Câu 2: Đơn vị đo cường độ dòng điện trong hệ SI là gì?
Đáp án: Ampe`,
  },
  sample4: {
    label: 'Mẫu 4: Nhiều đáp án đúng',
    text: `[!b:$III. TRẮC NGHIỆM CHỌN NHIỀU ĐÁP ÁN$]
Câu 1: Những số nào sau đây là số nguyên tố?
A. 2
B. 4
C. 5
D. 9
E. 7
Đáp án: A, C, E`,
  },
  sample5: {
    label: 'Mẫu 5: Câu hỏi Đúng - Sai',
    text: `[!b:$IV. CÂU HỎI ĐÚNG / SAI$]
Câu 1: Xét tính đúng hoặc sai của các nhận định sau về ADN:
a) ADN có cấu trúc xoắn kép gồm hai chuỗi pôlinuclêôtit.
b) Đơn phân cấu tạo nên ADN gồm 4 loại A, U, G, X.
c) Hai chuỗi nuclêôtit liên kết với nhau bằng các liên kết hiđrô.
d) Ở sinh vật nhân thực, ADN chỉ tồn tại trong nhân tế bào.
Đáp án: a - Đ, b - S, c - Đ, d - S`,
  },
  sample6: {
    label: 'Mẫu 6: Đề tổng hợp Bộ GD&ĐT 2025/2026',
    text: `[!b:$PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU LỰA CHỌN$]
Câu 1: Cơ thể người được chia làm mấy phần chính?
A. 2 phần: đầu và thân
B. 3 phần: đầu, thân và các chi
C. 4 phần: đầu, cổ, thân và chi
D. 3 phần: đầu, ngực và bụng
Đáp án: B

Câu 2: Bào quan nào sau đây đóng vai trò sản xuất năng lượng ATP chính của tế bào?
A. Ribôxôm    B. Ti thể    C. Bộ máy Golgi    D. Lưới nội chất
Đáp án: B

[!b:$PHẦN II. CÂU HỎI ĐÚNG / SAI$]
Câu 1: Mỗi nhận định sau về hệ tuần hoàn là Đúng hay Sai?
a) Tim người gồm 4 ngăn: 2 tâm thất và 2 tâm nhĩ.
b) Máu trong động mạch luôn luôn là máu đỏ tươi.
Đáp án: a - Đ, b - S

[!b:$PHẦN III. CÂU HỎI TRẢ LỜI NGẮN$]
Câu 1: Số lượng nhiễm sắc thể trong tế bào sinh dưỡng bình thường của người là bao nhiêu?
Đáp án: 46`,
  },
};

/** Normalize string: replace non-breaking spaces \u00A0 and trim */
export function normalizeLine(str: string): string {
  return (str || '').replace(/\u00A0/g, ' ').trim();
}

/** Checks if a line is a section/group title or document header, NOT a question stem */
export function isSectionHeader(line: string): boolean {
  const norm = normalizeLine(line);
  if (!norm) return false;
  if (/^\[!b:\$(.*?)\$\]/i.test(norm)) return true;
  if (/^(?:Câu\s*\d+[\.:\s]+)?(?:PHẦN|Phần|MỤC|Mục|CHỦ ĐỀ|Chủ đề|CHƯƠNG|Chương)\s+.*$/i.test(norm)) return true;
  if (/^(?:Câu\s*\d+[\.:\s]+)?(?:[IVXLCDM]+[\.:\s\-]+)?(?:TRẮC NGHIỆM|TỰ LUẬN|ĐÚNG SAI|ĐIỀN TỪ|TRẢ LỜI NGẮN|NHIỀU LỰA CHỌN).*$/i.test(norm)) return true;
  if (/^(?:TRƯỜNG|UBND|PHÒNG GD|ĐỀ CƯƠNG|KIỂM TRA|BẢNG ĐÁP ÁN|HƯỚNG DẪN CHẤM)/i.test(norm)) return true;
  return false;
}

/** Robust parser for Azota-style raw exam code */
export function parseExamCode(code: string): { questions: ParsedQuestion[]; groups: string[] } {
  const lines = code.split(/\r?\n/);
  const questions: ParsedQuestion[] = [];
  const groups: string[] = [];
  let currentGroup = '';

  let currentQ: {
    number: number;
    stemLines: string[];
    rawLines: string[];
    options: ParsedOption[];
    correctLetters: string[];
    acceptedAnswers: string[];
    type: QuestionType;
    points: number;
  } | null = null;

  const flush = () => {
    if (currentQ && (currentQ.stemLines.length > 0 || currentQ.options.length > 0)) {
      const stem = currentQ.stemLines.join('\n').trim();
      // Discard empty ghost questions
      if (!stem && currentQ.options.length === 0) {
        currentQ = null;
        return;
      }

      let type: QuestionType = currentQ.type;

      if (currentQ.options.length === 0) {
        // Questions without options: classify as 'fill' if contains blanks, else 'short' (essay/calculation)
        if (stem.includes('(…)') || stem.includes('...') || stem.includes('___')) {
          type = 'fill';
        } else {
          type = 'short';
        }
      } else {
        if (currentQ.correctLetters.length > 1) {
          type = 'multiple';
        } else if (currentQ.options.every(o => ['a', 'b', 'c', 'd'].includes(o.letter.toLowerCase()))) {
          if (currentQ.options.some(o => /^(đúng|sai|đ|s)$/i.test(o.text))) {
            type = 'boolean';
          }
        }
      }

      const correctOptionIds = currentQ.options
        .filter(o => currentQ!.correctLetters.includes(o.letter.toUpperCase()))
        .map(o => o.id);

      questions.push({
        id: crypto.randomUUID(),
        globalIndex: questions.length + 1,
        number: currentQ.number,
        stem,
        group: currentGroup || undefined,
        type,
        options: currentQ.options,
        correctOptionIds,
        acceptedAnswers: currentQ.acceptedAnswers,
        points: currentQ.points,
      });
    }
    currentQ = null;
  };

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) continue;

    // 1. Check for Group / Section Header
    if (isSectionHeader(line)) {
      flush();
      const extracted = line.replace(/^\[!b:\$|\$\]$/g, '').trim();
      currentGroup = extracted;
      if (!groups.includes(currentGroup)) groups.push(currentGroup);
      continue;
    }

    // 2. Question header strictly matching: Câu \d+, Question \d+, Bài \d+
    const qMatch = line.match(/^(?:Câu|Question|Câu hỏi|Bài)\s*(\d+)[:\.]?\s*(.*)$/i);
    if (qMatch) {
      flush();
      const num = parseInt(qMatch[1], 10) || (questions.length + 1);
      const rest = normalizeLine(qMatch[2] || '');

      let points = 1;
      let cleanStem = rest;
      const ptMatch = rest.match(/\[(\d+(?:\.\d+)?)\s*(?:điểm|đ)\]/i);
      if (ptMatch) {
        points = parseFloat(ptMatch[1]) || 1;
        cleanStem = rest.replace(ptMatch[0], '').trim();
      }

      currentQ = {
        number: num,
        stemLines: cleanStem ? [cleanStem] : [],
        rawLines: [rawLine],
        options: [],
        correctLetters: [],
        acceptedAnswers: [],
        type: 'single',
        points,
      };
      continue;
    }

    if (!currentQ) continue;
    currentQ.rawLines.push(rawLine);

    // 3. Answer line: Đáp án: A or Đáp án: A, B or Đáp án: lá cây
    const ansMatch = line.match(/^(?:Đáp án|Answer|Đáp án đúng)[:\-]\s*(.+)$/i);
    if (ansMatch) {
      const ansVal = ansMatch[1].trim();
      const letters = ansVal.match(/\b([A-F])\b/gi);
      if (letters && currentQ.options.length > 0) {
        currentQ.correctLetters = letters.map(l => l.toUpperCase());
      } else if (/^[a-d]\s*[\-:]\s*[đs]/i.test(ansVal)) {
        currentQ.type = 'boolean';
        const parts = ansVal.split(/[,;]/);
        for (const p of parts) {
          const m = p.trim().match(/^([a-d])\s*[\-:]\s*([đs])/i);
          if (m) {
            const optLetter = m[1].toUpperCase();
            const isTrue = /^[đd]$/i.test(m[2]);
            if (isTrue) currentQ.correctLetters.push(optLetter);
          }
        }
      } else {
        currentQ.acceptedAnswers = [ansVal];
      }
      continue;
    }

    // 4. Multiple options on same visual line: A. ... B. ... C. ... D. ...
    const inlineOptions = Array.from(line.matchAll(/(?:^|\s+)([A-F])[\.\)]\s+(.*?)(?=(?:\s+[A-F][\.\)]\s+)|$)/gi));
    if (inlineOptions.length > 1) {
      for (const opt of inlineOptions) {
        const letter = opt[1].toUpperCase();
        const text = opt[2].trim();
        const optId = crypto.randomUUID();
        currentQ.options.push({ id: optId, letter, text });
      }
      continue;
    }

    // 5. Single option per line: A. ... or a) ...
    const optMatch = line.match(/^([A-F])[\.\)]\s+(.+)$/i) ||
                     line.match(/^\(([A-F])\)\s+(.+)$/i) ||
                     line.match(/^\[([A-F])\]\s+(.+)$/i) ||
                     line.match(/^([a-d])\)\s+(.+)$/i);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const text = optMatch[2].trim();
      const optId = crypto.randomUUID();
      currentQ.options.push({ id: optId, letter, text });
      continue;
    }

    // 6. Checkbox options: [x] text or [ ] text
    const cbMatch = line.match(/^\[\s*([xX]?)\s*\]\s+(.+)$/i);
    if (cbMatch) {
      const isChecked = !!cbMatch[1];
      const letter = String.fromCharCode(65 + currentQ.options.length);
      const text = cbMatch[2].trim();
      const optId = crypto.randomUUID();
      currentQ.options.push({ id: optId, letter, text });
      if (isChecked) {
        currentQ.correctLetters.push(letter);
        currentQ.type = 'multiple';
      }
      continue;
    }

    // 7. Otherwise, question stem continuation
    if (currentQ.options.length === 0) {
      currentQ.stemLines.push(line);
    }
  }

  flush();
  return { questions, groups };
}

/** Mutates the code for a specific question based on its 1-indexed global position */
function mutateQuestionBlock(
  prevCode: string,
  targetGlobalIndex: number,
  updater: (block: string) => string
): string {
  const lines = prevCode.split(/\r?\n/);
  const qLineIndices: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = normalizeLine(lines[i]);
    if (isSectionHeader(l)) continue;
    if (/^(?:Câu|Question|Câu hỏi|Bài)\s*\d+[:\.]?/i.test(l)) {
      qLineIndices.push(i);
    }
  }

  const targetIdx = targetGlobalIndex - 1;
  if (targetIdx < 0 || targetIdx >= qLineIndices.length) return prevCode;

  const startLine = qLineIndices[targetIdx];
  const endLine = targetIdx + 1 < qLineIndices.length ? qLineIndices[targetIdx + 1] : lines.length;

  const questionLines = lines.slice(startLine, endLine);
  const block = questionLines.join('\n');
  const updatedBlock = updater(block);

  const updatedLines = [
    ...lines.slice(0, startLine),
    updatedBlock,
    ...lines.slice(endLine),
  ];

  return updatedLines.join('\n');
}

interface CodeExamStudioProps {
  initialCode?: string;
  documentText?: string;
  documentTitle?: string;
  title: string;
  setTitle: (t: string) => void;
  minutes: number;
  setMinutes: (m: number) => void;
  onApply: (questions: FullQuestionDTO[]) => void;
  onBack?: () => void;
}

export function CodeExamStudio({
  initialCode,
  documentText,
  documentTitle,
  title,
  setTitle,
  minutes,
  setMinutes,
  onApply,
  onBack,
}: CodeExamStudioProps) {
  const [code, setCode] = useState<string>(() => {
    return initialCode || documentText || SAMPLE_TEMPLATES.sample1.text;
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'answered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpNum, setJumpNum] = useState<number>(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [splitPreset, setSplitPreset] = useState<'balanced' | 'cards' | 'code'>('balanced');
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'syncing'>('saved');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Parse code on changes
  const { questions, groups } = useMemo(() => parseExamCode(code), [code]);

  // Sync indicator debounced
  useEffect(() => {
    setSyncStatus('syncing');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus('saved');
    }, 450);
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [code]);

  // Sync line numbers on scroll
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const lineCount = useMemo(() => code.split('\n').length, [code]);
  const wordCount = useMemo(() => code.trim().split(/\s+/).filter(Boolean).length, [code]);

  // Answer status counts
  const answeredCount = useMemo(() => {
    return questions.filter(q => q.correctOptionIds.length > 0 || q.acceptedAnswers.length > 0).length;
  }, [questions]);

  const missingCount = useMemo(() => {
    return questions.length - answeredCount;
  }, [questions.length, answeredCount]);

  // Interactive toggle answer on option [A], [B], [C], [D]
  const handleToggleAnswer = (globalIndex: number, letter: string, isMulti: boolean) => {
    setCode(prevCode => {
      return mutateQuestionBlock(prevCode, globalIndex, block => {
        const ansRegex = /^((?:Đáp án|Đáp án đúng|Answer)[:\-]\s*)(.*)$/im;
        const match = block.match(ansRegex);

        if (!match) {
          return `${block.trimEnd()}\nĐáp án: ${letter}\n`;
        }

        const currentAns = match[2].trim();
        if (isMulti) {
          const letters: string[] = Array.from(currentAns.match(/\b[A-F]\b/gi) || []);
          const upper = letter.toUpperCase();
          let nextLetters: string[];
          if (letters.includes(upper)) {
            nextLetters = letters.filter(l => l.toUpperCase() !== upper);
          } else {
            nextLetters = [...letters, upper].sort();
          }
          const nextVal = nextLetters.join(', ');
          return block.replace(ansRegex, nextVal ? `Đáp án: ${nextVal}` : '');
        } else {
          return block.replace(ansRegex, `Đáp án: ${letter}`);
        }
      });
    });
  };

  // Update short answer / fill text from visual card
  const handleUpdateTextAnswer = (globalIndex: number, newText: string) => {
    setCode(prevCode => {
      return mutateQuestionBlock(prevCode, globalIndex, block => {
        const ansRegex = /^((?:Đáp án|Đáp án đúng|Answer)[:\-]\s*)(.*)$/im;
        if (block.match(ansRegex)) {
          return block.replace(ansRegex, `Đáp án: ${newText}`);
        } else {
          return `${block.trimEnd()}\nĐáp án: ${newText}\n`;
        }
      });
    });
  };

  // Change question type directly from card dropdown
  const handleChangeQuestionType = (globalIndex: number, newType: QuestionType) => {
    setCode(prevCode => {
      return mutateQuestionBlock(prevCode, globalIndex, block => {
        const hasOptions = /^[A-F][\.\)]\s+/im.test(block) || /^[a-d]\)\s+/im.test(block);

        if (newType === 'boolean') {
          if (!hasOptions) {
            return `${block.trimEnd()}\na) Mệnh đề nhận định a\nb) Mệnh đề nhận định b\nc) Mệnh đề nhận định c\nd) Mệnh đề nhận định d\nĐáp án: a - Đ, b - S, c - Đ, d - S\n`;
          }
        } else if (newType === 'single' || newType === 'multiple') {
          if (!hasOptions) {
            return `${block.trimEnd()}\nA. Phương án A\nB. Phương án B\nC. Phương án C\nD. Phương án D\nĐáp án: A\n`;
          }
        }
        return block;
      });
    });
  };

  // Add options A, B, C, D to a question that currently has no options
  const handleAddOptions = (globalIndex: number) => {
    setCode(prevCode => {
      return mutateQuestionBlock(prevCode, globalIndex, block => {
        return `${block.trimEnd()}\nA. Phương án A\nB. Phương án B\nC. Phương án C\nD. Phương án D\nĐáp án: A\n`;
      });
    });
  };

  // Delete a specific question completely
  const handleDeleteQuestion = (globalIndex: number) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Câu #${globalIndex}?`)) return;
    setCode(prevCode => {
      return mutateQuestionBlock(prevCode, globalIndex, () => '');
    });
  };

  // Divide 10.0 points equally across all questions
  const handleDividePoints = () => {
    if (!questions.length) return;
    const ptPerQ = (10 / questions.length).toFixed(2);
    let updated = code;
    for (const q of questions) {
      const regex = new RegExp(`((?:Câu|Question|Câu hỏi|Bài)\\s*${q.number}[:\\.]?)(?:\\s*\\[\\d+(?:\\.\\d+)?\\s*(?:điểm|đ)\\])?`, 'i');
      updated = updated.replace(regex, `$1 [${ptPerQ}đ]`);
    }
    setCode(updated);
  };

  // Add new question template to end of editor
  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const template = `\n\nCâu ${nextNum}: Tiêu đề câu hỏi mới\nA. Phương án 1\nB. Phương án 2\nC. Phương án 3\nD. Phương án 4\nĐáp án: A`;
    setCode(prev => prev + template);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  };

  // Insert LaTeX formula
  const handleInsertFormula = () => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const formula = '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$';
    const newText = text.substring(0, start) + formula + text.substring(end);
    setCode(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formula.length, start + formula.length);
    }, 10);
  };

  // Jump to specific card by globalIndex or question number
  const handleJump = () => {
    const targetQ = questions.find(q => q.globalIndex === jumpNum || q.number === jumpNum);
    if (!targetQ) {
      alert(`Không tìm thấy câu hỏi ${jumpNum}. Vui lòng nhập từ 1 đến ${questions.length}.`);
      return;
    }
    const target = document.getElementById(`studio-card-q-${targetQ.globalIndex}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.style.borderColor = 'var(--ux-accent)';
      target.style.boxShadow = '0 0 0 4px var(--ux-accent-soft)';
      setTimeout(() => {
        target.style.borderColor = '';
        target.style.boxShadow = '';
      }, 1800);
    }
  };

  // Copy code to clipboard with Lucian #008 morph
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      alert('Không thể sao chép văn bản.');
    }
  };

  // Beautify / format code
  const handleBeautify = () => {
    if (!questions.length) return;
    let formatted = '';
    let lastGroup = '';

    for (const q of questions) {
      if (q.group && q.group !== lastGroup) {
        formatted += `[!b:$${q.group}$]\n\n`;
        lastGroup = q.group;
      }

      formatted += `Câu ${q.number}: ${q.stem}\n`;
      for (const opt of q.options) {
        formatted += `${opt.letter}. ${opt.text}\n`;
      }

      if (q.correctOptionIds.length > 0) {
        const correctLetters = q.options
          .filter(o => q.correctOptionIds.includes(o.id))
          .map(o => o.letter)
          .join(', ');
        formatted += `Đáp án: ${correctLetters}\n\n`;
      } else if (q.acceptedAnswers.length > 0) {
        formatted += `Đáp án: ${q.acceptedAnswers.join(' / ')}\n\n`;
      } else {
        formatted += `\n`;
      }
    }

    setCode(formatted.trim());
  };

  // Complete and submit to wizard Step 2
  const handleFinish = () => {
    if (!questions.length) {
      alert('Chưa nhận diện được câu hỏi nào. Vui lòng nhập hoặc chọn mẫu đề thi.');
      return;
    }

    const dtoList: FullQuestionDTO[] = questions.map(q => {
      const options = q.options.map(opt => ({
        id: opt.id,
        text: opt.text,
      }));

      let correctIds = q.correctOptionIds;
      if (options.length > 0 && correctIds.length === 0 && q.acceptedAnswers.length === 0) {
        correctIds = [options[0].id];
      }

      return {
        id: crypto.randomUUID(),
        type: q.type,
        stem: q.stem || `Câu hỏi ${q.number}`,
        options,
        correctOptionIds: correctIds,
        acceptedAnswers: q.acceptedAnswers,
        explanation: 'Đáp án được biên soạn trực tiếp qua mã đề thi.',
        points: q.points || 1,
        difficulty: 'comprehension',
        topic: q.group || documentTitle || 'Đề kiểm tra',
        answerOrigin: 'teacher' as const,
        reviewed: true,
        sourceRefs: [],
      };
    });

    onApply(dtoList);
  };

  // Filtered list of questions based on search query, group, and answered status
  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return questions.filter(q => {
      if (selectedGroup !== 'all' && q.group !== selectedGroup) return false;
      const isAnswered = q.correctOptionIds.length > 0 || q.acceptedAnswers.length > 0;
      if (statusFilter === 'answered' && !isAnswered) return false;
      if (statusFilter === 'missing' && isAnswered) return false;
      if (query) {
        const matchStem = q.stem.toLowerCase().includes(query);
        const matchOpt = q.options.some(o => o.text.toLowerCase().includes(query));
        const matchNum = String(q.number).includes(query) || String(q.globalIndex).includes(query);
        if (!matchStem && !matchOpt && !matchNum) return false;
      }
      return true;
    });
  }, [questions, selectedGroup, statusFilter, searchQuery]);

  return (
    <div className={`code-studio ${isFullScreen ? 'is-fullscreen' : ''} split-${splitPreset}`}>
      {/* Top Pro Control Toolbar */}
      <div className="code-studio-topbar">
        <div className="code-studio-meta">
          <div className="code-studio-title-box">
            <span style={{ fontSize: 13, color: 'var(--ux-accent)', flex: 'none' }}>✏️ Tên đề:</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề bài kiểm tra..."
              maxLength={200}
            />
          </div>

          <div className="code-studio-time-box">
            <span>⏱️ Thời gian:</span>
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={e => setMinutes(parseInt(e.target.value, 10) || 15)}
            />
            <span>phút</span>
          </div>

          {/* Diagnostic Answer Progress Meter */}
          <div className={`code-studio-meter ${missingCount === 0 && questions.length > 0 ? 'is-complete' : 'is-warning'}`}>
            <span>{missingCount === 0 && questions.length > 0 ? '✓' : '⚠️'}</span>
            <span>
              {questions.length === 0
                ? 'Chưa có câu hỏi'
                : missingCount === 0
                ? `Đủ đáp án ${questions.length}/${questions.length} câu`
                : `Đã gắn ${answeredCount}/${questions.length} câu (Còn thiếu ${missingCount} câu)`}
            </span>
          </div>

          {/* Lucian #355 Cloud Autosave Status Indicator */}
          <div className="code-studio-autosave" data-sync={syncStatus}>
            <svg viewBox="0 0 24 20" aria-hidden="true" className="autosave-cloud">
              <path className="cloud-path" d="M7 16.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.4 7.6 4.5 4.5 0 0 0 7 16.5z" />
              {syncStatus === 'syncing' ? (
                <>
                  <circle className="cloud-dot dot-1" cx="9" cy="12" r="1.2" />
                  <circle className="cloud-dot dot-2" cx="12.5" cy="12" r="1.2" />
                  <circle className="cloud-dot dot-3" cx="16" cy="12" r="1.2" />
                </>
              ) : (
                <path className="cloud-check" d="M9.3 12l2.2 2.1 4-4.2" />
              )}
            </svg>
            <span className="autosave-text">
              {syncStatus === 'syncing' ? 'Đang đồng bộ…' : 'Đã đồng bộ tức thì'}
            </span>
          </div>
        </div>

        {/* Master Actions */}
        <div className="code-studio-actions-right">
          {/* Split Ratio Presets */}
          <div className="code-studio-split-toggles" role="group" aria-label="Tỉ lệ chia màn hình">
            <button
              type="button"
              className={`split-btn ${splitPreset === 'balanced' ? 'active' : ''}`}
              onClick={() => setSplitPreset('balanced')}
              title="Chia đều 50 : 50"
            >
              50:50
            </button>
            <button
              type="button"
              className={`split-btn ${splitPreset === 'cards' ? 'active' : ''}`}
              onClick={() => setSplitPreset('cards')}
              title="Ưu tiên thẻ câu hỏi (60 : 40)"
            >
              📋 Thẻ
            </button>
            <button
              type="button"
              className={`split-btn ${splitPreset === 'code' ? 'active' : ''}`}
              onClick={() => setSplitPreset('code')}
              title="Ưu tiên soạn mã (40 : 60)"
            >
              💻 Code
            </button>
          </div>

          <button
            type="button"
            className="code-studio-btn code-studio-btn-accent"
            onClick={handleDividePoints}
            title="Tự động tính điểm mỗi câu theo thang điểm 10"
          >
            ⚖️ Chia điểm (Thang 10)
          </button>

          {documentText && (
            <button
              type="button"
              className="code-studio-btn"
              onClick={() => {
                if (window.confirm('Nạp lại văn bản từ tài liệu sẽ ghi đè nội dung soạn thảo hiện tại. Bạn có chắc không?')) {
                  setCode(documentText);
                }
              }}
              title="Khôi phục lại nội dung gốc từ tài liệu đã tải lên"
            >
              📥 Nạp lại từ tài liệu
            </button>
          )}

          <button
            type="button"
            className="code-studio-btn"
            onClick={handleAddQuestion}
            title="Chèn thêm một câu hỏi mới vào cuối đề"
          >
            + Thêm câu
          </button>

          <button
            type="button"
            className="code-studio-btn"
            onClick={handleInsertFormula}
            title="Chèn công thức toán học LaTeX"
          >
            ∑ LaTeX
          </button>

          <button
            type="button"
            className="code-studio-btn"
            onClick={() => setIsFullScreen(prev => !prev)}
            title="Chuyển đổi giao diện toàn màn hình Zen IDE"
          >
            {isFullScreen ? '↙ Thu nhỏ' : '⛶ Toàn màn hình'}
          </button>

          <button
            type="button"
            className="code-studio-btn code-studio-btn-primary"
            onClick={handleFinish}
            disabled={questions.length === 0}
          >
            ✦ Áp dụng & Duyệt đề ({questions.length} câu) →
          </button>
        </div>
      </div>

      {/* Main 2-Pane Split Container */}
      <div className="code-studio-panes">
        {/* Left Pane: Interactive Question Cards */}
        <div className="code-studio-preview-pane">
          <div className="code-studio-subbar">
            {/* Lucian #039 Sliding Pill Filter Tabs */}
            <div className="code-studio-filter-group" role="tablist">
              <button
                type="button"
                className={`code-studio-pill-filter ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                {statusFilter === 'all' && (
                  <motion.span
                    layoutId="activeFilterPill"
                    className="pill-sliding-bg"
                    transition={spring.selection}
                  />
                )}
                <span className="pill-label">Tất cả ({questions.length})</span>
              </button>

              {missingCount > 0 && (
                <button
                  type="button"
                  className={`code-studio-pill-filter is-warn ${statusFilter === 'missing' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('missing')}
                >
                  {statusFilter === 'missing' && (
                    <motion.span
                      layoutId="activeFilterPill"
                      className="pill-sliding-bg is-warn"
                      transition={spring.selection}
                    />
                  )}
                  <span className="pill-label">⚠️ Chưa có ({missingCount})</span>
                </button>
              )}

              <button
                type="button"
                className={`code-studio-pill-filter is-mint ${statusFilter === 'answered' ? 'active' : ''}`}
                onClick={() => setStatusFilter('answered')}
              >
                {statusFilter === 'answered' && (
                  <motion.span
                    layoutId="activeFilterPill"
                    className="pill-sliding-bg is-mint"
                    transition={spring.selection}
                  />
                )}
                <span className="pill-label">✓ Đã có ({answeredCount})</span>
              </button>
            </div>

            {/* Section & Search Filters */}
            <div className="code-studio-subbar-right">
              {/* Live Search */}
              <div className="code-studio-search-box">
                <span>🔎</span>
                <input
                  type="text"
                  placeholder="Tìm câu hỏi..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} className="search-clear">
                    ×
                  </button>
                )}
              </div>

              {groups.length > 0 && (
                <select
                  className="studio-input studio-group-select"
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                >
                  <option value="all">Tất cả ({groups.length} phần)</option>
                  {groups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}

              <div className="code-studio-jump-box">
                <span>Câu:</span>
                <input
                  type="number"
                  min={1}
                  max={questions.length || 1}
                  value={jumpNum}
                  onChange={e => setJumpNum(parseInt(e.target.value, 10) || 1)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleJump();
                  }}
                />
                <button
                  type="button"
                  className="code-studio-btn"
                  onClick={handleJump}
                >
                  Đến
                </button>
              </div>
            </div>
          </div>

          {/* Cards List */}
          <div className="code-studio-card-list">
            {filteredQuestions.length === 0 ? (
              <div className="code-studio-empty">
                <span style={{ fontSize: 32 }}>🔍</span>
                <p>Không có câu hỏi nào khớp với bộ lọc hoặc từ khóa.</p>
                {searchQuery && (
                  <button
                    type="button"
                    className="code-studio-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setSelectedGroup('all');
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const isAnswered = q.correctOptionIds.length > 0 || q.acceptedAnswers.length > 0;
                const correctLetterList = q.options
                  .filter(o => q.correctOptionIds.includes(o.id))
                  .map(o => o.letter);

                return (
                  <div
                    key={q.id}
                    id={`studio-card-q-${q.globalIndex}`}
                    className={`code-studio-qcard ${isAnswered ? 'is-answered' : 'is-unanswered'}`}
                  >
                    {/* Section Banner Header */}
                    {q.group && (idx === 0 || filteredQuestions[idx - 1]?.group !== q.group) && (
                      <div className="code-studio-group-banner">
                        <span>📑 {q.group}</span>
                      </div>
                    )}

                    <div className="code-studio-qcard-head">
                      <div className="code-studio-qcard-title">
                        <span className="code-studio-qnum">CÂU {q.number}:</span>
                        <span className="code-studio-global-idx" title="Số thứ tự trong đề thi">
                          #{q.globalIndex}
                        </span>

                        {/* Interactive Type Switcher */}
                        <select
                          className="code-studio-type-select"
                          value={q.type}
                          onChange={e => handleChangeQuestionType(q.globalIndex, e.target.value as QuestionType)}
                          title="Đổi dạng câu hỏi này"
                        >
                          <option value="single">🔘 Trắc nghiệm đơn (1 đáp án)</option>
                          <option value="multiple">☑️ Nhiều lựa chọn (chọn nhiều)</option>
                          <option value="boolean">⚖️ Đúng / Sai (a, b, c, d)</option>
                          <option value="short">✍️ Tự luận / Trả lời ngắn</option>
                          <option value="fill">📝 Điền từ / Điền khuyết</option>
                        </select>

                        {/* Status badge */}
                        <span className={`code-studio-status-pill ${isAnswered ? 'answered' : 'missing'}`}>
                          {isAnswered
                            ? `✓ Đáp án: ${correctLetterList.join(', ') || q.acceptedAnswers[0]}`
                            : '⚠️ Chưa chọn đáp án'}
                        </span>
                      </div>

                      {/* Points & Quick Actions */}
                      <div className="code-studio-head-right">
                        <div className="code-studio-points">
                          <span>Điểm:</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={q.points}
                            readOnly
                          />
                        </div>

                        {q.options.length === 0 && (
                          <button
                            type="button"
                            className="code-studio-card-action-btn"
                            onClick={() => handleAddOptions(q.globalIndex)}
                            title="Thêm nhanh 4 phương án A, B, C, D cho câu này"
                          >
                            + Thêm A, B, C, D
                          </button>
                        )}

                        <button
                          type="button"
                          className="code-studio-card-action-btn is-delete"
                          onClick={() => handleDeleteQuestion(q.globalIndex)}
                          title="Xóa câu hỏi này khỏi đề thi"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Question Stem */}
                    <div className="code-studio-stem">{q.stem}</div>

                    {/* Options list with interactive clickable buttons to assign answer */}
                    {q.options.length > 0 && (
                      <div className="code-studio-options">
                        {q.options.map(opt => {
                          const isCorrect = q.correctOptionIds.includes(opt.id);
                          return (
                            <motion.button
                              type="button"
                              key={opt.id}
                              whileTap={{ scale: 0.98 }}
                              transition={spring.press}
                              className={`code-studio-opt-btn ${isCorrect ? 'correct' : ''}`}
                              onClick={() => handleToggleAnswer(q.globalIndex, opt.letter, q.type === 'multiple')}
                              title="Bấm để gắn phương án này làm đáp án đúng"
                            >
                              <span className="code-studio-opt-letter">{opt.letter}</span>
                              <span className="code-studio-opt-text">{opt.text}</span>
                              {isCorrect && (
                                <motion.span
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={spring.pop}
                                  className="code-studio-opt-check"
                                >
                                  ✓ ĐÁP ÁN ĐÚNG
                                </motion.span>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short answer / fill input */}
                    {q.options.length === 0 && (
                      <div className="code-studio-text-answer-box">
                        <b className="text-ans-label">Đáp án:</b>
                        <input
                          type="text"
                          placeholder="Gõ đáp án chuẩn cho câu hỏi này..."
                          value={q.acceptedAnswers[0] || ''}
                          onChange={e => handleUpdateTextAnswer(q.globalIndex, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: IDE Code Editor */}
        <div className="code-studio-editor-pane">
          <div className="code-studio-subbar">
            <div className="code-studio-editor-title">
              <span className="editor-file-badge">📄 exam_code.azota</span>
              <span className="editor-sync-dot">● Tự động đồng bộ</span>
            </div>

            <div className="code-studio-editor-actions">
              <span className="code-studio-stats">
                {lineCount} dòng · {wordCount} từ
              </span>

              {/* Lucian #008 Copy Button */}
              <button
                type="button"
                className={`code-studio-btn ${copied ? 'code-studio-btn-accent' : ''}`}
                onClick={handleCopyCode}
                title="Sao chép toàn bộ mã đề thi vào bộ nhớ tạm"
              >
                {copied ? '✓ Đã sao chép' : '📋 Sao chép'}
              </button>

              <button
                type="button"
                className="code-studio-btn"
                onClick={handleBeautify}
                title="Chuẩn hóa định dạng và nhóm đề thi"
              >
                ✨ Chuẩn hóa
              </button>

              <button
                type="button"
                className="code-studio-btn"
                onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ nội dung?')) {
                    setCode('');
                  }
                }}
                title="Xóa sạch toàn bộ văn bản để gõ lại từ đầu"
              >
                🗑️ Xóa
              </button>
            </div>
          </div>

          {/* IDE Editor Area with Gutter & Line Numbers */}
          <div className="code-studio-editor-box">
            <div ref={lineNumbersRef} className="code-studio-line-numbers" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              className="code-studio-textarea"
              value={code}
              onChange={e => setCode(e.target.value)}
              onScroll={handleScroll}
              placeholder="Dán hoặc soạn đề thi theo cú pháp Azota tại đây..."
              spellCheck={false}
            />
          </div>

          {/* Sample Templates Bar */}
          <div className="code-studio-samples-bar">
            <span style={{ fontWeight: 700 }}>Nội dung mẫu:</span>
            {Object.entries(SAMPLE_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                type="button"
                className="code-studio-sample-pill"
                onClick={() => {
                  if (code.trim() && !window.confirm('Thay thế nội dung hiện tại bằng mẫu này?')) {
                    return;
                  }
                  setCode(template.text);
                }}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

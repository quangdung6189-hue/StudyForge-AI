'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DocumentDTO } from '@studyforge/contracts';

interface Flashcard {
  id: string;
  topic: string;
  type?: string;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  citation?: string;
}

const defaultFlashcards: Flashcard[] = [
  {
    id: 'default-1',
    topic: 'Phương pháp học tập',
    type: 'Lý thuyết',
    question: 'Nguyên lý hoạt động chính của phương pháp Lặp lại ngắt quãng (Spaced Repetition) là gì?',
    answer: 'Gia tăng dần khoảng cách thời gian giữa các lần ôn tập nhằm củng cố trí nhớ dài hạn trước khi kiến thức bị lãng quên.',
    explanation: 'Dựa trên đường cong lãng quên Ebbinghaus, việc chủ động gợi nhớ tại các thời điểm thích hợp giúp não bộ khắc sâu thông tin hiệu quả nhất.',
    citation: 'Tài liệu phương pháp học tập khoa học — StudyForge AI',
  },
  {
    id: 'default-2',
    topic: 'Kỹ năng làm bài thi',
    type: 'Chiến thuật',
    question: 'Chiến thuật làm bài thi trắc nghiệm 2 lượt mang lại lợi ích gì cho thí sinh?',
    answer: 'Lượt 1 giải quyết ngay các câu nhận biết chắc chắn đúng; lượt 2 tập trung thời gian suy luận cho các câu hỏi vận dụng phức tạp.',
    explanation: 'Giúp tối ưu hóa điểm số, tránh mất điểm đáng tiếc ở câu dễ và quản lý thời gian làm bài chặt chẽ.',
    citation: 'Cẩm nang phương pháp khảo thí và làm bài thi chuẩn hóa',
  },
  {
    id: 'default-3',
    topic: 'Kỹ năng làm bài thi',
    type: 'Đọc hiểu',
    question: 'Khi gặp câu hỏi trắc nghiệm Đúng/Sai đa ý, phương pháp đối chiếu tối ưu là gì?',
    answer: 'Đọc kỹ từng ý độc lập, gạch chân từ khóa phủ định (không, chỉ, luôn luôn) và đối chiếu trực tiếp với dẫn chứng trong tài liệu.',
    explanation: 'Các phương án Đúng/Sai thường bẫy bằng các trạng từ tuyệt đối hóa hoặc hoán đổi nguyên nhân - kết quả.',
    citation: 'Quy chuẩn ra đề thi và đánh giá năng lực học sinh',
  },
];

export default function StudyPage() {
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('default');
  const [flashcards, setFlashcards] = useState<Flashcard[]>(defaultFlashcards);
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [flipped, setFlipped] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());

  // Load user documents
  useEffect(() => {
    async function loadDocs() {
      try {
        const res = await fetch('/api/documents?limit=100');
        const data = await res.json();
        if (data.items) {
          setDocuments(data.items);
        }
      } catch (err) {
        console.error('Không tải được danh sách tài liệu:', err);
      } finally {
        setLoadingDocs(false);
      }
    }
    void loadDocs();
  }, []);

  // When selected document changes, fetch questions from document analysis
  const handleSelectDoc = useCallback(async (docId: string) => {
    setSelectedDocId(docId);
    setFlipped(false);
    setCurrentIdx(0);
    setMasteredIds(new Set());
    setReviewIds(new Set());

    if (docId === 'default') {
      setFlashcards(defaultFlashcards);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      const data = await res.json();
      const questions = data.analysis?.questions || [];
      if (questions.length > 0) {
        const mapped: Flashcard[] = questions.map((q: any, i: number) => {
          let ansText = '';
          if (q.documentAnswer?.acceptedAnswers?.length) {
            ansText = q.documentAnswer.acceptedAnswers.join(' / ');
          } else if (q.options?.length && q.documentAnswer?.indices?.length) {
            ansText = q.documentAnswer.indices.map((idx: number) => `${String.fromCharCode(65 + idx)}. ${q.options[idx]}`).join(', ');
          } else if (q.type === 'boolean') {
            ansText = q.documentAnswer?.indices?.includes(0) ? 'Đúng' : 'Sai';
          } else {
            ansText = 'Xem đối chiếu trong tài liệu gốc';
          }

          return {
            id: q.key || `doc-q-${i}`,
            topic: data.title || 'Tài liệu học tập',
            type: q.type === 'single' ? 'Trắc nghiệm đơn' : q.type === 'multiple' ? 'Nhiều lựa chọn' : q.type === 'boolean' ? 'Đúng / Sai' : 'Tự luận / Điền từ',
            question: q.stem,
            options: q.options,
            answer: ansText,
            explanation: q.sourceExplanation || 'Dựa trên phần chữ bóc tách từ tài liệu đối chiếu.',
            citation: `Trang ${q.pageNumber || 1} · Câu gốc ${q.number || (i + 1)}`,
          };
        });
        setFlashcards(mapped);
      } else {
        setFlashcards(defaultFlashcards);
      }
    } catch {
      setFlashcards(defaultFlashcards);
    } finally {
      setLoading(false);
    }
  }, []);

  const total = flashcards.length;
  const current = flashcards[currentIdx] || flashcards[0];
  const progressPercent = total > 0 ? Math.round(((masteredIds.size) / total) * 100) : 0;

  const handleNext = () => {
    setFlipped(false);
    setCurrentIdx(prev => (prev + 1) % total);
  };

  const handlePrev = () => {
    setFlipped(false);
    setCurrentIdx(prev => (prev - 1 + total) % total);
  };

  const handleMarkMastered = () => {
    if (!current) return;
    setMasteredIds(prev => new Set(prev).add(current.id));
    setReviewIds(prev => {
      const next = new Set(prev);
      next.delete(current.id);
      return next;
    });
    handleNext();
  };

  const handleMarkReview = () => {
    if (!current) return;
    setReviewIds(prev => new Set(prev).add(current.id));
    setMasteredIds(prev => {
      const next = new Set(prev);
      next.delete(current.id);
      return next;
    });
    handleNext();
  };

  const isMastered = current && masteredIds.has(current.id);
  const isReview = current && reviewIds.has(current.id);

  return (
    <div className="ux study-studio" style={{ maxWidth: '780px', margin: '0 auto', padding: '16px 20px 48px' }}>
      <style>{`
        .study-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 24px;
        }
        .study-title-group h1 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
          margin: 0 0 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .study-title-group p {
          font-size: 13.5px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .study-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: color-mix(in srgb, var(--ux-accent) 14%, var(--ux-surface));
          border: 1px solid color-mix(in srgb, var(--ux-accent) 25%, transparent);
          color: var(--ux-accent);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .study-doc-select {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 18px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          margin-bottom: 20px;
          box-shadow: 0 4px 14px var(--ux-shadow);
        }
        .study-doc-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink-2);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .study-doc-label svg {
          color: var(--ux-accent);
          flex-shrink: 0;
        }
        .study-select-wrap {
          position: relative;
          flex: 1;
          min-width: 0;
          width: 100%;
          display: flex;
          align-items: center;
        }
        .study-select-input {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          height: 40px;
          border-radius: 10px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line-2);
          color: var(--ux-ink);
          font-size: 13px;
          font-weight: 600;
          padding: 0 34px 0 14px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;
          transition: border-color .2s, box-shadow .2s;
        }
        .study-select-input:focus {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
          outline: none;
        }
        .study-select-chevron {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--ux-ink-3);
          pointer-events: none;
        }
        .study-select-loading {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ux-accent);
          flex-shrink: 0;
        }
        .study-mini-spin {
          width: 14px;
          height: 14px;
          border: 2px solid var(--ux-accent-soft);
          border-top-color: var(--ux-accent);
          border-radius: 50%;
          animation: study-spin .7s linear infinite;
        }
        @keyframes study-spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .study-doc-select {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
            padding: 14px;
          }
          .study-doc-label {
            margin-bottom: 2px;
          }
        }

        .study-progress-card {
          padding: 16px 20px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          margin-bottom: 24px;
        }
        .study-progress-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ux-ink-2);
          margin-bottom: 8px;
        }
        .study-progress-bar-bg {
          height: 8px;
          border-radius: 999px;
          background: var(--ux-surface-2);
          overflow: hidden;
          position: relative;
        }
        .study-progress-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--ux-accent), var(--ux-mint));
          transition: width 0.3s cubic-bezier(0.34, 1.45, 0.64, 1);
        }
        .study-chips {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .study-chip {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .study-chip.mastered {
          background: color-mix(in srgb, var(--ux-mint) 15%, transparent);
          color: var(--ux-mint);
        }
        .study-chip.review {
          background: color-mix(in srgb, var(--ux-warn) 15%, transparent);
          color: var(--ux-warn);
        }
        .study-chip.remaining {
          background: var(--ux-surface-2);
          color: var(--ux-ink-3);
        }

        .study-card {
          min-height: 340px;
          padding: 36px 32px;
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 12px 36px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          transition: transform .25s var(--ux-ease), box-shadow .25s, border-color .25s;
          position: relative;
          user-select: none;
        }
        .study-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 48px var(--ux-shadow-strong);
          border-color: color-mix(in srgb, var(--ux-accent) 30%, transparent);
        }
        .study-card-head {
          position: absolute;
          top: 18px;
          left: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          font-weight: 700;
        }
        .study-card-topic {
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .study-card-type {
          color: var(--ux-ink-3);
        }

        .study-card-content {
          font-size: 18px;
          font-weight: 700;
          line-height: 1.6;
          color: var(--ux-ink);
          margin: 28px 0 16px;
          max-width: 600px;
          overflow-wrap: anywhere;
        }
        .study-options-preview {
          display: flex;
          flex-direction: column;
          gap: 6px;
          width: 100%;
          max-width: 520px;
          margin-top: 12px;
          text-align: left;
        }
        .study-option-item {
          padding: 8px 12px;
          border-radius: 10px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          font-size: 13px;
          color: var(--ux-ink-2);
        }

        .study-card-hint {
          font-size: 12.5px;
          color: var(--ux-ink-3);
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 16px;
        }

        .study-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn-study-action {
          padding: 12px 20px;
          border-radius: 14px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s var(--ux-ease);
        }
        .btn-study-action:hover {
          transform: translateY(-1px);
          border-color: var(--ux-accent);
        }
        .btn-study-action.review {
          background: color-mix(in srgb, var(--ux-warn) 10%, var(--ux-surface));
          border-color: color-mix(in srgb, var(--ux-warn) 30%, transparent);
          color: var(--ux-warn);
        }
        .btn-study-action.mastered {
          background: var(--ux-accent);
          color: #ffffff;
          border-color: var(--ux-accent);
          box-shadow: 0 4px 14px color-mix(in srgb, var(--ux-accent) 30%, transparent);
        }
        .btn-study-action.mastered:hover {
          filter: brightness(1.05);
        }
      `}</style>

      {/* Header */}
      <div className="study-header">
        <div className="study-title-group">
          <h1>
            <span className="study-icon-wrap" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
            </span>
            Ôn luyện & Luyện tập thông minh
          </h1>
          <p>Ôn tập ngắt quãng từng câu hỏi từ tài liệu đã đọc để ghi nhớ lâu và chuẩn bị thi tốt nhất.</p>
        </div>
      </div>

      {/* Document Selector */}
      <div className="study-doc-select">
        <label htmlFor="doc-picker" className="study-doc-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
          <span>Chọn tài liệu ôn tập:</span>
        </label>

        <div className="study-select-wrap">
          <select
            id="doc-picker"
            className="study-select-input"
            value={selectedDocId}
            disabled={loadingDocs || loading}
            onChange={(e) => void handleSelectDoc(e.target.value)}
          >
            <option value="default">Bộ câu hỏi phương pháp ôn tập & ghi nhớ chuẩn</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.fileType?.toUpperCase() || 'FILE'})
              </option>
            ))}
          </select>
          <svg className="study-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {loading && (
          <div className="study-select-loading">
            <div className="study-mini-spin" />
            <span>Đang nạp…</span>
          </div>
        )}
      </div>

      {/* Progress tracking */}
      <div className="study-progress-card">
        <div className="study-progress-meta">
          <span>Tiến trình hoàn thành: <b>{progressPercent}%</b></span>
          <span>Câu {currentIdx + 1} / {total}</span>
        </div>
        <div className="study-progress-bar-bg" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="study-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="study-chips">
          <span className="study-chip mastered">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Đã nhớ: {masteredIds.size}
          </span>
          <span className="study-chip review">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Cần luyện lại: {reviewIds.size}
          </span>
          <span className="study-chip remaining">
            Còn lại: {Math.max(0, total - masteredIds.size)} câu
          </span>
        </div>
      </div>

      {/* Flashcard */}
      <div
        className="study-card"
        onClick={() => setFlipped((f) => !f)}
        tabIndex={0}
        role="button"
        aria-label="Nhấn hoặc bấm phím cách để lật thẻ"
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
      >
        <div className="study-card-head">
          <span className="study-card-topic">{current.topic}</span>
          <span className="study-card-type">{current.type} · {current.citation}</span>
        </div>

        {!flipped ? (
          <>
            <div style={{ fontSize: '13px', color: 'var(--ux-ink-3)', fontWeight: 700, marginTop: '10px' }}>
              CÂU HỎI {currentIdx + 1} / {total}
            </div>
            <div className="study-card-content">{current.question}</div>

            {current.options && current.options.length > 0 && (
              <div className="study-options-preview">
                {current.options.map((opt, idx) => (
                  <div key={idx} className="study-option-item">
                    <b>{String.fromCharCode(65 + idx)}.</b> {opt}
                  </div>
                ))}
              </div>
            )}

            <div className="study-card-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Nhấn vào thẻ hoặc phím Cách để xem đáp án
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '13px', color: 'var(--ux-mint)', fontWeight: 800, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              ĐÁP ÁN CHÍNH XÁC
            </div>
            <div className="study-card-content" style={{ color: 'var(--ux-mint)' }}>
              {current.answer}
            </div>
            {current.explanation && (
              <div style={{ fontSize: '13px', color: 'var(--ux-ink-2)', maxWidth: '540px', lineHeight: 1.6, marginBottom: '14px', textAlign: 'left', background: 'var(--ux-surface-2)', padding: '12px 16px', borderRadius: '12px' }}>
                <b style={{ color: 'var(--ux-ink)' }}>Giải thích chi tiết: </b>{current.explanation}
              </div>
            )}
            <div style={{ fontSize: '11.5px', color: 'var(--ux-ink-3)' }}>
              Nguồn trích dẫn: {current.citation}
            </div>
            <div className="study-card-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Nhấn để quay lại câu hỏi
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="study-actions">
        <button
          type="button"
          className="btn-study-action"
          onClick={handlePrev}
          title="Câu hỏi trước"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Câu trước
        </button>

        <button
          type="button"
          className="btn-study-action review"
          onClick={handleMarkReview}
          title="Đánh dấu câu này cần ôn tập lại"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Cần ôn lại
        </button>

        <button
          type="button"
          className="btn-study-action mastered"
          onClick={handleMarkMastered}
          title="Đã ghi nhớ vững vàng"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Đã nhớ · Tiếp tục
        </button>
      </div>
    </div>
  );
}

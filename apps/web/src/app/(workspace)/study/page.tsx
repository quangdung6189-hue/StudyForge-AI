'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function StudyPage() {
  const [flipped, setFlipped] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  // General spaced-repetition flashcards for study technique and methodology
  const flashcards = [
    {
      topic: 'Phương pháp học tập',
      question: 'Nguyên lý hoạt động chính của phương pháp Lặp lại ngắt quãng (Spaced Repetition) là gì?',
      answer: 'Gia tăng dần khoảng cách thời gian giữa các lần ôn tập nhằm củng cố trí nhớ dài hạn trước khi kiến thức bị lãng quên.',
      explanation: 'Dựa trên đường cong lãng quên Ebbinghaus, việc chủ động gợi nhớ tại các thời điểm thích hợp giúp não bộ khắc sâu thông tin hiệu quả nhất.',
      citation: 'Tài liệu phương pháp học tập khoa học — StudyForge AI',
    },
    {
      topic: 'Kỹ năng làm bài thi',
      question: 'Chiến thuật làm bài thi trắc nghiệm 2 lượt mang lại lợi ích gì cho thí sinh?',
      answer: 'Lượt 1 giải quyết ngay các câu nhận biết chắc chắn đúng; lượt 2 tập trung thời gian suy luận cho các câu hỏi vận dụng phức tạp.',
      explanation: 'Giúp tối ưu hóa điểm số, tránh mất điểm đáng tiếc ở câu dễ và quản lý thời gian làm bài chặt chẽ.',
      citation: 'Cẩm nang phương pháp khảo thí và làm bài thi chuẩn hóa',
    },
  ];

  const current = flashcards[currentIdx];

  return (
    <div className="ux" style={{ maxWidth: '680px', margin: '0 auto' }}>
      <style>{`
        .study-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .study-title {
          font-size: 26px;
          font-weight: 800;
          color: var(--ux-ink);
          margin: 0 0 8px;
        }
        .study-card {
          min-height: 320px;
          padding: 40px 32px;
          border-radius: 28px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 40px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          cursor: pointer;
          transition: transform .3s var(--ux-spring), box-shadow .3s;
          position: relative;
        }
        .study-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 14px 48px var(--ux-shadow-strong);
        }
        .study-topic {
          position: absolute;
          top: 20px;
          left: 24px;
          padding: 4px 12px;
          border-radius: 999px;
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
          font-size: 12px;
          font-weight: 800;
        }
        .study-card-content {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.6;
          color: var(--ux-ink);
          margin: 24px 0;
        }
        .study-card-hint {
          font-size: 13px;
          color: var(--ux-ink-3);
          font-weight: 600;
        }
        .study-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }
        .btn-study {
          padding: 12px 24px;
          border-radius: 14px;
          border: 0;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>

      <div className="study-header">
        <h1 className="study-title">🔄 Ôn luyện & Luyện lại câu sai</h1>
        <p style={{ color: 'var(--ux-ink-2)', fontSize: '14px', margin: 0 }}>
          Hệ thống ghi nhận các câu bạn đã trả lời chưa chính xác trong các bài thi để ôn tập ngắt quãng.
        </p>
      </div>

      <div className="study-card" onClick={() => setFlipped(f => !f)}>
        <span className="study-topic">{current.topic}</span>

        {!flipped ? (
          <>
            <div style={{ fontSize: '14px', color: 'var(--ux-ink-3)', fontWeight: 700 }}>
              CÂU HỎI ({currentIdx + 1}/{flashcards.length})
            </div>
            <div className="study-card-content">{current.question}</div>
            <div className="study-card-hint">Nhấn vào thẻ để xem đáp án & giải thích</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '14px', color: 'var(--ux-mint)', fontWeight: 800 }}>
              ĐÁP ÁN CHÍNH XÁC
            </div>
            <div className="study-card-content" style={{ color: 'var(--ux-mint)' }}>
              {current.answer}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ux-ink-2)', maxWidth: '500px', lineHeight: 1.5, marginBottom: '12px' }}>
              <b>Giải thích:</b> {current.explanation}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ux-ink-3)' }}>
              🔗 Dẫn nguồn: {current.citation}
            </div>
          </>
        )}
      </div>

      <div className="study-actions">
        <button
          className="btn-study"
          style={{ background: 'var(--ux-surface-2)', color: 'var(--ux-ink)' }}
          onClick={() => {
            setFlipped(false);
            setCurrentIdx(prev => (prev - 1 + flashcards.length) % flashcards.length);
          }}
        >
          ← Câu trước
        </button>

        <button
          className="btn-study"
          style={{ background: 'var(--ux-accent)', color: 'white' }}
          onClick={() => {
            setFlipped(false);
            setCurrentIdx(prev => (prev + 1) % flashcards.length);
          }}
        >
          Đã nhớ · Câu tiếp theo →
        </button>
      </div>
    </div>
  );
}

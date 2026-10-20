'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function StudyPage() {
  const [flipped, setFlipped] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Sample study questions for incorrect review
  const flashcards = [
    {
      topic: 'Sinh học 8',
      question: 'Cấu tạo chung của một tế bào người gồm những thành phần cơ bản nào?',
      answer: 'Gồm 3 phần chính: Màng sinh chất, chất tế bào và nhân.',
      explanation: 'Màng sinh chất bao bọc, chất tế bào chứa các bào quan thực hiện chuyển hóa, nhân mang vật chất di truyền.',
      citation: 'Sách giáo khoa Sinh học 8 — Chương I: Tế bào',
    },
    {
      topic: 'Địa lí 8',
      question: 'Tính chất nhiệt đới gió mùa ẩm của khí hậu Việt Nam được thể hiện qua những yếu tố nào?',
      answer: 'Nhiệt độ trung bình năm cao (>21°C), lượng mưa lớn (1500 - 2000 mm/năm) và độ ẩm không khí trên 80%.',
      explanation: 'Hai mùa gió rõ rệt: Gió mùa mùa đông (lạnh khô nửa đầu, ẩm nửa sau) và Gió mùa mùa hạ (nóng ẩm).',
      citation: 'Sách giáo khoa Địa lí 8 — Vị trí địa lí và khí hậu Việt Nam',
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

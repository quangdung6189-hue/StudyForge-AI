'use client';

// StudyForge Editorial Swiss Hero — Instant first-paint LCP headline, calm hierarchy, zero neon clutter
import React from 'react';
import Link from 'next/link';
import { GuideTerminal } from '@/components/landing/GuideTerminal';

const TRUST_ITEMS = [
  'Tách chuẩn A. B. C. D. và ý phụ a), b)',
  'Giữ nguyên công thức Toán – Lý – Hóa – Sinh',
  'Khóa đáp án trên máy chủ khi đang thi',
];

export function LandingHero() {
  return (
    <section className="sf-hero" aria-labelledby="sf-hero-heading">
      <div className="sf-hero-content">
        <div className="sf-badge">
          <span className="sf-badge-dot" aria-hidden="true" />
          <span>Không gian khảo thí &amp; ôn luyện chuẩn hóa</span>
        </div>

        <h1 id="sf-hero-heading" className="sf-title">
          Biến tài liệu học tập thành{' '}
          <span className="sf-title-accent">ngân hàng đề thi chuẩn xác</span>
        </h1>

        <p className="sf-sub">
          Tải lên tệp PDF, Word (DOCX), TXT hoặc ảnh chụp đề thi. StudyForge AI tự động chuẩn hóa
          câu hỏi, giữ nguyên công thức khoa học, đối chiếu trích dẫn nguồn và tạo phòng thi bảo mật trong vài giây.
        </p>

        <div className="sf-cta-row">
          <Link href="/sign-in" className="sf-btn sf-btn-primary sf-btn-lg">
            <span>Bắt đầu tạo bài thi</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          <Link href="/quizzes/take" className="sf-btn sf-btn-ghost sf-btn-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="13" y2="14" />
            </svg>
            <span>Vào phòng thi qua mã</span>
          </Link>
        </div>

        <ul className="sf-trust-strip" aria-label="Điểm nổi bật">
          {TRUST_ITEMS.map((item) => (
            <li key={item}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sf-preview-wrap">
        <GuideTerminal />
      </div>
    </section>
  );
}

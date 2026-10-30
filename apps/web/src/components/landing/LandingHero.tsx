// Lucian UX/UI Prompt #216 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#216
// Ported: Staggered hero entrance → StudyForge hero (nav → pill → title → sub → CTA → terminal).
// Lucian #252 shine pill + Animate UI catalog primitives (tokens only).
'use client';

import Link from 'next/link';
import { GuideTerminal } from '@/components/landing/GuideTerminal';
import { Effects, Effect } from '@animate-ui/react/primitives/effects/effect';
import { Magnetic } from '@animate-ui/react/primitives/effects/magnetic';
import { Click } from '@animate-ui/react/primitives/effects/click';
import { Shine } from '@animate-ui/react/primitives/effects/shine';
import { Particles, ParticlesEffect } from '@animate-ui/react/primitives/effects/particles';
import { SplittingText } from '@animate-ui/react/primitives/texts/splitting';
import { GradientText } from '@animate-ui/react/primitives/texts/gradient';
import { MorphingText } from '@animate-ui/react/primitives/texts/morphing';
import { ReducedMotionConfig } from '@animate-ui/react/utils/motion';

const PILL_NEWS = [
  'AI Khảo thí & Ôn luyện thế hệ mới',
  'Tách câu hỏi giữ nguyên đáp án gốc',
  'Chấm điểm & ôn tập ngắt quãng',
];

export function LandingHero() {
  return (
    <ReducedMotionConfig>
      <section className="sf-hero">
        <Effects holdDelay={90} fade blur slide={{ direction: 'up', offset: 14 }}>
          <Effect>
            <span className="sf-pill">
              <button type="button" className="sf-pill-btn" aria-label="Tin mới nhất về StudyForge AI">
                <span className="sf-shine" aria-hidden="true" />
                <span className="sf-pill-new">Mới</span>
                <span className="sf-pill-msg">
                  <MorphingText text={PILL_NEWS} loop />
                </span>
                <span className="sf-pill-arrow" aria-hidden="true">→</span>
              </button>
            </span>
          </Effect>
          <Effect>
            <h1 className="sf-title">
              <SplittingText type="words" text="Biến tài liệu học tập thành" />
              <br />
              <GradientText text="cách học của bạn" neon />
            </h1>
          </Effect>
          <Effect>
            <p className="sf-sub">
              Tự động chuyển đổi file PDF, Word (DOCX) và sách scan thành ngân hàng câu hỏi,
              đề thi chuẩn hoá có đối chiếu trích dẫn nguồn và bộ ôn luyện thông minh.
            </p>
          </Effect>
          <Effect>
            <div className="sf-cta-row">
              <Magnetic strength={0.35} range={140}>
                <Shine loop loopDelay={2800} color="rgba(255,255,255,0.55)" opacity={0.35}>
                  <Link href="/sign-in" className="sf-btn sf-btn-primary sf-btn-lg">
                    <Click variant="ripple" />
                    Bắt đầu tạo bài thi
                  </Link>
                </Shine>
              </Magnetic>
              <Magnetic strength={0.25} range={120}>
                <Link href="/quizzes/take" className="sf-btn sf-btn-ghost sf-btn-lg">
                  <Click variant="ripple" />
                  Vào phòng thi qua mã
                </Link>
              </Magnetic>
            </div>
            <p className="sf-hint">Đăng nhập 30 giây · Tự động xử lý tài liệu &amp; tạo đề thi chuẩn</p>
          </Effect>
          <Effect>
            <GuideTerminal />
          </Effect>
        </Effects>
        <Particles animate>
          <ParticlesEffect count={8} radius={60} spread={360} />
          <span aria-hidden="true" style={{ display: 'none' }} />
        </Particles>
      </section>
    </ReducedMotionConfig>
  );
}

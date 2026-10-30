'use client';

// Landing hero — expressive level: MorphingText + GradientText + Particles + Shine.
// Catalog only, tokens only. Reduced motion handled inside primitives.
import Link from 'next/link';
import { Effects } from '@animate-ui/react/primitives/effects/effect';
import { Effect } from '@animate-ui/react/primitives/effects/effect';
import { Magnetic } from '@animate-ui/react/primitives/effects/magnetic';
import { Click } from '@animate-ui/react/primitives/effects/click';
import { Particles, ParticlesEffect } from '@animate-ui/react/primitives/effects/particles';
import { Shine } from '@animate-ui/react/primitives/effects/shine';
import { MorphingText } from '@animate-ui/react/primitives/texts/morphing';
import { GradientText } from '@animate-ui/react/primitives/texts/gradient';
import { SplittingText } from '@animate-ui/react/primitives/texts/splitting';
import { ReducedMotionConfig } from '@animate-ui/react/utils/motion';

export function LandingHero() {
  return (
    <ReducedMotionConfig>
      <main>
        <section className="hero">
          <Effects holdDelay={90} fade blur slide={{ direction: 'up', offset: 14 }}>
            <Effect>
              <div className="hero-pill">
                <Particles animate>
                  <ParticlesEffect count={10} radius={42} spread={360} />
                  <span aria-hidden="true">✨</span>
                </Particles>
                <MorphingText
                  text={[
                    'AI Khảo thí & Ôn luyện thế hệ mới',
                    'Tách câu hỏi giữ nguyên đáp án gốc',
                    'Chấm điểm & ôn tập ngắt quãng',
                  ]}
                  loop
                />
              </div>
            </Effect>
            <Effect>
              <h1 className="hero-title">
                <SplittingText type="words" text="Biến tài liệu học tập thành" />
                <br />
                <GradientText text="cách học của bạn" neon />
              </h1>
            </Effect>
            <Effect>
              <p className="hero-subtitle">
                Tự động chuyển đổi file PDF, Word (DOCX) và sách scan thành ngân hàng câu hỏi, đề thi chuẩn hoá có đối chiếu trích dẫn nguồn và bộ ôn luyện thông minh.
              </p>
            </Effect>
            <Effect>
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Magnetic strength={0.35} range={140}>
                  <Shine loop loopDelay={2800} color="rgba(255,255,255,0.55)" opacity={0.35}>
                    <Link
                      href="/sign-in"
                      className="btn-primary"
                      style={{ padding: '14px 36px', fontSize: '16px', position: 'relative', overflow: 'hidden', display: 'inline-block' }}
                    >
                      <Click variant="ripple" />
                      Bắt đầu tạo bài thi
                    </Link>
                  </Shine>
                </Magnetic>
                <Magnetic strength={0.25} range={120}>
                  <Link
                    href="/quizzes/take"
                    className="btn-outline"
                    style={{ padding: '14px 30px', fontSize: '16px', position: 'relative', overflow: 'hidden', display: 'inline-block' }}
                  >
                    <Click variant="ripple" />
                    Vào phòng thi qua mã
                  </Link>
                </Magnetic>
              </div>
            </Effect>
            <Effect>
              <div className="demo-box">
                <b style={{ color: 'var(--ux-accent)', display: 'block', marginBottom: '8px' }}>
                  💡 Tài khoản mẫu để kiểm tra ngay lập tức:
                </b>
                <div style={{ fontSize: '14px', lineHeight: 1.8 }}>
                  • <b>Giáo viên:</b> <code>giaovien@studyforge.vn</code> / Mật khẩu: <code>GiaoVien2026!</code><br />
                  • <b>Học sinh:</b> <code>hocsinh@studyforge.vn</code> / Mật khẩu: <code>HocSinh2026!</code><br />
                  • <b>Mã đề thi mẫu:</b> <code>SINHHOC8DEMO</code> (Sinh học 8: Cấu tạo tế bào)
                </div>
              </div>
            </Effect>
          </Effects>
        </section>

        <div className="features-grid">
          <Effect fade blur slide={{ direction: 'up', offset: 18 }} asChild>
            <div className="feature-card">
              <div className="feature-icon">📁</div>
              <div className="feature-title">Trích xuất đa định dạng</div>
              <div className="feature-desc">
                Hỗ trợ kéo thả PDF, DOCX, TXT. Giữ nguyên công thức, bảng biểu và dấu tiếng Việt chuẩn Unicode NFC.
              </div>
            </div>
          </Effect>
          <Effect fade blur slide={{ direction: 'up', offset: 18 }} delay={90} asChild>
            <div className="feature-card">
              <div className="feature-icon">🔍</div>
              <div className="feature-title">Căn cứ &amp; Dẫn nguồn chuẩn xác</div>
              <div className="feature-desc">
                Phân biệt rõ ràng đáp án gốc trong tài liệu với đáp án AI đề xuất. Mọi câu hỏi đều có liên kết đối chiếu (sourceRefs) với đoạn trích.
              </div>
            </div>
          </Effect>
          <Effect fade blur slide={{ direction: 'up', offset: 18 }} delay={180} asChild>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <div className="feature-title">Phòng thi bảo mật cao</div>
              <div className="feature-desc">
                Đảo phương án theo seed từng thí sinh, tự động lưu câu trả lời vào máy chủ, kiểm soát hạn chót tuyệt đối và không để lộ đáp án trước khi nộp.
              </div>
            </div>
          </Effect>
        </div>
      </main>
    </ReducedMotionConfig>
  );
}

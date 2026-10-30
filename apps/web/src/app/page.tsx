import Link from 'next/link';
import '@/components/landing/landing-base.css';
import '@/components/landing/landing-hero.css';
import '@/components/landing/landing-cards.css';
import '@/components/landing/guide-terminal.css';
import { AnimatedLogo } from '@/components/landing/AnimatedLogo';
import { LandingBackground } from '@/components/landing/LandingBackground';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { ScrollProgress, ScrollProgressProvider } from '@animate-ui/react/primitives/scroll-progress';

export default function HomePage() {
  return (
    <ScrollProgressProvider global direction="vertical">
      <div className="sf-landing">
        <ScrollProgress className="sf-scroll-progress" mode="scaleX" />
        <LandingBackground />
        <nav className="sf-nav">
          <div className="sf-nav-inner">
            <Link href="/" className="sf-brand" aria-label="StudyForge AI — trang chủ">
              <AnimatedLogo />
              <span className="sf-brand-name">StudyForge AI<small>Khảo thí & Ôn luyện</small></span>
            </Link>
            <div className="sf-nav-links" aria-label="Điều hướng">
              <Link href="#tinh-nang">Tính năng</Link>
              <Link href="/quizzes/take">Vào thi</Link>
            </div>
            <div className="sf-nav-cta">
              <Link href="/sign-in" className="sf-btn sf-btn-ghost sf-btn-sm">Đăng nhập</Link>
              <Link href="/sign-in" className="sf-btn sf-btn-primary sf-btn-sm">Dùng thử ngay</Link>
            </div>
          </div>
        </nav>
        <main>
          <LandingHero />
          <div id="tinh-nang"><LandingFeatures /></div>
        </main>
        <footer className="sf-footer">
          <div className="sf-footer-inner">
            <span>© 2026 StudyForge AI — Biến tài liệu học tập thành cách học của bạn.</span>
            <span className="sf-sp" />
            <Link href="/sign-in">Đăng nhập</Link>
            <Link href="/quizzes/take">Vào phòng thi qua mã</Link>
          </div>
        </footer>
      </div>
    </ScrollProgressProvider>
  );
}

import Link from 'next/link';
import '@/components/landing/landing-base.css';
import '@/components/landing/landing-hero.css';
import '@/components/landing/landing-cards.css';
import '@/components/landing/guide-terminal.css';
import { LandingBackground } from '@/components/landing/LandingBackground';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LucianThemeSwitch } from '@/components/lucian/LucianThemeSwitch';

export default function HomePage() {
  return (
    <div className="sf-landing">
      <a href="#main-content" className="visually-hidden sf-skip-link">
        Bỏ qua tới nội dung chính
      </a>
      <LandingBackground />

      <header className="sf-nav">
        <div className="sf-nav-inner">
          <Link href="/" className="sf-brand" aria-label="StudyForge AI — Trang chủ">
            <span className="sf-logo-clean" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
              </svg>
            </span>
            <span className="sf-brand-name">
              StudyForge AI
              <small>Khảo thí &amp; Ôn luyện chuẩn hóa</small>
            </span>
          </Link>

          <nav className="sf-nav-links" aria-label="Điều hướng chính">
            <Link href="#tinh-nang">Tính năng</Link>
            <Link href="#quy-trinh">Quy trình</Link>
            <Link href="/quizzes/take">Vào thi</Link>
          </nav>

          <div className="sf-nav-cta">
            <LucianThemeSwitch />
            <Link href="/sign-in" className="sf-btn sf-btn-ghost sf-btn-sm">
              Đăng nhập
            </Link>
            <Link href="/sign-in" className="sf-btn sf-btn-primary sf-btn-sm">
              Bắt đầu ngay
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <LandingHero />
        <div id="tinh-nang">
          <LandingFeatures />
        </div>
      </main>

      <footer className="sf-footer">
        <div className="sf-footer-inner">
          <div className="sf-footer-brand">
            <strong>StudyForge AI</strong>
            <span>© 2026 · Nền tảng chuẩn hóa tài liệu, khảo thí bảo mật và ôn luyện thông minh.</span>
          </div>
          <nav className="sf-footer-links" aria-label="Liên kết chân trang">
            <Link href="#tinh-nang">Tính năng</Link>
            <Link href="#quy-trinh">Quy trình</Link>
            <Link href="/sign-in">Đăng nhập</Link>
            <Link href="/quizzes/take">Vào phòng thi</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// Lucian UX/UI Prompt #040 (Desktop Rail) & #041 (Mobile Notched Bottom Tab Bar)
// MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#040
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppIcon, type AppIconName } from './AppIcon';

interface AppSidebarProps {
  user?: { name: string; email: string; role: string } | null;
}

const ICONS: Record<string, AppIconName> = {
  '/dashboard': 'dashboard',
  '/documents': 'documents',
  '/quizzes/create': 'create',
  '/quizzes': 'quizzes',
  '/bank': 'bank',
  '/classes': 'classes',
  '/quizzes/take': 'take',
  '/study': 'study',
  '/history': 'progress',
};

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/documents', label: 'Tài liệu' },
  { href: '/quizzes/create', label: 'Tạo đề AI' },
  { href: '/quizzes', label: 'Ngân hàng đề' },
  { href: '/bank', label: 'Kho câu hỏi' },
  { href: '/classes', label: 'Lớp học' },
  { href: '/quizzes/take', label: 'Vào thi' },
  { href: '/study', label: 'Ôn luyện' },
  { href: '/history', label: 'Tiến bộ' },
];
// The notched mobile bar fits six destinations; the rest stay one tap away on the dashboard.
const MOBILE_HREFS = ['/dashboard', '/documents', '/quizzes/create', '/classes', '/quizzes/take', '/study'];

/** Longest matching route prefix, so nested pages (e.g. /quizzes/<id>/analytics) light their section. */
function matchIndex(items: { href: string }[], path: string) {
  let best = -1, length = -1;
  items.forEach((item, i) => {
    if ((path === item.href || path.startsWith(`${item.href}/`)) && item.href.length > length) { best = i; length = item.href.length; }
  });
  return best;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isWide, setIsWide] = useState(false);
  const [active, setActive] = useState<string>(pathname);

  const navItems = NAV_ITEMS;
  const mobileItems = NAV_ITEMS.filter(item => MOBILE_HREFS.includes(item.href));

  useEffect(() => {
    setActive(pathname);
  }, [pathname]);

  useEffect(() => {
    try {
      if (localStorage.getItem('sf-rail-wide') === '1') setIsWide(true);
    } catch {}
  }, []);

  const setWide = (next: boolean) => {
    setIsWide(next);
    try {
      localStorage.setItem('sf-rail-wide', next ? '1' : '0');
    } catch {}
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
    router.refresh();
  };

  const activeIndex = Math.max(0, matchIndex(navItems, active));
  const mobileIndex = matchIndex(mobileItems, active);

  return (
    <aside
      className="ux u040"
      data-wide={isWide}
      style={{ '--active-index': activeIndex, '--mobile-index': Math.max(0, mobileIndex), '--mobile-visible': mobileIndex >= 0 ? 1 : 0 } as React.CSSProperties}
    >
      <style>{`
        @property --notch-x {
          syntax: '<length>';
          inherits: true;
          initial-value: 0px;
        }

        /* ========================================================
           Desktop Rail (Lucian #040)
           ======================================================== */
        .u040 {
          --rw: 72px;
          position: sticky;
          top: 0;
          height: 100vh;
          height: 100dvh;
          flex: 0 0 auto;
          display: flex;
          background: var(--ux-sidebar);
          border-right: 1px solid var(--ux-line);
          transition: width .5s var(--ux-spring-glide), background-color .2s ease, border-color .2s ease;
          z-index: 40;
        }
        .u040[data-wide="true"] {
          --rw: 220px;
        }

        .u040-rail {
          position: relative;
          flex: none;
          width: var(--rw);
          padding: 14px 10px;
          background: var(--ux-sidebar);
          color: var(--ux-ink);
          overflow-y: auto;
          overflow-x: hidden;
          transition: width .5s var(--ux-spring-glide), background-color .2s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }

        @media (min-height: 720px) {
          .u040:not([data-wide="true"]) .u040-rail {
            overflow: visible;
          }
        }

        /* Top Brand Header */
        .u040-top {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 44px;
          margin-bottom: 18px;
          position: relative;
        }
        .u040[data-wide="true"] .u040-top {
          justify-content: space-between;
          padding: 0 2px 0 4px;
        }

        .u040-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          min-width: 0;
          cursor: pointer;
        }
        .u040-logo {
          width: 36px;
          height: 36px;
          flex: none;
          border-radius: 11px;
          background: var(--ux-brand-grad);
          color: #FFFFFF;
          display: grid;
          place-items: center;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 6px 16px -6px var(--ux-brand-glow);
          transition: transform .45s var(--ux-spring-pop), box-shadow .3s var(--ux-ease-color);
        }
        .u040-logo svg {
          width: 20px;
          height: 20px;
        }
        @media (hover: hover) and (pointer: fine) {
          .u040-brand:hover .u040-logo {
            transform: translateY(-1px) rotate(-6deg);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 10px 22px -6px var(--ux-brand-glow);
          }
        }

        .u040-name {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--ux-ink);
          display: none;
          opacity: 0;
          transition: opacity .25s var(--ux-ease-out) .08s, display .25s allow-discrete, color .2s ease;
        }
        .u040[data-wide="true"] .u040-name {
          display: block;
          opacity: 1;
        }
        @starting-style {
          .u040[data-wide="true"] .u040-name {
            opacity: 0;
          }
        }

        .u040-tog-header {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface-2);
          color: var(--ux-ink-3);
          display: none;
          place-items: center;
          cursor: pointer;
          flex: none;
          transition: color var(--ux-motion-fast) ease, background-color var(--ux-motion-fast) ease, border-color var(--ux-motion-fast) ease;
        }
        .u040[data-wide="true"] .u040-tog-header {
          display: grid;
        }
        .u040-tog-header:hover {
          color: var(--ux-ink);
          background: var(--ux-surface-3);
          border-color: var(--ux-line);
        }

        /* Focus Rail Indicator (Monochrome focus rail, notch & soft tint) */
        .u040-nav {
          position: relative;
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .u040-hl {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(90deg, color-mix(in srgb, var(--ux-accent) 15%, transparent), var(--ux-accent-soft) 70%);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ux-accent) 22%, transparent);
          transform: translateY(calc(var(--active-index) * 54px));
          transition: transform .5s var(--ux-spring-glide), background-color .2s ease;
          pointer-events: none;
        }
        .u040-hl::before {
          content: "";
          position: absolute;
          left: 0;
          top: 10px;
          bottom: 10px;
          width: 3px;
          border-radius: 0 3px 3px 0;
          background: var(--ux-accent-bar);
          box-shadow: 0 0 12px 1px var(--ux-brand-glow);
        }

        .u040-it {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 48px;
          padding: 0;
          border: 0;
          border-radius: 12px;
          background: none;
          color: var(--ux-ink-2);
          opacity: .92;
          transition: opacity .2s, color .2s, background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
          cursor: pointer;
          text-decoration: none;
        }
        .u040-it::after {
          content: attr(data-tip);
          position: absolute;
          left: calc(100% + 14px);
          top: 50%;
          padding: 6px 10px;
          border-radius: 8px;
          background: var(--ux-ink);
          color: var(--ux-page);
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transform: translate3d(-6px, -50%, 0) scale(.92);
          transform-origin: 0 50%;
          box-shadow: var(--ux-elev-3);
          transition: opacity .15s var(--ux-ease-out), transform .3s var(--ux-spring-pop);
          z-index: 5;
        }
        .u040[data-wide="true"] .u040-it::after {
          display: none;
        }
        @media (hover: hover) and (pointer: fine) {
          .u040-it:hover::after {
            opacity: 1;
            transform: translate3d(0, -50%, 0) scale(1);
            transition-delay: .12s;
          }
        }
        .u040-it:focus-visible::after {
          opacity: 1;
          transform: translate3d(0, -50%, 0) scale(1);
        }
        .u040[data-wide="true"] .u040-it {
          justify-content: flex-start;
          padding: 0 0 0 16px;
          gap: 14px;
        }

        .u040-it:hover {
          opacity: 1;
          color: var(--ux-ink);
          background: var(--ux-surface-2);
        }
        .u040-it[aria-current="page"] {
          opacity: 1;
          color: var(--ux-accent-text);
          font-weight: 700;
        }
        .u040-it:active {
          transform: var(--ux-press);
        }

        .u040-it svg {
          width: 21px;
          height: 21px;
          flex: none;
          transition: color var(--ux-motion-fast) ease, transform .45s var(--ux-spring-pop);
        }
        @media (hover: hover) and (pointer: fine) {
          .u040-it:hover svg {
            transform: translateY(-1px);
          }
        }
        .u040-it .icon-part {
          transform-box: fill-box;
          transform-origin: center;
          transition: transform var(--ux-motion-base) var(--ux-spring), opacity var(--ux-motion-fast) ease;
        }
        .u040-it[aria-current="page"] .icon-b {
          transform: translateY(-1px);
        }
        .u040-it[aria-current="page"] svg {
          stroke: var(--ux-accent-text);
        }

        .u040-it span {
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: calc(var(--rw) - 48px);
          display: none;
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity .14s var(--ux-ease-out), transform .2s var(--ux-ease-out), display .2s allow-discrete;
        }
        .u040[data-wide="true"] .u040-it span {
          display: block;
          opacity: 1;
          transform: none;
          transition: opacity .26s var(--ux-ease-out), transform .45s var(--ux-spring-pop), display .26s allow-discrete;
          transition-delay: calc(.08s + var(--i) * 24ms);
        }
        @starting-style {
          .u040[data-wide="true"] .u040-it span {
            opacity: 0;
            transform: translateX(-8px);
          }
        }

        /* Bottom Footer Area */
        .u040-bottom {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .u040-footer-tog {
          width: 100%;
          height: 40px;
          border: 1px solid var(--ux-line-2);
          border-radius: 11px;
          background: var(--ux-surface-2);
          color: var(--ux-ink-2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: color var(--ux-motion-fast) ease, background-color var(--ux-motion-fast) ease, border-color var(--ux-motion-fast) ease;
          gap: 10px;
        }
        .u040[data-wide="true"] .u040-footer-tog {
          justify-content: flex-start;
          padding: 0 14px;
        }
        .u040-footer-tog:hover {
          background: var(--ux-surface-3);
          color: var(--ux-accent);
          border-color: var(--ux-accent);
        }
        .u040-footer-tog span {
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          display: none;
        }
        .u040[data-wide="true"] .u040-footer-tog span {
          display: block;
        }

        /* User Profile Card */
        .u040-me {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 6px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          transition: background-color .2s ease, border-color .2s ease;
        }
        .u040[data-wide="true"] .u040-me {
          justify-content: flex-start;
          padding: 8px;
        }

        .u040-av {
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background:
            linear-gradient(var(--ux-surface), var(--ux-surface)) padding-box,
            var(--ux-brand-grad) border-box;
          color: var(--ux-accent-text);
          border: 1.5px solid transparent;
          font-weight: 800;
          font-size: 13.5px;
          display: grid;
          place-items: center;
          flex: none;
        }
        .u040-me-info {
          min-width: 0;
          flex: 1;
          display: none;
        }
        .u040[data-wide="true"] .u040-me-info {
          display: block;
        }

        .u040-me-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .u040-me-role {
          font-size: 10.5px;
          color: var(--ux-ink-3);
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: .03em;
        }

        .u040-logout {
          background: none;
          border: 0;
          color: var(--ux-ink-3);
          cursor: pointer;
          display: none;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          transition: color .2s, background-color .2s;
          flex: none;
        }
        .u040[data-wide="true"] .u040-logout {
          display: grid;
        }
        .u040-logout:hover {
          color: var(--ux-danger);
          background: color-mix(in srgb, var(--ux-danger) 12%, transparent);
        }

        /* ========================================================
           Mobile Notched Bottom Tab Bar (Lucian #041)
           ======================================================== */
        .u041-mobile-nav {
          display: none;
        }

        @media (max-width: 768px) {
          .u040-rail {
            display: none !important;
          }
          .u040 {
            position: fixed;
            inset: auto 0 0;
            height: auto;
            width: 100%;
            border: 0;
            background: transparent;
            z-index: 60;
            display: block;
            pointer-events: none;
          }

          .u041-mobile-nav {
            display: block;
            pointer-events: auto;
            position: relative;
            width: 100%;
            padding-bottom: env(safe-area-inset-bottom);
            --item-width: calc(100vw / 6);
            --notch-x: calc(var(--item-width) * var(--mobile-index) + var(--item-width) / 2);
            transition: --notch-x .55s var(--ux-spring-glide);
          }

          /* Bar background with radial cutout notch */
          .u041-bar {
            position: relative;
            width: 100%;
            height: 64px;
            background: color-mix(in srgb, var(--ux-surface) 96%, transparent);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid var(--ux-line);
            box-shadow: 0 -12px 32px -16px var(--ux-shadow-strong-c);
            -webkit-mask: radial-gradient(circle 34px at var(--notch-x) -4px, transparent 96%, #000 100%);
            mask: radial-gradient(circle 34px at var(--notch-x) -4px, transparent 96%, #000 100%);
          }

          /* Floating Bubble indicator lifting out of notch */
          .u041-bub {
            position: absolute;
            left: 0;
            top: -16px;
            width: 48px;
            height: 48px;
            margin-left: -24px;
            border-radius: 50%;
            background: var(--ux-brand-grad);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 10px 22px -8px var(--ux-brand-glow);
            transform: translate3d(var(--notch-x), 0, 0) scale(var(--mobile-visible));
            transition: transform .35s var(--ux-spring-pop);
            pointer-events: none;
            z-index: 2;
          }

          /* Tab items */
          .u041-tabs {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 64px;
            display: flex;
            margin: 0;
            padding: 0;
            list-style: none;
            z-index: 3;
          }
          .u041-tabs > li {
            flex: 1;
            display: flex;
            min-width: 0;
          }

          .u041-tab {
            position: relative;
            flex: 1;
            height: 100%;
            border: 0;
            padding: 0;
            background: none;
            color: var(--ux-ink-3);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            outline: none;
            -webkit-tap-highlight-color: transparent;
          }
          .u041-tab {
            transition: transform .4s var(--ux-spring-press);
          }
          .u041-tab:active {
            transform: scale(0.94);
          }

          .u041-ic {
            position: absolute;
            left: 50%;
            top: 14px;
            width: 22px;
            height: 22px;
            margin-left: -11px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform .42s var(--ux-spring), color .25s ease;
          }
          .u041-ic svg {
            width: 20px;
            height: 20px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .u041-lab {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 8px;
            font-size: 10px;
            font-weight: 700;
            color: var(--ux-ink);
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            padding: 0 2px;
            opacity: 0;
            transform: translateY(4px);
            transition: opacity .25s ease, transform .35s var(--ux-spring);
          }

          /* Active tab elevation into bubble */
          .u041-tab[aria-selected="true"] .u041-ic {
            transform: translateY(-24px);
            color: #FFFFFF;
          }
          .u041-tab[aria-selected="true"] .u041-ic svg {
            stroke-width: 2.3;
          }
          .u041-tab[aria-selected="true"] .u041-lab {
            opacity: 1;
            transform: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .u040, .u040-rail, .u040-hl, .u041-mobile-nav, .u041-bub, .u041-ic, .u041-lab, .u040-it span, .u040-it::after {
            transition: none !important;
          }
        }
      `}</style>

      {/* Desktop Rail View */}
      <nav className="u040-rail" aria-label="Main menu">
        <div>
          <div className="u040-top">
            <Link
              href="/dashboard"
              className="u040-brand"
              title="StudyForge AI - Bảng điều khiển"
              onClick={() => {
                if (!isWide) setWide(true);
              }}
            >
              <span className="u040-logo" aria-hidden="true">
                <AppIcon name="forge" />
              </span>
              <span className="u040-name">StudyForge AI</span>
            </Link>

            {isWide && (
              <button
                className="u040-tog-header"
                type="button"
                aria-expanded={isWide}
                aria-label="Thu gọn thanh bên"
                title="Thu gọn thanh bên"
                onClick={(e) => {
                  e.stopPropagation();
                  setWide(false);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
          </div>

          <ul className="u040-nav">
            <li className="u040-hl" role="presentation" />
            {navItems.map((item, i) => {
              const isActive = i === matchIndex(navItems, active);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="u040-it"
                    style={{ '--i': i } as React.CSSProperties}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                    data-tip={item.label}
                    onClick={() => {
                      setActive(item.href);
                    }}
                  >
                    <AppIcon name={ICONS[item.href]} active={isActive} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="u040-bottom">
          <button
            className="u040-footer-tog"
            type="button"
            aria-expanded={isWide}
            aria-label={isWide ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'}
            title={isWide ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'}
            onClick={() => setWide(!isWide)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isWide ? (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <polyline points="16 15 13 12 16 9" />
                </>
              ) : (
                <>
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <polyline points="14 9 17 12 14 15" />
                </>
              )}
            </svg>
            <span>Thu gọn thanh bên</span>
          </button>

          {user && (
            <div className="u040-me">
              <span className="u040-av" title={!isWide ? `${user.name} (${user.role})` : undefined}>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <div className="u040-me-info">
                <div className="u040-me-name">{user.name}</div>
                <div className="u040-me-role">
                  {user.role === 'teacher' ? 'Giáo viên' : user.role === 'admin' ? 'Quản trị' : 'Học sinh'}
                </div>
              </div>
              <button
                className="u040-logout"
                type="button"
                onClick={handleLogout}
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <AppIcon name="logout" width="18" height="18" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile Notched Bottom Tab Bar View (Lucian #041) */}
      <nav className="u041-mobile-nav" aria-label="Điều hướng chính di động">
        <div className="u041-bar" aria-hidden="true" />
        <span className="u041-bub" aria-hidden="true" />
        <ul className="u041-tabs" role="tablist">
          {mobileItems.map((item, i) => {
            const isSelected = i === mobileIndex;
            return (
              <li key={item.href} role="none">
                <Link
                  href={item.href}
                  className="u041-tab"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActive(item.href)}
                >
                  <span className="u041-ic" aria-hidden="true">
                    <AppIcon name={ICONS[item.href]} active={isSelected} />
                  </span>
                  <span className="u041-lab">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

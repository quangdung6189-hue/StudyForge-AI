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
  '/quizzes/take': 'take',
  '/study': 'study',
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isWide, setIsWide] = useState(false);
  const [active, setActive] = useState<string>(pathname);

  const navItems = [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/documents', label: 'Tài liệu' },
    { href: '/quizzes/create', label: 'Tạo đề AI' },
    { href: '/quizzes', label: 'Ngân hàng' },
    { href: '/quizzes/take', label: 'Vào thi' },
    { href: '/study', label: 'Ôn luyện' },
  ];

  useEffect(() => {
    setActive(pathname);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
    router.refresh();
  };

  const activeIndex = Math.max(
    0,
    navItems.findIndex(
      (item) => item.href === active || (item.href !== '/quizzes' && active.startsWith(`${item.href}/`))
    )
  );

  return (
    <aside
      className="ux u040"
      data-wide={isWide}
      style={{ '--active-index': activeIndex } as React.CSSProperties}
    >
      <style>{`
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
          transition: width .32s var(--ux-ease-spring), background-color .2s ease, border-color .2s ease;
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
          transition: width .32s var(--ux-ease-spring), background-color .2s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
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
          width: 38px;
          height: 38px;
          flex: none;
          border-radius: 12px;
          background: var(--ux-grad);
          color: #FFFFFF;
          display: grid;
          place-items: center;
          box-shadow: 0 6px 16px -4px color-mix(in srgb, var(--ux-accent) 45%, transparent);
          transition: transform var(--ux-motion-fast) var(--ux-ease), box-shadow var(--ux-motion-fast) ease;
        }
        .u040-logo svg {
          width: 22px;
          height: 22px;
        }
        @media (hover: hover) and (pointer: fine) {
          .u040-brand:hover .u040-logo {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px -4px color-mix(in srgb, var(--ux-accent) 55%, transparent);
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
          transition: opacity .2s, color .2s ease;
        }
        .u040[data-wide="true"] .u040-name {
          display: block;
          opacity: 1;
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
          background: var(--ux-accent-soft);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ux-accent) 24%, transparent);
          transform: translateY(calc(var(--active-index) * 54px));
          transition: transform .32s var(--ux-ease-spring), background-color .2s ease;
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
          transition: opacity .2s, color .2s, background-color .2s, transform var(--ux-motion-fast) ease;
          cursor: pointer;
          text-decoration: none;
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
          transition: color var(--ux-motion-fast) ease, transform var(--ux-motion-base) var(--ux-spring);
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
          transition: opacity .2s, transform .25s var(--ux-ease);
        }
        .u040[data-wide="true"] .u040-it span {
          display: block;
          opacity: 1;
          transform: none;
          transition: opacity .22s var(--ux-ease), transform .32s var(--ux-spring);
          transition-delay: calc(.06s + var(--i) * 20ms);
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
          background: var(--ux-accent-soft);
          color: var(--ux-accent-text);
          border: 1px solid color-mix(in srgb, var(--ux-accent) 26%, transparent);
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
            --notch-x: calc(var(--item-width) * var(--active-index) + var(--item-width) / 2);
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
            box-shadow: 0 -12px 32px -16px var(--ux-shadow-strong);
            -webkit-mask: radial-gradient(circle 34px at var(--notch-x) -4px, transparent 96%, #000 100%);
            mask: radial-gradient(circle 34px at var(--notch-x) -4px, transparent 96%, #000 100%);
            transition: -webkit-mask-position .38s var(--ux-ease-spring), mask-position .38s var(--ux-ease-spring);
          }

          /* Floating Bubble indicator lifting out of notch */
          .u041-bub {
            position: absolute;
            left: var(--notch-x);
            top: -16px;
            width: 48px;
            height: 48px;
            margin-left: -24px;
            border-radius: 50%;
            background: var(--ux-accent);
            box-shadow: 0 8px 20px -6px rgba(0, 0, 0, 0.4);
            border: 1px solid var(--ux-line-2);
            transition: left .38s var(--ux-ease-spring);
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
          .u041-tab:active {
            transform: scale(0.96);
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
            color: var(--ux-accent-ink);
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
          .u040, .u040-rail, .u040-hl, .u041-bub, .u041-ic, .u041-lab {
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
                if (!isWide) setIsWide(true);
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
                  setIsWide(false);
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
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="u040-it"
                    style={{ '--i': i } as React.CSSProperties}
                    aria-current={isActive ? 'page' : undefined}
                    title={!isWide ? item.label : undefined}
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
            onClick={() => setIsWide(!isWide)}
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
          {navItems.map((item) => {
            const isSelected = item.href === active || (item.href !== '/quizzes' && active.startsWith(`${item.href}/`));
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

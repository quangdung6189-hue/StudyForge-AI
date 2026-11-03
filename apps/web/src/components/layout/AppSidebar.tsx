// Lucian UX/UI Prompt #040 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#040
// Ported to React / Next.js: expanding sidebar rail with sliding highlight, keyboard nav, expand/collapse toggle
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AppSidebarProps {
  user?: { name: string; email: string; role: string } | null;
}

const ICONS: Record<string, string> = {
  '/dashboard': '<path d="M4 11l8-6.5 8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
  '/documents': '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  '/quizzes/create': '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  '/quizzes': '<path d="M5 5.5h14a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-7l-4.5 3.5V17H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/>',
  '/quizzes/take': '<path d="M4 13.5V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5"/><polyline points="14 2 14 8 20 8"/><path d="M10.42 12.61a2.1 2.1 0 1 1 2.97 2.97L7.95 21 4 22l1-3.95 5.42-5.44Z"/>',
  '/study': '<path d="M5 19.5V13M5 9V4.5M12 19.5V11M12 7V4.5M19 19.5V15M19 11V4.5M3 13h4M10 7h4M17 15h4"/>',
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isWide, setIsWide] = useState(false);
  const [active, setActive] = useState<string>(pathname);

  const navItems = [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/documents', label: 'Tài liệu học tập' },
    { href: '/quizzes/create', label: 'Tạo đề AI' },
    { href: '/quizzes', label: 'Ngân hàng & Đề thi' },
    { href: '/quizzes/take', label: 'Tham gia thi' },
    { href: '/study', label: 'Ôn luyện câu sai' },
  ];

  useEffect(() => {
    setActive(pathname);
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
    router.refresh();
  };

  const activeIndex = navItems.findIndex((i) => i.href === active);

  return (
    <aside className="ux u040" data-wide={isWide}>
      <style>{`
        .u040{--rw:72px;position:sticky;top:0;height:100vh;height:100dvh;flex:0 0 auto;display:flex;background:var(--ux-sidebar);border-right:1px solid var(--ux-line);transition:width .35s var(--ux-spring),background-color .2s ease,border-color .2s ease;z-index:30}
        .u040[data-wide="true"]{--rw:220px}
        .u040-rail{position:relative;flex:none;width:var(--rw);padding:14px 10px;background:var(--ux-sidebar);color:var(--ux-ink);overflow-y:auto;overflow-x:hidden;transition:width .35s var(--ux-spring),background-color .2s ease;display:flex;flex-direction:column;justify-content:space-between;height:100%}
        
        /* Top Brand Header */
        .u040-top{display:flex;align-items:center;justify-content:center;height:44px;margin-bottom:18px;position:relative}
        .u040[data-wide="true"] .u040-top{justify-content:space-between;padding:0 2px 0 4px}
        
        .u040-brand{display:flex;align-items:center;gap:12px;text-decoration:none;min-width:0;cursor:pointer}
        .u040-logo{width:38px;height:38px;flex:none;border-radius:12px;background:var(--ux-grad);color:#fff;font-weight:800;font-size:17px;display:grid;place-items:center;box-shadow:0 4px 12px rgba(99,102,241,0.25);transition:transform .2s ease}
        .u040-brand:hover .u040-logo{transform:scale(1.05)}
        
        .u040-name{font-size:15px;font-weight:800;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ux-ink);display:none;opacity:0;transition:opacity .2s,color .2s ease}
        .u040[data-wide="true"] .u040-name{display:block;opacity:1}
        
        /* Header Collapse Button (Only shown when expanded) */
        .u040-tog-header{width:30px;height:30px;border-radius:8px;border:1px solid var(--ux-line-2);background:var(--ux-surface-2);color:var(--ux-ink-3);display:none;place-items:center;cursor:pointer;flex:none;transition:all .2s ease}
        .u040[data-wide="true"] .u040-tog-header{display:grid}
        .u040-tog-header:hover{color:var(--ux-ink);background:var(--ux-surface-3);border-color:var(--ux-line)}
        
        /* Navigation items */
        .u040-nav{position:relative;margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
        .u040-hl{position:absolute;left:0;right:0;top:0;height:48px;border-radius:12px;background:var(--ux-accent-soft);transform:translateY(var(--y,0));transition:transform .35s var(--ux-spring),background-color .2s ease;pointer-events:none}
        .u040-hl::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3.5px;border-radius:0 3px 3px 0;background:var(--ux-accent-bar)}
        
        .u040-it{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:48px;padding:0;border:0;border-radius:12px;background:none;color:var(--ux-ink-2);opacity:.85;transition:opacity .2s,color .2s,background-color .2s;cursor:pointer;text-decoration:none}
        .u040[data-wide="true"] .u040-it{justify-content:flex-start;padding:0 0 0 16px;gap:14px}
        
        .u040-it:hover{opacity:1;color:var(--ux-ink);background:var(--ux-surface-2)}
        .u040-it[aria-current="page"]{opacity:1;color:var(--ux-accent-text);font-weight:700}
        
        .u040-it svg{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:stroke .2s}
        .u040-it[aria-current="page"] svg{stroke:var(--ux-accent-text)}
        
        .u040-it span{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(var(--rw) - 48px);display:none;opacity:0;transform:translateX(-6px);transition:opacity .2s,transform .25s var(--ux-ease)}
        .u040[data-wide="true"] .u040-it span{display:block;opacity:1;transform:none;transition:opacity .25s var(--ux-ease),transform .35s var(--ux-spring);transition-delay:calc(.08s + var(--i) * 25ms)}
        
        /* Bottom Footer Area */
        .u040-bottom{margin-top:auto;display:flex;flex-direction:column;gap:8px}
        
        /* Expand/Collapse Toggle Button */
        .u040-footer-tog{width:100%;height:40px;border:1px solid var(--ux-line-2);border-radius:11px;background:var(--ux-surface-2);color:var(--ux-ink-2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;gap:10px}
        .u040[data-wide="true"] .u040-footer-tog{justify-content:flex-start;padding:0 14px}
        .u040-footer-tog:hover{background:var(--ux-surface-3);color:var(--ux-accent);border-color:var(--ux-accent)}
        .u040-footer-tog span{font-size:13px;font-weight:600;white-space:nowrap;display:none}
        .u040[data-wide="true"] .u040-footer-tog span{display:block}
        
        /* User Profile Card */
        .u040-me{display:flex;align-items:center;justify-content:center;gap:10px;padding:6px;border-radius:12px;background:var(--ux-surface-2);border:1px solid var(--ux-line);transition:background-color .2s ease,border-color .2s ease}
        .u040[data-wide="true"] .u040-me{justify-content:flex-start;padding:8px}
        
        .u040-av{width:34px;height:34px;border-radius:50%;background:var(--ux-grad);color:#fff;font-weight:800;font-size:13.5px;display:grid;place-items:center;flex:none}
        .u040-me-info{min-width:0;flex:1;display:none}
        .u040[data-wide="true"] .u040-me-info{display:block}
        
        .u040-me-name{font-size:13px;font-weight:700;color:var(--ux-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .u040-me-role{font-size:10.5px;color:var(--ux-ink-3);font-weight:600;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em}
        
        .u040-logout{background:none;border:0;color:var(--ux-ink-3);cursor:pointer;display:none;place-items:center;width:32px;height:32px;border-radius:8px;transition:color .2s,background-color .2s;flex:none}
        .u040[data-wide="true"] .u040-logout{display:grid}
        .u040-logout:hover{color:var(--ux-danger);background:color-mix(in srgb,var(--ux-danger) 12%,transparent)}
      `}</style>

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
              <span className="u040-logo" aria-hidden="true">SF</span>
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
            <li
              className="u040-hl"
              role="presentation"
              style={{ transform: `translateY(${activeIndex * 54}px)` }}
            />
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
                    <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[item.href] || '' }} />
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}

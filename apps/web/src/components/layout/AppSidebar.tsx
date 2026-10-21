'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AppSidebarProps {
  user?: { name: string; email: string; role: string } | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/sign-in');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
    { href: '/documents', label: 'Tài liệu học tập', icon: '📁' },
    { href: '/quizzes/create', label: 'Tạo đề AI', icon: '✨' },
    { href: '/quizzes', label: 'Ngân hàng & Đề thi', icon: '📝' },
    { href: '/quizzes/take', label: 'Tham gia thi', icon: '✍️' },
    { href: '/study', label: 'Ôn luyện câu sai', icon: '🔄' },
  ];

  return (
    <aside className="app-sidebar ux">
      <style>{`
        .sidebar-brand {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--ux-line);
        }
        .sidebar-logo {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: var(--ux-grad);
          color: white;
          font-weight: 800;
          font-size: 18px;
          display: grid;
          place-items: center;
          box-shadow: 0 4px 12px var(--ux-shadow);
        }
        .sidebar-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
        }
        .sidebar-subtitle {
          font-size: 11px;
          color: var(--ux-ink-3);
          font-weight: 600;
        }
        .sidebar-nav {
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 12px;
          text-decoration: none;
          color: var(--ux-ink-2);
          font-size: 14px;
          font-weight: 650;
          transition: background-color .2s, color .2s;
        }
        .sidebar-link:hover {
          background: var(--ux-surface-2);
          color: var(--ux-ink);
        }
        .sidebar-link.active {
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
          font-weight: 750;
        }
        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid var(--ux-line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--ux-surface-2);
        }
        .sidebar-user {
          min-width: 0;
        }
        .sidebar-user-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-role {
          font-size: 11px;
          color: var(--ux-accent);
          font-weight: 700;
          text-transform: uppercase;
        }
        .sidebar-logout {
          background: none;
          border: 0;
          color: var(--ux-ink-3);
          cursor: pointer;
          font-size: 16px;
          padding: 6px;
          border-radius: 8px;
          transition: color .2s, background-color .2s;
        }
        .sidebar-logout:hover {
          color: var(--ux-danger);
          background: color-mix(in srgb, var(--ux-danger) 10%, transparent);
        }
      `}</style>

      <div className="sidebar-brand">
        <div className="sidebar-logo">SF</div>
        <div>
          <div className="sidebar-title">StudyForge AI</div>
          <div className="sidebar-subtitle">Học thông minh từ tài liệu</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">
              {user.role === 'teacher' ? 'Giáo viên' : user.role === 'admin' ? 'Quản trị' : 'Học sinh'}
            </div>
            <Link href="/sign-in" style={{ fontSize: '12px', color: 'var(--ux-ink-2)' }}>Tài khoản & liên kết Google</Link>
          </div>
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
          >
            🚪
          </button>
        </div>
      )}
    </aside>
  );
}

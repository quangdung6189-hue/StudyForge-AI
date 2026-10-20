'use client';

import React, { useState, useEffect } from 'react';

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header className="app-header ux">
      <style>{`
        .header-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .theme-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface);
          color: var(--ux-ink);
          display: grid;
          place-items: center;
          cursor: pointer;
          font-size: 16px;
          transition: background-color .2s, transform .2s var(--ux-spring);
        }
        .theme-btn:hover {
          background: var(--ux-surface-2);
          transform: scale(1.05);
        }
        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          font-size: 12px;
          font-weight: 700;
          color: var(--ux-mint);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ux-mint);
          box-shadow: 0 0 8px var(--ux-mint);
        }
      `}</style>

      <div className="header-title">{title || 'Bảng điều khiển'}</div>

      <div className="header-actions">
        <div className="status-badge">
          <span className="status-dot" />
          <span>Hệ thống trực tuyến</span>
        </div>

        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang chế độ Tối' : 'Chuyển sang chế độ Sáng'}
          aria-label="Đổi giao diện sáng/tối"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}

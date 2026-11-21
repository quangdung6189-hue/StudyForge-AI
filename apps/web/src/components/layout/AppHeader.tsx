'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { LucianThemeSwitch } from '../lucian/LucianThemeSwitch';
import { AppIcon } from './AppIcon';

interface AppHeaderProps {
  title?: string;
  actionSlot?: React.ReactNode;
}

export function AppHeader({ title, actionSlot }: AppHeaderProps) {
  const pathname = usePathname();
  const currentTitle = pathname.startsWith('/quizzes/create')
    ? 'Tạo bài kiểm tra'
    : pathname.startsWith('/quizzes/take')
      ? 'Làm bài kiểm tra'
      : pathname.startsWith('/quizzes')
        ? 'Ngân hàng đề'
        : pathname.startsWith('/documents')
          ? 'Tài liệu học tập'
          : pathname.startsWith('/study')
            ? 'Ôn luyện câu sai'
            : 'Bảng điều khiển';

  return (
    <header className="app-header ux">
      <div className="app-header-context">
        <span className="app-header-mark" aria-hidden="true">
          <AppIcon name="forge" />
        </span>
        <span className="app-header-kicker">Không gian học tập</span>
        <span className="app-header-separator" aria-hidden="true" />
        <span className="app-header-title">{title || currentTitle}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {actionSlot}
        <LucianThemeSwitch />
      </div>
    </header>
  );
}

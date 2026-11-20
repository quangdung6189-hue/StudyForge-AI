'use client';

import { usePathname } from 'next/navigation';
import { LucianThemeSwitch } from '../lucian/LucianThemeSwitch';
import { AppIcon } from './AppIcon';

export function AppHeader({ title }: { title?: string }) {
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
            ? 'Ôn luyện'
            : 'Bảng điều khiển';

  return (
    <header className="app-header ux">
      <div className="app-header-context">
        <span className="app-header-mark" aria-hidden="true"><AppIcon name="forge" /></span>
        <span className="app-header-kicker">Không gian học tập</span>
        <span className="app-header-separator" aria-hidden="true" />
        <span className="app-header-title">{title || currentTitle}</span>
      </div>
      <LucianThemeSwitch />
    </header>
  );
}

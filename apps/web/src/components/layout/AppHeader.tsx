'use client';

import { usePathname } from 'next/navigation';
import { LucianThemeSwitch } from '../lucian/LucianThemeSwitch';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            color: 'var(--ux-ink)',
            fontSize: '15px',
            fontWeight: 750,
            letterSpacing: '-0.015em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '50vw',
            display: 'inline-block',
            transition: 'color .2s ease',
          }}
        >
          {title || currentTitle}
        </span>
      </div>
      <LucianThemeSwitch />
    </header>
  );
}

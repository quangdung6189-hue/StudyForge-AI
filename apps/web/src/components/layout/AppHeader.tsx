'use client';

import { usePathname } from 'next/navigation';
import { LucianThemeSwitch } from '../lucian/LucianThemeSwitch';

export function AppHeader({ title }: { title?: string }) {
  const pathname = usePathname();
  const currentTitle = pathname.startsWith('/quizzes/create') ? 'Tạo bài kiểm tra' : pathname.startsWith('/quizzes/take') ? 'Làm bài kiểm tra' : pathname.startsWith('/quizzes') ? 'Ngân hàng đề' : pathname.startsWith('/documents') ? 'Tài liệu học tập' : pathname.startsWith('/study') ? 'Ôn luyện' : 'Bảng điều khiển';
  return <header className="app-header ux">
    <span style={{ color: 'var(--ux-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw', display: 'inline-block' }}>{title || currentTitle}</span>
    <LucianThemeSwitch />
  </header>;
}

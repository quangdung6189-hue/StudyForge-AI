'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LucianThemeSwitch } from '../lucian/LucianThemeSwitch';
import { AppIcon } from './AppIcon';

interface AppHeaderProps {
  title?: string;
  actionSlot?: React.ReactNode;
}

export function AppHeader({ title, actionSlot }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const isCreate = pathname.startsWith('/quizzes/create');
  const isTake = pathname.startsWith('/quizzes/take');

  const currentTitle = isCreate
    ? 'Tạo bài kiểm tra'
    : isTake
      ? 'Phòng làm bài thi'
      : pathname.endsWith('/analytics')
        ? 'Thống kê kết quả lớp'
        : pathname.endsWith('/grading')
          ? 'Chấm câu trả lời ngắn'
          : pathname.endsWith('/print')
            ? 'In đề & đáp án'
            : pathname.startsWith('/quizzes')
              ? 'Ngân hàng đề thi'
              : pathname.startsWith('/documents')
                ? 'Thư viện tài liệu'
                : pathname.startsWith('/study')
                  ? 'Ôn luyện thông minh'
                  : pathname.startsWith('/bank')
                    ? 'Kho câu hỏi'
                    : pathname.startsWith('/classes')
                      ? 'Lớp học & giao bài'
                      : pathname.startsWith('/history')
                        ? 'Tiến bộ học tập'
                        : 'Bảng điều khiển';

  const routeIcon = isCreate
    ? 'create'
    : isTake
      ? 'take'
      : pathname.startsWith('/quizzes')
        ? 'quizzes'
        : pathname.startsWith('/documents')
          ? 'documents'
          : pathname.startsWith('/study')
            ? 'study'
            : pathname.startsWith('/bank')
              ? 'bank'
              : pathname.startsWith('/classes')
                ? 'classes'
                : pathname.startsWith('/history')
                  ? 'progress'
                  : 'dashboard';

  const quickAction = !actionSlot
    ? isCreate
      ? { href: '/quizzes', label: 'Ngân hàng đề' }
      : isTake
        ? null
        : { href: '/quizzes/create', label: 'Tạo đề mới' }
    : null;

  const handleMobileLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/sign-in');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="app-header ux">
      <div className="app-header-context">
        <span key={routeIcon} className="app-header-mark sf-title-swap" aria-hidden="true">
          <AppIcon name={routeIcon} />
        </span>
        <span className="app-header-kicker">StudyForge</span>
        <span className="app-header-separator" aria-hidden="true" />
        <span key={title || currentTitle} className="app-header-title sf-title-swap">{title || currentTitle}</span>
      </div>

      <div className="app-header-actions">
        {actionSlot}
        {quickAction && (
          <Link href={quickAction.href} className="app-header-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {isCreate ? (
                <>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="8" y1="10" x2="16" y2="10" />
                  <line x1="8" y1="14" x2="13" y2="14" />
                </>
              ) : (
                <>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </>
              )}
            </svg>
            <span>{quickAction.label}</span>
          </Link>
        )}
        <LucianThemeSwitch />
        <button
          type="button"
          className="app-header-logout"
          onClick={handleMobileLogout}
          disabled={loggingOut}
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <AppIcon name="logout" width="17" height="17" />
        </button>
      </div>
    </header>
  );
}

'use client';

import type { SVGProps } from 'react';

export type AppIconName =
  | 'dashboard'
  | 'documents'
  | 'create'
  | 'quizzes'
  | 'take'
  | 'study'
  | 'logout'
  | 'panel'
  | 'forge'
  | 'theme'
  | 'check'
  | 'close';

interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: AppIconName;
  active?: boolean;
}

export function AppIcon({ name, active, className = '', ...props }: AppIconProps) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const activeClass = active ? ' is-active' : '';

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`app-icon app-icon-${name}${activeClass} ${className}`.trim()}
      {...props}
      {...common}
    >
      {name === 'dashboard' && (
        <>
          {/* Dashboard: Khối dữ liệu mở thành lưới 4 ô có nhịp co giãn nhẹ */}
          <rect className="icon-part icon-a" x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect className="icon-part icon-b" x="13.5" y="3.5" width="7" height="5" rx="1.8" />
          <rect className="icon-part icon-c" x="3.5" y="13.5" width="7" height="7" rx="2" />
          <rect className="icon-part icon-d" x="13.5" y="11.5" width="7" height="9" rx="1.8" />
        </>
      )}

      {name === 'documents' && (
        <>
          {/* Documents: Trang giấy gập góc, các đường nội dung nét vẽ */}
          <path className="icon-part icon-a" d="M6 3.5h8.5l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z" />
          <path className="icon-part icon-b" d="M14.5 3.5V8h4" />
          <path className="icon-part icon-c" d="M8.5 12.5h7M8.5 16h5" />
        </>
      )}

      {name === 'create' && (
        <>
          {/* Create: Dấu cộng ghép thành khối tạo câu hỏi mới */}
          <path className="icon-part icon-a" d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5Z" />
          <path className="icon-part icon-b" d="M12 8.5v7M8.5 12h7" />
        </>
      )}

      {name === 'quizzes' && (
        <>
          {/* Quizzes: Ngân hàng thẻ đề thi xếp tầng */}
          <rect className="icon-part icon-a" x="4" y="6" width="16" height="13" rx="2.5" />
          <path className="icon-part icon-b" d="M8 3.5h8" />
          <path className="icon-part icon-c" d="M8 10.5h8M8 14.5h5" />
        </>
      )}

      {name === 'take' && (
        <>
          {/* Take quiz: Cây bút tạo nét check hoàn thành bài */}
          <path className="icon-part icon-a" d="M4 19.5h16" />
          <path className="icon-part icon-b" d="m14 4.5 3.5 3.5L7.5 18H4v-3.5L14 4.5Z" />
          <path className="icon-part icon-c" d="m12.5 6 3.5 3.5" />
        </>
      )}

      {name === 'study' && (
        <>
          {/* Study: Thanh điều chỉnh / bộ lọc kiến thức ôn tập */}
          <path className="icon-part icon-a" d="M5 4v16M12 4v16M19 4v16" />
          <circle className="icon-part icon-b" cx="5" cy="9" r="2" fill="currentColor" />
          <circle className="icon-part icon-c" cx="12" cy="15" r="2" fill="currentColor" />
          <circle className="icon-part icon-d" cx="19" cy="11" r="2" fill="currentColor" />
        </>
      )}

      {name === 'logout' && (
        <>
          {/* Logout: Mũi tên trượt ra khỏi khung */}
          <path className="icon-part icon-a" d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
          <path className="icon-part icon-b" d="M13 8.5l4 3.5-4 3.5M8 12h9" />
        </>
      )}

      {name === 'panel' && (
        <>
          {/* Panel toggle */}
          <rect className="icon-part icon-a" x="3" y="4" width="18" height="16" rx="3" />
          <path className="icon-part icon-b" d="M9 4v16M14 9.5l2.5 2.5-2.5 2.5" />
        </>
      )}

      {name === 'forge' && (
        <>
          {/* Forge/Book 2 lớp biểu trưng StudyForge */}
          <path className="icon-part icon-a" d="M4.5 5.5h6c1.8 0 3.2 1.4 3.2 3.2V19c0-1.8-1.4-3.2-3.2-3.2h-6Z" />
          <path className="icon-part icon-b" d="M19.5 5.5h-6v13.5c.5-1.6 1.8-2.8 3.5-2.8h2.5Z" />
          <circle className="icon-part icon-c" cx="16.5" cy="4" r="1.2" fill="currentColor" stroke="none" />
        </>
      )}

      {name === 'theme' && (
        <>
          {/* Theme: Mặt trời thu tia thành trăng */}
          <circle className="icon-part icon-a" cx="12" cy="12" r="4.5" />
          <path className="icon-part icon-b" d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
        </>
      )}

      {name === 'check' && (
        <polyline points="20 6 9 17 4 12" />
      )}

      {name === 'close' && (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      )}
    </svg>
  );
}

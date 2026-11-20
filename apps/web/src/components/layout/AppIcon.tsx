'use client';

import type { SVGProps } from 'react';

export type AppIconName = 'dashboard' | 'documents' | 'create' | 'quizzes' | 'take' | 'study' | 'logout' | 'panel' | 'forge';

export function AppIcon({ name, ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props} {...common}>
      {name === 'dashboard' && <><rect className="icon-part icon-a" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect className="icon-part icon-b" x="13.5" y="3.5" width="7" height="4.5" rx="1.7"/><rect className="icon-part icon-c" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect className="icon-part icon-d" x="13.5" y="10.5" width="7" height="10" rx="2"/></>}
      {name === 'documents' && <><path className="icon-part icon-a" d="M6 3.5h8l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5A1.5 1.5 0 0 1 6.5 3.5Z"/><path className="icon-part icon-b" d="M14 3.5V8h4"/><path className="icon-part icon-c" d="M8.5 12h7M8.5 16h5"/></>}
      {name === 'create' && <><path className="icon-part icon-a" d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5Z"/><path className="icon-part icon-b" d="M12 8v8M8 12h8"/></>}
      {name === 'quizzes' && <><rect className="icon-part icon-a" x="4" y="5" width="16" height="14" rx="3"/><path className="icon-part icon-b" d="M8 9h8M8 13h5M8 16h7"/></>}
      {name === 'take' && <><path className="icon-part icon-a" d="M5 3.5h9l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20Z"/><path className="icon-part icon-b" d="M14 3.5V9h5"/><path className="icon-part icon-c" d="m9 16 1.7 1.7L15.5 13"/></>}
      {name === 'study' && <><path className="icon-part icon-a" d="M5 4v16M12 4v16M19 4v16"/><path className="icon-part icon-b" d="M3 9h4M10 15h4M17 11h4"/></>}
      {name === 'logout' && <><path className="icon-part icon-a" d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path className="icon-part icon-b" d="M13 8l4 4-4 4M8 12h9"/></>}
      {name === 'panel' && <><rect className="icon-part icon-a" x="3" y="4" width="18" height="16" rx="3"/><path className="icon-part icon-b" d="M9 4v16M14 9l3 3-3 3"/></>}
      {name === 'forge' && <><path className="icon-part icon-a" d="M5 5.5h5.5c1.7 0 3 1.3 3 3V19c0-1.7-1.3-3-3-3H5Z"/><path className="icon-part icon-b" d="M19 5.5h-5.5v13.2c.5-1.5 1.7-2.7 3.5-2.7h2Z"/><path className="icon-part icon-c" d="m16.5 3 .5 1.4 1.5.6-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.6Z"/></>}
    </svg>
  );
}
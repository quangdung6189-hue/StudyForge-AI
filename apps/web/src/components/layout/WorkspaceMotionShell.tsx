'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route frame: keyed on the pathname so every page change remounts it and replays the CSS
 * entrance in ux-system.css (fade on transition.reveal, 8px rise on spring.entrance).
 * CSS instead of Motion: it plays on first paint (no hydration wait, nothing hidden in the
 * server HTML) and leaves no transform behind, so position:fixed docks and modals inside a
 * page stay anchored to the viewport. Reduced motion keeps the fade only.
 */
export function WorkspaceMotionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="sf-route-frame">
      {children}
    </div>
  );
}

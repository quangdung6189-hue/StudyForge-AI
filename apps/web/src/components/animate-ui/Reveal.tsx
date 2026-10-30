'use client';

// Reveal — subtle entrance for real pages (catalog Effect, tokens only).
import * as React from 'react';
import { Effect } from '@animate-ui/react/primitives/effects/effect';
import { ReducedMotionConfig } from '@animate-ui/react/utils/motion';

export function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <ReducedMotionConfig>
      <Effect
        className={className}
        style={style}
        delay={delay}
        fade
        blur
        slide={{ direction: 'up', offset: 12 }}
      >
        {children}
      </Effect>
    </ReducedMotionConfig>
  );
}

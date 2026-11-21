'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ReducedMotionConfig,
  transition as motionTokens,
  useShouldReduceMotion,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';

function WorkspaceRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useShouldReduceMotion();
  const enterTransition = useTempoTransition(motionTokens.fade);

  return (
    <motion.div
      key={pathname}
      initial={reduce ? { opacity: 0.92 } : { opacity: 0.92, transform: 'translate3d(0, 6px, 0)' }}
      animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
      transition={enterTransition}
    >
      {children}
    </motion.div>
  );
}

export function WorkspaceMotionShell({ children }: { children: React.ReactNode }) {
  return (
    <ReducedMotionConfig>
      <WorkspaceRouteFrame>{children}</WorkspaceRouteFrame>
    </ReducedMotionConfig>
  );
}

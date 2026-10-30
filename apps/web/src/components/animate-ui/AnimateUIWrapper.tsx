'use client';

import { AnimateUIProvider } from '@animate-ui/react/provider';
import type { ReactNode } from 'react';

export default function AnimateUIWrapper({
  children,
  tempo = 1,
}: {
  children: ReactNode;
  tempo?: number;
}) {
  return <AnimateUIProvider tempo={tempo}>{children}</AnimateUIProvider>;
}
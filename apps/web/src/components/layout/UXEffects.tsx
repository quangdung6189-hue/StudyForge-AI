'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * App-wide interaction layer, mounted once in the root layout:
 * - pointer spotlight: writes --mx/--my on the hovered `.sf-spot` (one delegated, rAF-throttled listener)
 * - navigation progress bar for internal link clicks (completes when the pathname changes)
 * - "/" focuses the page's search field (`[data-hotkey="/"]`) when the user is not typing
 */
export function UXEffects() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const loading = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  // Pointer spotlight (fine pointers only)
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return;
    let frame = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${x - rect.left}px`);
      target.style.setProperty('--my', `${y - rect.top}px`);
    };
    const onMove = (event: PointerEvent) => {
      const el = (event.target as Element | null)?.closest?.('.sf-spot') as HTMLElement | null;
      if (!el) return;
      target = el;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Navigation progress: start on internal link clicks to another pathname
  useEffect(() => {
    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.getAttribute('aria-disabled') === 'true') return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname) return;
      const el = bar.current;
      if (!el) return;
      clear();
      loading.current = true;
      el.dataset.state = 'idle';
      void el.offsetWidth; // restart from 0
      el.dataset.state = 'loading';
      // Safety net: never leave the bar hanging (failed navigation, offline)
      timers.current.push(window.setTimeout(() => finish(), 12000));
    };
    const finish = () => {
      const el = bar.current;
      if (!el || !loading.current) return;
      loading.current = false;
      clear();
      el.dataset.state = 'done';
      timers.current.push(window.setTimeout(() => { el.dataset.state = 'idle'; }, 650));
    };
    finishRef.current = finish;
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      clear();
    };
  }, []);

  useEffect(() => {
    finishRef.current();
  }, [pathname]);

  // "/" focuses the search field of the current page
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
      const field = document.querySelector<HTMLInputElement>('[data-hotkey="/"]');
      if (!field) return;
      event.preventDefault();
      field.focus();
      field.select?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <div ref={bar} className="sf-progress" data-state="idle" aria-hidden="true" />;
}

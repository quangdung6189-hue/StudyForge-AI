// Lucian UX/UI Prompt #205 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#205
// Ported: Rippling letter logo → StudyForge SF mark (compact nav version).
// Keeps gaussian ripple + spring wobble, entrance wave on mount, reduced-motion safe.
'use client';

import * as React from 'react';
import { ReducedMotionConfig, useShouldReduceMotion } from '@animate-ui/react/utils/motion';

function LogoInner({ text = 'SF' }: { text?: string }) {
  const reduce = useShouldReduceMotion();
  const wrapRef = React.useRef<HTMLSpanElement>(null);
  const lettersRef = React.useRef<Array<{ el: HTMLSpanElement; x: number; y: number; v: number }>>([]);
  const stateRef = React.useRef<{ px: number | null; pulse: number | null; raf: number; amp: number }>({ px: null, pulse: null, raf: 0, amp: 22 });

  React.useEffect(() => {
    if (reduce) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const SIG = 34;
    const items = lettersRef.current.filter((l) => l.el.isConnected);
    const measure = () => {
      items.forEach((l) => {
        l.x = l.el.offsetLeft + l.el.offsetWidth / 2;
      });
    };
    const g = (d: number, s: number) => Math.exp(-(d * d) / (2 * s * s));
    const st = stateRef.current;
    const tick = (now: number) => {
      st.raf = 0;
      let moving = false;
      let pc: number | null = null;
      if (st.pulse != null) {
        const k = (now - st.pulse) / 1100;
        if (k >= 1) st.pulse = null;
        else pc = -60 + (wrap.offsetWidth + 120) * k;
      }
      items.forEach((l) => {
        let tgt = 0;
        if (st.px != null) tgt -= st.amp * g(l.x - st.px, SIG);
        if (pc != null) tgt -= st.amp * 1.35 * g(l.x - pc, SIG * 1.2);
        l.v += (tgt - l.y) * 0.16;
        l.v *= 0.8;
        l.y += l.v;
        if (Math.abs(l.v) > 0.02 || Math.abs(tgt - l.y) > 0.05) moving = true;
        const t = Math.min(1, Math.max(0, -l.y / 50));
        l.el.style.setProperty('--y', `${l.y.toFixed(2)}px`);
        l.el.style.setProperty('--t', t.toFixed(3));
      });
      if (moving || st.pulse != null || st.px != null) st.raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!st.raf) st.raf = requestAnimationFrame(tick);
    };
    const local = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      return (e.clientX - r.left) * (wrap.offsetWidth / (r.width || 1));
    };
    const onMove = (e: PointerEvent) => {
      if (!items[0]?.x) measure();
      st.px = local(e);
      kick();
    };
    const onLeave = () => {
      st.px = null;
      kick();
    };
    measure();
    // Entrance: one big wave from left to right shortly after mount
    const t1 = window.setTimeout(() => {
      measure();
      st.pulse = performance.now();
      kick();
    }, 350);
    const onResize = () => measure();
    wrap.addEventListener('pointermove', onMove as EventListener);
    wrap.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t1);
      wrap.removeEventListener('pointermove', onMove as EventListener);
      wrap.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
  }, [reduce, text]);

  return (
    <span ref={wrapRef} className="sf-logo-mark" role="img" aria-label="StudyForge AI">
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          aria-hidden={i > 0}
          className="sf-logo-l"
          style={{ animationDelay: `${i * 90}ms` }}
          ref={(el) => {
            if (el) {
              if (!lettersRef.current[i]) lettersRef.current[i] = { el, x: 0, y: 0, v: 0 };
              else lettersRef.current[i].el = el;
            }
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export function AnimatedLogo({ compact = false }: { compact?: boolean }) {
  return (
    <ReducedMotionConfig>
      <span className={compact ? 'sf-logo is-compact' : 'sf-logo'}>
        <LogoInner text="SF" />
      </span>
    </ReducedMotionConfig>
  );
}

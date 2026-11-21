// StudyForge landing background — grid + beams (animate-ui.com hero feel), GPU-composited + pauses offscreen/hidden.
'use client';

import { useEffect, useRef, useState } from 'react';

export function LandingBackground() {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = true;
    let visible = document.visibilityState === 'visible';
    const sync = () => setPaused(!inView || !visible);

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? true;
        sync();
      },
      { threshold: 0.01 }
    );
    observer.observe(el);

    const onVis = () => {
      visible = document.visibilityState === 'visible';
      sync();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div ref={ref} className="sf-bg" data-paused={paused} aria-hidden="true">
      <div className="sf-bg-grid" />
      <div className="sf-bg-glow" />
      <div className="sf-bg-glow2" />
      <div className="sf-beam sf-beam-x" style={{ top: '16%' }} />
      <div className="sf-beam sf-beam-x" style={{ top: '42%', animationDelay: '-3.4s' }} />
      <div className="sf-beam sf-beam-y" style={{ left: '30%' }} />
      <div className="sf-beam sf-beam-y" style={{ left: '68%', animationDelay: '-4.2s' }} />
    </div>
  );
}

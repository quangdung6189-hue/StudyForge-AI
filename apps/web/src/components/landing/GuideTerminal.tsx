'use client';

import { useEffect, useState } from 'react';

const LINES = [
  '> studyforge upload de-cuong.pdf',
  '+ Tách 24 câu hỏi, giữ đáp án gốc + sourceRefs',
  '> studyforge make-quiz --seed 42',
  '+ San sang, ma phong: SF-8K2Q',
];

export function GuideTerminal() {
  const [lines, setLines] = useState<string[]>([]);
  const [cur, setCur] = useState('');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLines(LINES);
      return;
    }
    let dead = false;
    let li = 0;
    let ci = 0;
    let t: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (dead) return;
      if (li >= LINES.length) {
        t = setTimeout(() => {
          if (!dead) {
            li = 0;
            ci = 0;
            setLines([]);
            setCur('');
            tick();
          }
        }, 3600);
        return;
      }
      const full = LINES[li];
      if (ci <= full.length) {
        setCur(full.slice(0, ci));
        ci += 1;
        t = setTimeout(tick, 35);
      } else {
        setLines((p) => [...p, full]);
        setCur('');
        li += 1;
        ci = 0;
        t = setTimeout(tick, 360);
      }
    };

    t = setTimeout(tick, 450);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="sf-terminal" role="region" aria-label="Demo StudyForge CLI">
      <div className="sf-term-bar">
        <span className="sf-dot" style={{ background: '#f87171' }} />
        <span className="sf-dot" style={{ background: '#fbbf24' }} />
        <span className="sf-dot" style={{ background: '#34d399' }} />
        <span className="sf-term-title">studyforge — terminal</span>
      </div>
      <div className="sf-term-body" role="log" aria-label="Demo terminal tự gõ">
        {lines.map((l, idx) => (
          <div key={idx} className={l.startsWith('+') ? 'sf-t-ok' : 'sf-t-cmd'}>
            {l}
          </div>
        ))}
        {cur ? (
          <div className={cur.startsWith('+') ? 'sf-t-ok' : 'sf-t-cmd'}>
            {cur}
            <span className="sf-caret" aria-hidden="true" />
          </div>
        ) : (
          <div>
            <span className="sf-caret" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}
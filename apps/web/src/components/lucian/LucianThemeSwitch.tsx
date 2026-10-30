// Lucian UX/UI Prompt #219 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#219
'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './theme-switch.css';

/** Apply the snippet's circular mask to the real page snapshot, keeping a single accessible DOM. */
export function LucianThemeSwitch() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : media.matches);
    sync(); setReady(true);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  async function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (busy.current) return;
    const next = !dark;
    const apply = () => {
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      document.cookie = `sf-theme=${next ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      setDark(next);
    };
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    busy.current = true;
    document.documentElement.classList.add('u219-transition');
    try {
      const transition = document.startViewTransition(() => flushSync(apply));
      await transition.ready;
      await document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }).finished;
      await transition.finished;
    } catch { apply(); }
    finally { busy.current = false; document.documentElement.classList.remove('u219-transition'); }
  }
  return <div className={`ux u219${dark ? ' is-on' : ''}`}><button className="u219-tg" type="button" disabled={!ready} onClick={toggle} aria-pressed={dark} aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title={dark ? 'Giao diện sáng' : 'Giao diện tối'}>
    <svg viewBox="0 0 16 16" aria-hidden="true">{dark ? <path d="M13.5 9.8A5.6 5.6 0 0 1 6.2 2.5a5.6 5.6 0 1 0 7.3 7.3z" fill="currentColor"/> : <><circle cx="8" cy="8" r="3" fill="currentColor"/><g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/></g></>}</svg>
  </button></div>;
}

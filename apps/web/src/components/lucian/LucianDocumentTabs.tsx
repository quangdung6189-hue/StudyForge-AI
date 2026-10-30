// Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039
'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import './document-tabs.css';

export function LucianDocumentTabs({ active, onChange, children }: { active: string; onChange: (value: string) => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), previous = useRef('questions');
  const tabs = [{ id: 'questions', label: 'Câu hỏi' }, { id: 'text', label: 'Văn bản' }, { id: 'original', label: 'Bản gốc' }];
  useEffect(() => {
    const place = () => { const button = root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]'); if (button && pill.current) { pill.current.style.setProperty('--x', `${button.offsetLeft}px`); pill.current.style.setProperty('--w', `${button.offsetWidth}px`); } };
    const observer = new ResizeObserver(place); if (root.current) observer.observe(root.current); place();
    return () => observer.disconnect();
  }, [active]);
  useEffect(() => {
    const dir = tabs.findIndex(tab => tab.id === active) >= tabs.findIndex(tab => tab.id === previous.current) ? 1 : -1;
    previous.current = active;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    root.current?.querySelectorAll('.u039-row').forEach((row, i) => {
      if (i > 7) return;
      animations.push(row.animate([{ transform: `translateX(${dir * 70}%)` }, { transform: 'none' }], { duration: 550, delay: i * 45, easing: 'cubic-bezier(.34,1.45,.64,1)' }), row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, delay: i * 45, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [active]);
  return <div className="ux u039 document-reader-tabs" ref={root}><div className="u039-tabs" role="tablist" aria-label="Xem tài liệu"><span className="u039-pill" ref={pill} aria-hidden="true"/>{tabs.map((tab, i) => <button key={tab.id} className="u039-tab" id={`document-tab-${tab.id}`} aria-controls="document-panel" type="button" role="tab" aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={event => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (offset) { event.preventDefault(); const next = (i + offset + tabs.length) % tabs.length; onChange(tabs[next].id); root.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus(); }
  }}>{tab.label}</button>)}</div><div className="u039-panel" id="document-panel" role="tabpanel" aria-labelledby={`document-tab-${active}`}>{children}</div></div>;
}

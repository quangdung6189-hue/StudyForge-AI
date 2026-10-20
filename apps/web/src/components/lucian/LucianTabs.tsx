'use client';

// Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039
// Ported to React / Next.js with sliding pill animation and keyboard navigation

import React, { useRef, useEffect } from 'react';

interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface LucianTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function LucianTabs({ tabs, activeId, onChange }: LucianTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!rootRef.current || !pillRef.current) return;
    const activeBtn = rootRef.current.querySelector<HTMLButtonElement>(`button[data-id="${activeId}"]`);
    if (activeBtn) {
      pillRef.current.style.setProperty('--x', `${activeBtn.offsetLeft}px`);
      pillRef.current.style.setProperty('--w', `${activeBtn.offsetWidth}px`);
    }
  }, [activeId, tabs]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (index + 1) % tabs.length;
      onChange(tabs[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (index - 1 + tabs.length) % tabs.length;
      onChange(tabs[prevIndex].id);
    }
  };

  return (
    <>
      <style>{`
        .u039-container {
          position: relative;
          display: inline-flex;
          max-width: 100%;
        }
        .u039-tabs {
          position: relative;
          display: flex;
          padding: 4px;
          border-radius: 999px;
          background: var(--ux-surface);
          box-shadow: 0 0 0 1px var(--ux-line);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .u039-tabs::-webkit-scrollbar { display: none; }
        .u039-pill {
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: var(--w, 80px);
          border-radius: 999px;
          background: var(--ux-accent);
          transform: translateX(var(--x, 4px));
          box-shadow: 0 4px 12px var(--ux-shadow);
          transition: transform .4s var(--ux-spring), width .4s var(--ux-spring);
          pointer-events: none;
        }
        .u039-tab {
          position: relative;
          height: 38px;
          padding: 0 16px;
          border: 0;
          border-radius: 999px;
          background: none;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ux-ink-2);
          white-space: nowrap;
          cursor: pointer;
          transition: color .3s var(--ux-ease);
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .u039-tab[aria-selected="true"] {
          color: var(--ux-accent-ink);
        }
        .u039-tab:focus-visible {
          outline: 2px solid var(--ux-accent);
          outline-offset: 2px;
        }
        .u039-badge {
          padding: 1px 6px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: var(--ux-surface-2);
          color: var(--ux-ink);
        }
        .u039-tab[aria-selected="true"] .u039-badge {
          background: rgba(255, 255, 255, 0.25);
          color: var(--ux-accent-ink);
        }
      `}</style>

      <div ref={rootRef} className="ux u039-container">
        <div className="u039-tabs" role="tablist">
          <span ref={pillRef} className="u039-pill" aria-hidden="true" />
          {tabs.map((tab, idx) => {
            const isSelected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                data-id={tab.id}
                className="u039-tab"
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onChange(tab.id)}
                onKeyDown={e => handleKeyDown(e, idx)}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="u039-badge">{tab.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

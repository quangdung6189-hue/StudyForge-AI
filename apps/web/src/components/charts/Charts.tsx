'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import './charts.css';

/* Hand-written SVG charts (single series): one hue (--ux-chart-1, validated for light & dark),
   2px lines, r=4 markers with a 2px surface ring, bars <= 24px with a 4px rounded data end
   square at the baseline, 2px surface gaps, hairline recessive grid, hover/focus tooltips.
   Every page that uses them also renders the same numbers as a table. */

type Point = { label: string; value: number; detail?: string };

function roundedBar(x: number, y: number, w: number, h: number, r: number, horizontal: boolean) {
  if (h <= 0 || w <= 0) return '';
  if (horizontal) {
    const rr = Math.min(r, w, h / 2);
    return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
  }
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function Tooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return <div className="sf-chart-tip" style={{ left: x, top: y }} role="status">{children}</div>;
}

/** Score (%) over time. Y is fixed 0–100 so attempts compare honestly. */
export function TrendChart({ points, height = 220, ariaLabel }: { points: Point[]; height?: number; ariaLabel: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  React.useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = { top: 16, right: 44, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right, h = height - pad.top - pad.bottom;
  const xs = points.map((_, i) => pad.left + (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w));
  const ys = points.map(p => pad.top + h - (Math.max(0, Math.min(100, p.value)) / 100) * h);
  const line = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${line} L${xs[xs.length - 1]},${pad.top + h} L${xs[0]},${pad.top + h} Z` : '';
  const last = points.length - 1;
  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left + pad.left;
    let best = 0;
    xs.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(xs[best] - x)) best = i; });
    setHover(best);
  };
  return (
    <div className="sf-chart" ref={wrap}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ux-chart-1)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--ux-chart-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map(t => {
          const y = pad.top + h - (t / 100) * h;
          return (
            <g key={t}>
              <line className="sf-chart-grid" x1={pad.left} x2={pad.left + w} y1={y} y2={y} />
              <text className="sf-chart-axis" x={pad.left - 8} y={y + 4} textAnchor="end">{t}%</text>
            </g>
          );
        })}
        {area && <path d={area} fill={`url(#${gradient})`} className="sf-chart-draw-area" />}
        {points.length > 1 && <path d={line} className="sf-chart-line" pathLength={1} />}
        {hover !== null && <line className="sf-chart-cross" x1={xs[hover]} x2={xs[hover]} y1={pad.top} y2={pad.top + h} />}
        {points.map((p, i) => (
          <circle key={i} className="sf-chart-dot" cx={xs[i]} cy={ys[i]} r={hover === i ? 5.5 : 4} data-active={hover === i || undefined} />
        ))}
        {points.length > 0 && (
          <text className="sf-chart-value" x={xs[last] + 10} y={ys[last] + 4}>{Math.round(points[last].value)}%</text>
        )}
        {points.length > 0 && [0, last].filter((v, i, a) => a.indexOf(v) === i).map(i => (
          <text key={i} className="sf-chart-axis" x={xs[i]} y={height - 8} textAnchor={i === 0 && points.length > 1 ? 'start' : 'end'}>{points[i].label}</text>
        ))}
        <rect x={pad.left} y={pad.top} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && points[hover] && (
        <Tooltip x={Math.min(width - 170, Math.max(0, xs[hover] - 80))} y={Math.max(0, ys[hover] - 64)}>
          <b>{Math.round(points[hover].value * 10) / 10}%</b>
          <span>{points[hover].label}</span>
          {points[hover].detail && <span>{points[hover].detail}</span>}
        </Tooltip>
      )}
    </div>
  );
}

/** Horizontal bars of a share (0–1), label left, value at the bar tip. */
export function ShareBars({ items, ariaLabel }: { items: { label: string; value: number; detail?: string }[]; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const row = 34, barH = 14, labelW = 128, valueW = 52, width = 520;
  const plot = width - labelW - valueW;
  const height = items.length * row + 8;
  return (
    <div className="sf-chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel} preserveAspectRatio="xMinYMin meet">
        {items.map((item, i) => {
          const y = i * row + (row - barH) / 2 + 4;
          const v = Math.max(0, Math.min(1, item.value));
          return (
            <g key={item.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <text className="sf-chart-label" x={0} y={y + barH - 2}>{item.label}</text>
              <rect className="sf-chart-track" x={labelW} y={y} width={plot} height={barH} rx={4} />
              <path className="sf-chart-bar" d={roundedBar(labelW, y, Math.max(v * plot, v > 0 ? 4 : 0), barH, 4, true)} data-active={hover === i || undefined} style={{ ['--i' as string]: i }} />
              <text className="sf-chart-value" x={labelW + plot + 8} y={y + barH - 2}>{Math.round(v * 100)}%</text>
              <rect x={0} y={i * row} width={width} height={row} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hover !== null && items[hover]?.detail && (
        <Tooltip x={labelW} y={hover * 34 - 30}><span>{items[hover].detail}</span></Tooltip>
      )}
    </div>
  );
}

/** Class score distribution in 10-point bins. */
export function Histogram({ bins, ariaLabel }: { bins: { from: number; to: number; count: number }[]; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560, height = 200, pad = { top: 18, bottom: 26, left: 28, right: 8 };
  const max = useMemo(() => Math.max(1, ...bins.map(b => b.count)), [bins]);
  const slot = (width - pad.left - pad.right) / bins.length;
  const barW = Math.min(24, slot - 2);
  const h = height - pad.top - pad.bottom;
  const ticks = Array.from(new Set([0, Math.ceil(max / 2), max]));
  return (
    <div className="sf-chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel} preserveAspectRatio="xMinYMin meet">
        {ticks.map(t => {
          const y = pad.top + h - (t / max) * h;
          return (
            <g key={t}>
              <line className="sf-chart-grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text className="sf-chart-axis" x={pad.left - 6} y={y + 4} textAnchor="end">{t}</text>
            </g>
          );
        })}
        {bins.map((b, i) => {
          const bh = (b.count / max) * h;
          const x = pad.left + i * slot + (slot - barW) / 2;
          return (
            <g key={b.from} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={h} fill="transparent" />
              {b.count > 0 && <path className="sf-chart-bar sf-chart-col" d={roundedBar(x, pad.top + h - bh, barW, bh, 4, false)} data-active={hover === i || undefined} style={{ ['--i' as string]: i }} />}
              {b.count > 0 && <text className="sf-chart-value" x={x + barW / 2} y={pad.top + h - bh - 5} textAnchor="middle">{b.count}</text>}
              {i % 2 === 0 && <text className="sf-chart-axis" x={pad.left + i * slot} y={height - 8}>{b.from}</text>}
            </g>
          );
        })}
        <text className="sf-chart-axis" x={width - pad.right} y={height - 8} textAnchor="end">100%</text>
      </svg>
      {hover !== null && (
        <Tooltip x={Math.min(width - 160, pad.left + hover * slot)} y={0}>
          <b>{bins[hover].count} học sinh</b>
          <span>{bins[hover].from}–{bins[hover].to}% điểm</span>
        </Tooltip>
      )}
    </div>
  );
}

/** Inline correct-rate meter for table rows (value also printed as text). */
export function RateMeter({ value }: { value: number }) {
  return (
    <span className="sf-rate" aria-hidden="true">
      <i style={{ ['--p' as string]: Math.max(0, Math.min(1, value)) }} />
    </span>
  );
}

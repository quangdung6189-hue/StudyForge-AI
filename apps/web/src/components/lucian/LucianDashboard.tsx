// Lucian UX/UI Prompt #178 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#178
// StudyForge Editorial Command Center Dashboard with Quick Actions & Lucian #178 Bulk Selection Dock
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ReducedMotionConfig,
  scale as motionScale,
  spring,
  transition as motionTransition,
  useShouldReduceMotion,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { AppIcon } from '../layout/AppIcon';

export type DashboardDoc = {
  id: string;
  title: string;
  fileType?: string;
  status?: string;
  createdAt: string;
};

export type DashboardQuiz = {
  id: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  isPublished?: boolean;
  shareCode?: string | null;
  createdAt?: string;
};

interface LucianDashboardProps {
  docs: DashboardDoc[];
  quizzes: DashboardQuiz[];
  greeting?: string;
  userName?: string;
  assignments?: { id: string; className: string; title: string; shareCode: string | null; dueAt: string | null; done: boolean }[];
  studyDue?: number;
  streak?: number;
}

const MORE_LINKS = [
  { href: '/bank', icon: 'bank' as const, title: 'Kho câu hỏi', desc: 'Gắn thẻ, lọc và ghép đề mới' },
  { href: '/classes', icon: 'classes' as const, title: 'Lớp học', desc: 'Giao bài, theo dõi nộp bài' },
  { href: '/history', icon: 'progress' as const, title: 'Tiến bộ', desc: 'Điểm theo thời gian, phần cần ôn' },
];

const dueLabel = (iso: string | null) => {
  if (!iso) return 'Không giới hạn';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Đã quá hạn';
  const h = Math.round(ms / 3_600_000);
  return h < 24 ? `Còn ${Math.max(1, h)} giờ` : `Còn ${Math.round(h / 24)} ngày`;
};

const QUICK_ACTIONS = [
  {
    href: '/documents',
    icon: 'documents' as const,
    title: 'Tải tài liệu mới',
    desc: 'Nhập PDF, Word (DOCX), TXT hoặc ảnh chụp đề thi.',
  },
  {
    href: '/quizzes/create',
    icon: 'create' as const,
    title: 'Biên soạn đề trực quan',
    desc: 'Sinh đề bằng AI, gõ công thức STEM và duyệt đáp án.',
  },
  {
    href: '/quizzes/take',
    icon: 'take' as const,
    title: 'Vào phòng thi qua mã',
    desc: 'Nhập mã tham gia để làm bài có đồng hồ máy chủ.',
  },
  {
    href: '/study',
    icon: 'study' as const,
    title: 'Ôn luyện Flashcard',
    desc: 'Luyện lặp lại ngắt quãng với đầy đủ giải thích.',
  },
];

export function LucianDashboard({ docs, quizzes, greeting, userName, assignments = [], studyDue = 0, streak = 0 }: LucianDashboardProps) {
  const todo = assignments.filter(a => !a.done);
  const [now, setNow] = useState<number | null>(null);
  React.useEffect(() => setNow(Date.now()), []);
  const readyDocs = docs.filter((d) => d.status === 'ready');
  const publishedQuizzes = quizzes.filter((q) => q.isPublished);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const reduce = useShouldReduceMotion();
  const dockIn = useTempoTransition(spring.toast);
  const dockOut = useTempoTransition(motionTransition.dismiss);
  const dockFade = useTempoTransition(motionTransition.reveal);
  const firstName = userName?.trim().split(/\s+/).pop() ?? '';
  const readyRatio = docs.length ? Math.round((readyDocs.length / docs.length) * 100) : 0;

  const toggleSelectDoc = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  return (
    <div className="ux ld-container">
      <style>{`
        .ld-container {
          max-width: 1240px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
        }

        /* Editorial Command Center Welcome Card */
        .ld-welcome {
          padding: 30px 32px;
          border-radius: 22px;
          background:
            radial-gradient(70% 140% at 100% 0%, color-mix(in srgb, var(--ux-accent) 13%, transparent), transparent 62%),
            radial-gradient(50% 120% at 0% 100%, color-mix(in srgb, var(--ux-accent-2) 9%, transparent), transparent 60%),
            var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        .ld-welcome::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image:
            linear-gradient(var(--ux-grid-dot) 1px, transparent 1px),
            linear-gradient(90deg, var(--ux-grid-dot) 1px, transparent 1px);
          background-size: 28px 28px;
          -webkit-mask-image: radial-gradient(60% 90% at 92% 10%, #000, transparent 70%);
          mask-image: radial-gradient(60% 90% at 92% 10%, #000, transparent 70%);
        }
        .ld-welcome-meter {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          font-size: 12px;
          font-weight: 650;
          color: var(--ux-ink-3);
        }
        .ld-welcome-meter-track {
          width: min(240px, 46vw);
          height: 6px;
          border-radius: 999px;
          background: var(--ux-surface-3);
          overflow: hidden;
        }
        .ld-welcome-meter-fill {
          height: 100%;
          border-radius: inherit;
          background: var(--ux-brand-grad);
          transform-origin: 0 50%;
          animation: ld-meter-grow .9s var(--ux-spring-progress) .25s backwards;
        }
        @keyframes ld-meter-grow {
          from { transform: scaleX(0); }
        }

        .ld-status-rail {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 4px 11px;
          border-radius: 999px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          font-size: 11.5px;
          font-weight: 650;
          color: var(--ux-ink-2);
          margin-bottom: 10px;
        }
        .ld-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--ux-mint);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--ux-mint) 22%, transparent);
        }

        .ld-welcome-text {
          flex: 1;
          min-width: 240px;
        }
        .ld-welcome h2 {
          font-size: clamp(1.45rem, 1.2rem + 0.8vw, 1.9rem);
          font-weight: 850;
          letter-spacing: -0.032em;
          line-height: 1.2;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .ld-welcome p {
          font-size: 13.8px;
          color: var(--ux-ink-2);
          margin: 0;
          line-height: 1.58;
          max-width: 600px;
        }

        .ld-welcome-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .ld-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 11px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          box-shadow: var(--ux-elev-1);
          transition: transform .4s var(--ux-spring-press), background-color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-btn:hover {
            box-shadow: var(--ux-elev-2);
            border-color: var(--ux-ink-3);
            background: var(--ux-surface-2);
          }
        }
        .ld-btn:active {
          transform: var(--ux-press);
        }
        .ld-btn.primary {
          background: var(--ux-ink);
          color: var(--ux-page);
          border-color: var(--ux-ink);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-btn.primary:hover {
            color: var(--ux-accent-ink);
            background: var(--ux-accent);
            border-color: var(--ux-accent);
            box-shadow: 0 10px 24px -10px var(--ux-brand-glow);
          }
        }

        /* Quick Action Navigation Row */
        .ld-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 1024px) {
          .ld-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .ld-quick-grid {
            grid-template-columns: 1fr;
          }
        }
        .ld-quick-card {
          padding: 18px 20px;
          border-radius: 14px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          text-decoration: none;
          color: var(--ux-ink);
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: var(--ux-elev-1), var(--ux-highlight);
          transition: border-color .25s var(--ux-ease-color), box-shadow .35s var(--ux-ease-out), translate .45s var(--ux-spring-pop), transform .4s var(--ux-spring-press);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-quick-card:hover {
            translate: 0 -3px;
            border-color: color-mix(in oklab, var(--ux-accent) 30%, var(--ux-line-2));
            box-shadow: var(--ux-elev-3), var(--ux-highlight);
          }
        }
        .ld-quick-card:active {
          transform: var(--ux-press-card);
        }
        .ld-quick-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ld-quick-ic {
          flex: none;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(180deg, color-mix(in oklab, var(--ux-accent) 14%, var(--ux-surface)), color-mix(in oklab, var(--ux-accent) 6%, var(--ux-surface)));
          border: 1px solid color-mix(in oklab, var(--ux-accent) 22%, var(--ux-line));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, .35);
          color: var(--ux-accent-text);
          display: grid;
          place-items: center;
          line-height: 0;
          transition: background-color .3s var(--ux-ease-color), color .3s var(--ux-ease-color), border-color .3s var(--ux-ease-color), transform .45s var(--ux-spring-pop);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-quick-card:hover .ld-quick-ic {
            background: var(--ux-accent);
            border-color: var(--ux-accent);
            color: var(--ux-accent-ink);
            transform: rotate(-6deg) scale(1.06);
          }
        }
        .ld-quick-ic svg {
          display: block;
          width: 20px;
          height: 20px;
        }
        .ld-quick-arrow {
          color: var(--ux-ink-3);
          transition: transform .45s var(--ux-spring-pop), color .2s var(--ux-ease-color);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-quick-card:hover .ld-quick-arrow {
            transform: translateX(3px);
            color: var(--ux-accent-text);
          }
        }
        .ld-quick-card strong {
          display: block;
          font-size: 14.5px;
          font-weight: 750;
          letter-spacing: -0.015em;
          color: var(--ux-ink);
          margin-bottom: 3px;
        }
        .ld-quick-card span:not(.ld-quick-ic) {
          display: block;
          font-size: 12.5px;
          line-height: 1.52;
          color: var(--ux-ink-3);
        }

        /* Clean Minimalist Stat Cards */
        .ld-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 14px;
        }
        .ld-stat {
          padding: 18px 20px;
          border-radius: 14px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-1), var(--ux-highlight);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: border-color .25s var(--ux-ease-color), box-shadow .35s var(--ux-ease-out);
        }
        .ld-stat:hover {
          border-color: var(--ux-line-2);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
        }
        .ld-stat[data-tone="mint"] .ld-stat-icon { color: var(--ux-mint); background: color-mix(in srgb, var(--ux-mint) 10%, var(--ux-surface)); border-color: color-mix(in srgb, var(--ux-mint) 22%, transparent); }
        .ld-stat[data-tone="accent"] .ld-stat-icon { color: var(--ux-accent-text); background: color-mix(in srgb, var(--ux-accent) 10%, var(--ux-surface)); border-color: color-mix(in srgb, var(--ux-accent) 22%, transparent); }
        .ld-stat[data-tone="sky"] .ld-stat-icon { color: var(--ux-accent-2); background: color-mix(in srgb, var(--ux-accent-2) 10%, var(--ux-surface)); border-color: color-mix(in srgb, var(--ux-accent-2) 22%, transparent); }
        .ld-stat[data-tone="warn"] .ld-stat-icon { color: var(--ux-warn); background: color-mix(in srgb, var(--ux-warn) 10%, var(--ux-surface)); border-color: color-mix(in srgb, var(--ux-warn) 22%, transparent); }
        .ld-stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          color: var(--ux-ink-2);
          display: grid;
          place-items: center;
          flex: none;
        }
        .ld-stat-icon svg {
          width: 19px;
          height: 19px;
        }
        .ld-stat-val {
          display: block;
          font-size: 28px;
          font-weight: 850;
          color: var(--ux-ink);
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
        }
        .ld-stat-lbl {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ux-ink-3);
          margin-top: 4px;
        }

        /* Two-Column Section Grid */
        .ld-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .ld-sections {
            grid-template-columns: 1fr;
          }
        }

        .ld-section {
          padding: 22px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-1), var(--ux-highlight);
          display: flex;
          flex-direction: column;
        }
        .ld-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ld-section-title {
          font-size: 15.5px;
          font-weight: 800;
          letter-spacing: -0.015em;
          color: var(--ux-ink);
        }
        .ld-section-link {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ux-accent-text);
          text-decoration: none;
          transition: color 0.18s ease;
        }
        .ld-section-link:hover {
          color: var(--ux-accent-hover);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .ld-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ld-row {
          position: relative;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-decoration: none;
          color: var(--ux-ink);
          transition: background-color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .ld-row:active {
          transform: var(--ux-press-card);
        }
        .ld-row:hover {
          background: color-mix(in oklab, var(--ux-accent) 6%, var(--ux-surface-2));
          border-color: color-mix(in oklab, var(--ux-accent) 22%, transparent);
        }
        .ld-row[data-selected="true"] {
          background: color-mix(in oklab, var(--ux-accent) 11%, var(--ux-surface-2));
          border-color: var(--ux-accent);
        }

        .ld-select-box {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 1.5px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-accent);
          display: grid;
          place-items: center;
          flex: none;
          cursor: pointer;
          transition: border-color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .ld-select-box:active {
          transform: scale(.9);
        }
        .ld-select-box svg path, .ld-select-box svg polyline {
          stroke-dasharray: 24;
          stroke-dashoffset: 0;
          animation: ld-check-draw .3s cubic-bezier(0, 0, .58, 1) backwards;
        }
        @keyframes ld-check-draw {
          from { stroke-dashoffset: 24; }
        }
        .ld-row[data-selected="true"] .ld-select-box {
          border-color: var(--ux-accent);
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
        }

        .ld-row-info {
          min-width: 0;
          flex: 1;
        }
        .ld-row-name {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ux-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ld-row-sub {
          font-size: 11.8px;
          color: var(--ux-ink-3);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-variant-numeric: tabular-nums;
        }
        .ld-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 750;
          background: var(--ux-surface-3);
          color: var(--ux-ink-2);
          flex: none;
        }
        .ld-badge.ok {
          background: color-mix(in oklab, var(--ux-mint) 14%, transparent);
          color: var(--ux-mint);
        }
        .ld-badge.draft {
          background: color-mix(in oklab, var(--ux-warn) 14%, transparent);
          color: var(--ux-warn);
        }

        .ld-empty {
          padding: 32px 20px;
          text-align: center;
          color: var(--ux-ink-3);
          font-size: 13px;
          border-radius: 14px;
          background: var(--ux-surface-2);
          border: 1px dashed var(--ux-line-2);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .ld-empty-ic {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line-2);
          color: var(--ux-accent-text);
          box-shadow: var(--ux-elev-1);
        }
        .ld-empty b {
          color: var(--ux-ink);
        }
        .ld-empty-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 13px;
          border-radius: 9px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line-2);
          color: var(--ux-ink);
          font-size: 12.5px;
          font-weight: 700;
          text-decoration: none;
          transition: border-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .ld-empty-cta:hover {
          border-color: var(--ux-accent);
          color: var(--ux-accent-text);
        }
        .ld-empty-cta:active {
          transform: var(--ux-press);
        }

        .ld-today {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
          gap: 14px;
        }
        @media (max-width: 900px) {
          .ld-today { grid-template-columns: 1fr; }
        }
        .ld-today-card {
          padding: 18px 20px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-1), var(--ux-highlight);
          display: flex;
          flex-direction: column;
          gap: 10px;
          text-decoration: none;
          color: var(--ux-ink);
        }
        .ld-today-due {
          background:
            radial-gradient(90% 120% at 100% 0%, color-mix(in srgb, var(--ux-accent) 12%, transparent), transparent 65%),
            var(--ux-surface);
          transition: box-shadow .35s var(--ux-ease-out), translate .45s var(--ux-spring-pop);
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-today-due:hover { translate: 0 -3px; box-shadow: var(--ux-elev-3), var(--ux-highlight); }
        }
        .ld-today-num { font-size: 34px; font-weight: 900; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
        .ld-today-sub { font-size: 12.5px; font-weight: 650; color: var(--ux-ink-3); display: flex; gap: 10px; flex-wrap: wrap; }
        .ld-today-sub b { color: var(--ux-warn); }
        .ld-assign { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--ux-surface-2); text-decoration: none; color: var(--ux-ink); transition: background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press); }
        .ld-assign:hover { background: color-mix(in oklab, var(--ux-accent) 6%, var(--ux-surface-2)); }
        .ld-assign:active { transform: var(--ux-press-card); }
        .ld-assign-info { flex: 1; min-width: 0; }
        .ld-assign-info b { display: block; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ld-assign-info span { font-size: 11.8px; color: var(--ux-ink-3); }
        .ld-more { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        @media (max-width: 760px) { .ld-more { grid-template-columns: 1fr; } }

        /* Lucian #178 Bulk Selection Dock */
        .u178-dock {
          position: fixed;
          bottom: 24px;
          left: 0;
          right: 0;
          margin: 0 auto;
          width: fit-content;
          z-index: 85;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 16px;
          border-radius: 14px;
          background: var(--ux-ink);
          color: var(--ux-page);
          box-shadow: var(--ux-elev-4), 0 0 0 1px var(--ux-line);
          font-size: 13px;
          font-weight: 700;
        }
        .u178-dock[hidden] {
          display: none !important;
        }
        .u178-count {
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .u178-count span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ux-mint);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--ux-mint) 30%, transparent);
        }
        .u178-btn {
          border: 0;
          border-radius: 8px;
          padding: 7px 13px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          background: var(--ux-page);
          color: var(--ux-ink);
          transition: transform .4s var(--ux-spring-press), opacity 0.2s ease;
        }
        .u178-btn:hover {
          opacity: 0.92;
        }
        .u178-btn:active {
          transform: scale(0.96);
        }
        .u178-clear {
          border: 0;
          background: none;
          color: color-mix(in srgb, var(--ux-page) 78%, transparent);
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          padding: 4px 6px;
        }
        .u178-clear:hover {
          color: var(--ux-page);
        }

        @media (max-width: 768px) {
          .ld-welcome {
            padding: 20px;
          }
          .u178-dock {
            bottom: calc(78px + env(safe-area-inset-bottom));
            width: calc(100vw - 32px);
            justify-content: space-between;
          }
          .ld-welcome::after {
            display: none;
          }
        }
      `}</style>

      {/* Welcome Card */}
      <div className="ld-welcome">
        <div className="ld-welcome-text">
          <div className="ld-status-rail">
            <span className="ld-status-dot" aria-hidden="true" />
            <span>Hệ thống sẵn sàng · Đọc chuẩn công thức STEM</span>
          </div>
          <h2>
            {greeting && firstName ? (
              <>
                {greeting}, <span className="sf-grad-text">{firstName}</span>
              </>
            ) : (
              'Bảng điều khiển học tập'
            )}
          </h2>
          <p>
            Quản lý tập trung tài liệu nguồn, ngân hàng câu hỏi đã đối chiếu trích dẫn và các phòng thi đang mở.
          </p>
          {docs.length > 0 && (
            <div className="ld-welcome-meter">
              <div
                className="ld-welcome-meter-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={readyRatio}
                aria-label="Tỷ lệ tài liệu sẵn sàng tạo đề"
              >
                <div className="ld-welcome-meter-fill" style={{ width: `${readyRatio}%` }} />
              </div>
              <span className="tabular">{readyRatio}% tài liệu sẵn sàng tạo đề</span>
            </div>
          )}
        </div>
        <div className="ld-welcome-actions">
          <Link href="/documents" className="ld-btn primary">
            <AppIcon name="documents" width="16" height="16" />
            <span>Tải tài liệu</span>
          </Link>
          <Link href="/quizzes/create" className="ld-btn">
            <AppIcon name="create" width="16" height="16" />
            <span>Tạo đề AI</span>
          </Link>
        </div>
      </div>

      {/* 4 Quick Action Cards */}
      <div className="ld-quick-grid sf-stagger" aria-label="Lối tắt thao tác nhanh">
        {QUICK_ACTIONS.map((item) => (
          <Link key={item.href} href={item.href} className="ld-quick-card sf-spot">
            <div className="ld-quick-top">
              <span className="ld-quick-ic" aria-hidden="true">
                <AppIcon name={item.icon} />
              </span>
              <svg className="ld-quick-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
            <div>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </div>
          </Link>
        ))}
      </div>

      {(studyDue > 0 || assignments.length > 0 || streak > 0) && (
        <div className="ld-today sf-stagger" aria-label="Việc hôm nay">
          <Link href="/study" className="ld-today-card ld-today-due sf-spot">
            <div className="ld-section-title">Ôn tập hôm nay</div>
            <div className="ld-today-num">{studyDue}</div>
            <div className="ld-today-sub"><span>thẻ đến hạn</span>{streak > 0 && <span><b>{streak}</b> ngày liên tiếp</span>}</div>
          </Link>
          <section className="ld-today-card" aria-label="Bài được giao">
            <div className="ld-section-head" style={{ marginBottom: 0 }}>
              <div className="ld-section-title">Bài được giao {todo.length > 0 && <span className="ld-badge draft" style={{ marginLeft: 6 }}>{todo.length} chưa làm</span>}</div>
              <Link href="/classes" className="ld-section-link">Lớp học →</Link>
            </div>
            {assignments.length ? assignments.slice(0, 4).map(a => (
              <Link key={a.id} href={a.shareCode ? `/quizzes/take?code=${a.shareCode}` : '/classes'} className="ld-assign">
                <div className="ld-assign-info"><b>{a.title}</b><span>{a.className} · {now === null ? (a.dueAt ? 'Có hạn nộp' : 'Không giới hạn') : dueLabel(a.dueAt)}</span></div>
                <span className={`ld-badge ${a.done ? 'ok' : 'draft'}`}>{a.done ? 'Đã nộp' : 'Làm bài'}</span>
              </Link>
            )) : <p style={{ margin: 0, fontSize: 13, color: 'var(--ux-ink-3)' }}>Chưa có bài được giao. Tham gia lớp bằng mã giáo viên gửi.</p>}
          </section>
        </div>
      )}

      {/* Stat Cards */}
      <div className="ld-stats sf-stagger">
        {[
          { value: docs.length, label: 'Tài liệu đã tải lên', icon: 'documents' as const, tone: 'accent' },
          { value: readyDocs.length, label: 'Tài liệu sẵn sàng tạo đề', icon: 'check' as const, tone: 'mint' },
          { value: quizzes.length, label: 'Đề thi trong ngân hàng', icon: 'quizzes' as const, tone: 'sky' },
          { value: publishedQuizzes.length, label: 'Phòng thi đang phát hành', icon: 'take' as const, tone: 'warn' },
        ].map((stat, i) => (
          <div className="ld-stat" data-tone={stat.tone} key={stat.label}>
            <div>
              <CountingNumber className="ld-stat-val" number={stat.value} delay={120 + i * 70} inView />
              <div className="ld-stat-lbl">{stat.label}</div>
            </div>
            <div className="ld-stat-icon" aria-hidden="true">
              <AppIcon name={stat.icon} />
            </div>
          </div>
        ))}
      </div>

      <div className="ld-more sf-stagger" aria-label="Công cụ học tập">
        {MORE_LINKS.map(item => (
          <Link key={item.href} href={item.href} className="ld-quick-card sf-spot" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span className="ld-quick-ic" aria-hidden="true"><AppIcon name={item.icon} /></span>
            <div style={{ flex: 1 }}><strong>{item.title}</strong><span>{item.desc}</span></div>
            <svg className="ld-quick-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        ))}
      </div>

      {/* Content Lists */}
      <div className="ld-sections sf-stagger">
        {/* Documents Section */}
        <section className="ld-section" aria-label="Tài liệu gần đây">
          <div className="ld-section-head">
            <div className="ld-section-title">Tài liệu gần đây</div>
            <Link href="/documents" className="ld-section-link">Xem tất cả →</Link>
          </div>
          <div className="ld-list">
            {docs.length === 0 ? (
              <div className="ld-empty">
                <span className="ld-empty-ic" aria-hidden="true">
                  <AppIcon name="documents" width="20" height="20" />
                </span>
                <span>Chưa có tài liệu nào. Hãy tải tệp PDF, Word hoặc ảnh chụp để hệ thống tách câu hỏi.</span>
                <Link href="/documents" className="ld-empty-cta">Tải tài liệu đầu tiên →</Link>
              </div>
            ) : (
              docs.slice(0, 5).map((doc) => {
                const isSelected = selectedDocs.has(doc.id);
                const isReady = doc.status === 'ready';
                return (
                  <Link
                    key={doc.id}
                    href={`/documents?id=${doc.id}`}
                    className="ld-row"
                    data-selected={isSelected}
                  >
                    <button
                      type="button"
                      className="ld-select-box"
                      aria-label={isSelected ? `Bỏ chọn ${doc.title}` : `Chọn ${doc.title}`}
                      aria-pressed={isSelected}
                      onClick={(e) => toggleSelectDoc(doc.id, e)}
                    >
                      {isSelected ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </button>
                    <div className="ld-row-info">
                      <div className="ld-row-name">{doc.title}</div>
                      <div className="ld-row-sub">
                        {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                        {doc.fileType ? ` · ${doc.fileType.toUpperCase()}` : ''}
                      </div>
                    </div>
                    <span className={`ld-badge ${isReady ? 'ok' : 'draft'}`}>
                      {isReady ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="12 7 12 12 15 14" />
                        </svg>
                      )}
                      {isReady ? 'Sẵn sàng' : 'Đang xử lý'}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Quizzes Section */}
        <section className="ld-section" aria-label="Đề thi và ngân hàng">
          <div className="ld-section-head">
            <div className="ld-section-title">Đề thi &amp; Ngân hàng</div>
            <Link href="/quizzes" className="ld-section-link">Xem tất cả →</Link>
          </div>
          <div className="ld-list">
            {quizzes.length === 0 ? (
              <div className="ld-empty">
                <span className="ld-empty-ic" aria-hidden="true">
                  <AppIcon name="quizzes" width="20" height="20" />
                </span>
                <span>Chưa có đề thi nào. Bắt đầu biên soạn trực quan hoặc sinh đề từ tài liệu nguồn.</span>
                <Link href="/quizzes/create" className="ld-empty-cta">Mở trình tạo đề AI →</Link>
              </div>
            ) : (
              quizzes.slice(0, 5).map((quiz) => (
                <Link key={quiz.id} href={`/quizzes?id=${quiz.id}`} className="ld-row">
                  <div className="ld-row-info">
                    <div className="ld-row-name">{quiz.title}</div>
                    <div className="ld-row-sub">
                      Thời lượng: {quiz.durationMinutes ?? 0} phút
                      {quiz.shareCode ? ` · Mã: ${quiz.shareCode}` : ''}
                    </div>
                  </div>
                  <span className={`ld-badge ${quiz.isPublished ? 'ok' : 'draft'}`}>
                    {quiz.isPublished ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    )}
                    {quiz.isPublished ? 'Đang mở' : 'Bản nháp'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Lucian #178 Bulk Selection Dock — rises on spring.toast, leaves on transition.dismiss */}
      <ReducedMotionConfig>
        <AnimatePresence>
      {selectedDocs.size > 0 && (
        <motion.div
          key="dock"
          className="u178-dock"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, filter: 'blur(4px)', transform: reduce ? 'none' : `translate3d(0, 18px, 0) scale(${motionScale.toast})` }}
          animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0, 0, 0) scale(1)', transition: { ...dockIn, opacity: dockFade, filter: dockFade } }}
          exit={{ opacity: 0, filter: 'blur(4px)', transform: reduce ? 'none' : `translate3d(0, 18px, 0) scale(${motionScale.toast})`, transition: dockOut }}
        >
          <div className="u178-count">
            <span aria-hidden="true" />
            {selectedDocs.size} tài liệu đã chọn
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/quizzes/create?docIds=${Array.from(selectedDocs).join(',')}`} className="u178-btn">
              Tạo đề từ mục chọn ↗
            </Link>
            <button type="button" className="u178-clear" onClick={clearSelection}>
              Bỏ chọn
            </button>
          </div>
        </motion.div>
      )}
        </AnimatePresence>
      </ReducedMotionConfig>
    </div>
  );
}

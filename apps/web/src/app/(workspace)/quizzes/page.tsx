'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ReducedMotionConfig, spring, useTempoTransition } from '@animate-ui/react/utils/motion';
import { QuizSettingsModal } from '@/components/lucian/QuizSettingsModal';
import { ShareDialog } from '@/components/ui/ShareDialog';

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'published', label: 'Đã phát hành' },
  { id: 'draft', label: 'Bản nháp' },
] as const;

export default function QuizzesListPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const tabGlide = useTempoTransition(spring.selection);

  const fetchQuizzes = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/quizzes');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Chưa tải được ngân hàng đề.');
      setQuizzes(data.items || []);
    } catch(err) { setError((err as Error).message); }
    setLoading(false);
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const [customQuiz, setCustomQuiz] = useState<any | null>(null);
  const [shareQuiz, setShareQuiz] = useState<{ code: string; title: string } | null>(null);
  const openCustomize = (quiz: any) => setCustomQuiz(quiz);

  const filteredQuizzes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return quizzes.filter((quiz) => {
      const matchSearch = !q || quiz.title.toLowerCase().includes(q) || (quiz.shareCode && quiz.shareCode.toLowerCase().includes(q));
      const matchFilter = filter === 'all' || (filter === 'published' ? quiz.isPublished : !quiz.isPublished);
      return matchSearch && matchFilter;
    });
  }, [quizzes, search, filter]);

  const counts = useMemo(() => ({
    all: quizzes.length,
    published: quizzes.filter(q => q.isPublished).length,
    draft: quizzes.filter(q => !q.isPublished).length,
  }), [quizzes]);

  return (
    <div className="ux qz-studio" style={{ padding: '8px 12px 48px' }}>
      <style>{`
        .qz-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .qz-eyebrow {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .14em;
          color: var(--ux-accent-text);
          margin-bottom: 8px;
        }
        .qz-title-group h1 {
          font-size: clamp(24px, 2.4vw, 30px);
          font-weight: 850;
          letter-spacing: -0.035em;
          line-height: 1.2;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .qz-title-group p {
          font-size: 14px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .qz-create-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 20px;
          border-radius: 11px;
          background: var(--ux-ink);
          color: var(--ux-page);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 700;
          box-shadow: var(--ux-elev-1);
          transition: background-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out), transform .4s var(--ux-spring-press);
        }
        .qz-create-btn svg {
          transition: transform .45s var(--ux-spring-pop);
        }
        @media (hover: hover) and (pointer: fine) {
          .qz-create-btn:hover {
            background: var(--ux-accent);
            color: var(--ux-accent-ink);
            box-shadow: 0 10px 24px -10px var(--ux-brand-glow);
          }
          .qz-create-btn:hover svg {
            transform: rotate(90deg);
          }
        }
        .qz-create-btn:active {
          transform: var(--ux-press);
        }

        .qz-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .qz-search-wrap {
          position: relative;
          flex: 1;
          min-width: 260px;
          max-width: 440px;
        }
        .qz-search-input {
          width: 100%;
          height: 42px;
          border-radius: 12px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          padding: 0 64px 0 38px;
          font-size: 13px;
          color: var(--ux-ink);
          box-shadow: var(--ux-elev-1);
          transition: border-color .2s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out);
        }
        .qz-search-input:focus {
          border-color: var(--ux-accent);
          outline: none;
          box-shadow: var(--ux-ring);
        }
        .qz-search-tail {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .qz-search-clear {
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: var(--ux-surface-2);
          color: var(--ux-ink-3);
          cursor: pointer;
          animation: sf-pop-in .3s var(--ux-spring-pop) backwards;
          transition: color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color);
        }
        .qz-search-clear:hover {
          color: var(--ux-ink);
          background: var(--ux-surface-3);
        }
        .qz-search-wrap:focus-within .sf-kbd {
          opacity: 0;
        }
        .qz-search-wrap .sf-kbd {
          transition: opacity .2s var(--ux-ease-out);
        }
        .qz-search-ic {
          position: absolute;
          left: 12px;
          top: 12px;
          color: var(--ux-ink-3);
        }

        .qz-tabs {
          display: flex;
          gap: 4px;
          background: var(--ux-surface-2);
          padding: 4px;
          border-radius: 12px;
          border: 1px solid var(--ux-line);
        }
        .qz-tab {
          position: relative;
          padding: 7px 14px;
          border-radius: 8px;
          border: 0;
          background: transparent;
          color: var(--ux-ink-2);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-tab:hover {
          color: var(--ux-ink);
        }
        .qz-tab:active {
          transform: var(--ux-press);
        }
        .qz-tab.active {
          color: var(--ux-ink);
        }
        .qz-tab-label {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .qz-tab-count {
          min-width: 20px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          font-size: 10.5px;
          font-variant-numeric: tabular-nums;
          background: var(--ux-surface-3);
          color: var(--ux-ink-3);
          transition: background-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color);
        }
        .qz-tab.active .qz-tab-count {
          background: var(--ux-accent-soft);
          color: var(--ux-accent-text);
        }
        .qz-tab-hl {
          position: absolute;
          inset: 0;
          border-radius: 8px;
          background: var(--ux-surface);
          box-shadow: 0 1px 2px var(--ux-shadow-c), 0 4px 12px -6px var(--ux-shadow-c), var(--ux-highlight);
        }

        .qz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }
        .qz-card {
          padding: 22px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-1), var(--ux-highlight);
          display: flex;
          flex-direction: column;
          gap: 14px;
          content-visibility: auto;
          contain-intrinsic-size: auto 220px;
          transition: box-shadow .35s var(--ux-ease-out), border-color .25s var(--ux-ease-color), translate .45s var(--ux-spring-pop);
          position: relative;
        }
        @media (hover: hover) and (pointer: fine) {
          .qz-card:hover {
            translate: 0 -3px;
            box-shadow: var(--ux-elev-3), var(--ux-highlight);
            border-color: color-mix(in srgb, var(--ux-accent) 22%, var(--ux-line-2));
          }
        }
        .qz-skel-card {
          padding: 22px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 228px;
        }
        .qz-empty {
          padding: 56px 24px;
          text-align: center;
          background:
            radial-gradient(60% 80% at 50% 0%, color-mix(in srgb, var(--ux-accent) 8%, transparent), transparent 70%),
            var(--ux-surface);
          border-radius: 24px;
          border: 1px dashed var(--ux-line-2);
        }
        .qz-empty-ic {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line-2);
          display: grid;
          place-items: center;
          color: var(--ux-accent-text);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
          animation: sf-pop-in .5s var(--ux-spring-pop) .1s backwards;
        }
        .qz-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .badge-pub {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: color-mix(in srgb, var(--ux-mint) 15%, transparent);
          color: var(--ux-mint);
        }
        .badge-draft {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: var(--ux-surface-2);
          color: var(--ux-ink-3);
        }
        .qz-duration {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--ux-ink-3);
          font-weight: 600;
        }
        .qz-name {
          font-size: 17px;
          font-weight: 800;
          line-height: 1.45;
          color: var(--ux-ink);
          margin-top: 2px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .qz-desc {
          margin: 0;
          font-size: 13px;
          color: var(--ux-ink-2);
          line-height: 1.6;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .share-pill {
          padding: 10px 14px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          font-size: 12.5px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .share-pill-code {
          font-family: var(--font-mono, monospace);
          font-weight: 800;
          letter-spacing: 0.05em;
          color: var(--ux-accent);
        }
        .share-pill-btn {
          border: 0;
          background: transparent;
          color: var(--ux-ink-2);
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 6px;
          transition: color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .share-pill-btn:hover {
          color: var(--ux-accent);
          background: var(--ux-surface);
        }
        .share-pill-btn:active {
          transform: var(--ux-press);
        }
        .share-pill-btn[data-copied="true"] {
          color: var(--ux-mint);
        }

        .qz-card-tools {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .qz-tool {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 9px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface);
          color: var(--ux-ink-2);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-tool:hover { color: var(--ux-accent-text); border-color: color-mix(in srgb, var(--ux-accent) 40%, var(--ux-line-2)); background: var(--ux-accent-soft); }
        .qz-tool:active { transform: var(--ux-press); }
        .qz-limits { display: flex; gap: 10px; flex-wrap: wrap; font-size: 11.5px; font-weight: 650; color: var(--ux-ink-3); }
        .qz-card-foot {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--ux-line);
        }
        .qz-btn-take {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          border-radius: 12px;
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 700;
          box-shadow: 0 6px 16px -8px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.18);
          transition: background-color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out), transform .4s var(--ux-spring-press);
        }
        .qz-btn-take svg {
          transition: transform .45s var(--ux-spring-pop);
        }
        @media (hover: hover) and (pointer: fine) {
          .qz-btn-take:hover {
            background: var(--ux-accent-hover);
            box-shadow: 0 10px 24px -8px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.18);
          }
          .qz-btn-take:hover svg {
            transform: translateX(2px) scale(1.08);
          }
        }
        .qz-btn-take:active {
          transform: var(--ux-press);
        }
        .qz-btn-edit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px 14px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          color: var(--ux-ink);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          border: 1px solid var(--ux-line-2);
          cursor: pointer;
          transition: border-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-btn-edit svg {
          transition: transform .6s var(--ux-spring-pop);
        }
        .qz-btn-edit:hover {
          border-color: var(--ux-accent);
          color: var(--ux-accent);
        }
        @media (hover: hover) and (pointer: fine) {
          .qz-btn-edit:hover svg {
            transform: rotate(45deg);
          }
        }
        .qz-btn-edit:active {
          transform: var(--ux-press);
        }

        .badge-practice {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: color-mix(in srgb, var(--ux-mint) 18%, transparent);
          color: var(--ux-mint);
          border: 1px solid color-mix(in srgb, var(--ux-mint) 32%, transparent);
        }
        .badge-exam {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: color-mix(in srgb, var(--ux-accent) 18%, transparent);
          color: var(--ux-accent);
          border: 1px solid color-mix(in srgb, var(--ux-accent) 32%, transparent);
        }

        .qz-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: sf-fade-in .3s var(--ux-ease-soft) backwards;
        }
        .qz-modal {
          width: 100%;
          max-width: 580px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          border-radius: 24px;
          box-shadow: var(--ux-elev-4), var(--ux-highlight);
          display: flex;
          flex-direction: column;
          scrollbar-width: thin;
          animation: sf-fade-in .3s var(--ux-ease-soft) backwards, sf-dialog-in .6s var(--ux-spring-entrance) backwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .qz-modal { animation: sf-fade-in .2s ease-out backwards; }
        }
        @keyframes qzFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes qzScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .qz-modal-head {
          padding: 20px 24px;
          border-bottom: 1px solid var(--ux-line);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .qz-modal-head h2 {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          color: var(--ux-ink);
        }
        .qz-modal-close {
          border: 0;
          background: var(--ux-surface-2);
          color: var(--ux-ink-2);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          cursor: pointer;
          font-size: 18px;
          transition: background-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), transform .45s var(--ux-spring-pop);
        }
        .qz-modal-close:hover {
          background: var(--ux-surface-3);
          color: var(--ux-ink);
          transform: rotate(90deg);
        }

        .qz-modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .qz-mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .qz-mode-card {
          padding: 16px;
          border-radius: 16px;
          border: 2px solid var(--ux-line);
          background: var(--ux-surface-2);
          cursor: pointer;
          text-align: left;
          transition: border-color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out), transform .4s var(--ux-spring-press);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qz-mode-card:hover {
          border-color: color-mix(in srgb, var(--ux-accent) 55%, var(--ux-line));
        }
        .qz-mode-card:active {
          transform: var(--ux-press-card);
        }
        .qz-mode-card.active {
          border-color: var(--ux-accent);
          background: color-mix(in srgb, var(--ux-accent) 12%, var(--ux-surface));
          box-shadow: 0 4px 16px color-mix(in srgb, var(--ux-accent) 20%, transparent);
        }
        .qz-mode-title {
          font-size: 14.5px;
          font-weight: 800;
          color: var(--ux-ink);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .qz-mode-desc {
          font-size: 12px;
          color: var(--ux-ink-2);
          line-height: 1.5;
        }

        .qz-form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .qz-form-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink);
        }
        .qz-form-input, .qz-form-textarea {
          width: 100%;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          padding: 10px 14px;
          font-size: 13.5px;
          color: var(--ux-ink);
          font-family: inherit;
        }
        .qz-form-input, .qz-form-textarea {
          transition: border-color .2s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out), background-color .2s var(--ux-ease-color);
        }
        .qz-form-input:focus, .qz-form-textarea:focus {
          border-color: var(--ux-accent);
          background: var(--ux-surface);
          box-shadow: var(--ux-ring);
          outline: none;
        }
        .qz-form-textarea {
          min-height: 72px;
          resize: vertical;
        }

        .qz-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--ux-ink);
          cursor: pointer;
        }
        .qz-checkbox-label input {
          width: 17px;
          height: 17px;
          accent-color: var(--ux-accent);
          cursor: pointer;
        }

        .qz-edit-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px dashed var(--ux-accent);
          color: var(--ux-accent);
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          transition: background 0.2s;
        }
        .qz-edit-link:hover {
          background: color-mix(in srgb, var(--ux-accent) 10%, var(--ux-surface-2));
        }

        .qz-modal-foot {
          padding: 16px 24px;
          border-top: 1px solid var(--ux-line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .qz-btn-cancel {
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid var(--ux-line-2);
          background: transparent;
          color: var(--ux-ink-2);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-btn-cancel:hover { background: var(--ux-surface-2); }
        .qz-btn-cancel:active, .qz-btn-unpub:active { transform: var(--ux-press); }
        .qz-btn-save {
          padding: 10px 22px;
          border-radius: 12px;
          background: var(--ux-accent);
          border: 0;
          color: var(--ux-accent-ink);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 22px -10px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, .18);
          transition: background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-btn-save:hover:not(:disabled) {
          background: var(--ux-accent-hover);
        }
        .qz-btn-save:active:not(:disabled) {
          transform: var(--ux-press);
        }
        .qz-btn-unpub {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--ux-danger);
          background: color-mix(in srgb, var(--ux-danger) 10%, transparent);
          color: var(--ux-danger);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .qz-btn-unpub:hover { background: color-mix(in srgb, var(--ux-danger) 16%, transparent); }
      `}</style>

      {/* Header */}
      <div className="qz-header">
        <div className="qz-title-group">
          <span className="qz-eyebrow">NGÂN HÀNG ĐỀ</span>
          <h1>Ngân hàng câu hỏi & Đề thi</h1>
          <p>Quản lý các bộ đề đã tạo, xuất bản bài thi và chia sẻ mã tham gia cho học sinh.</p>
        </div>
        <Link href="/quizzes/create" className="qz-create-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo đề kiểm tra mới
        </Link>
      </div>

      {/* Toolbar: Search + Filter Tabs */}
      <div className="qz-toolbar">
        <div className="qz-search-wrap">
          <svg className="qz-search-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="qz-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && search) {
                e.preventDefault();
                setSearch('');
              }
            }}
            placeholder="Tìm theo tên đề thi hoặc mã tham gia…"
            aria-label="Tìm kiếm đề thi"
            aria-keyshortcuts="/"
            data-hotkey="/"
          />
          <span className="qz-search-tail">
            {search ? (
              <button type="button" className="qz-search-clear" onClick={() => setSearch('')} aria-label="Xóa từ khóa tìm kiếm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            ) : (
              <kbd className="sf-kbd" aria-hidden="true">/</kbd>
            )}
          </span>
        </div>

        <ReducedMotionConfig>
          <div className="qz-tabs" role="tablist" aria-label="Lọc trạng thái đề thi">
            {FILTERS.map((item) => {
              const selected = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`qz-tab${selected ? ' active' : ''}`}
                  onClick={() => setFilter(item.id)}
                >
                  {selected && <motion.span layoutId="qz-tab-hl" className="qz-tab-hl" transition={tabGlide} aria-hidden="true" />}
                  <span className="qz-tab-label">
                    {item.label}
                    <span className="qz-tab-count">{counts[item.id]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </ReducedMotionConfig>
      </div>

      {error && (
        <div className="sf-alert" role="alert" style={{ padding: '16px', borderRadius: '12px', background: 'color-mix(in srgb, var(--ux-danger) 10%, var(--ux-surface))', color: 'var(--ux-danger)', border: '1px solid var(--ux-danger)', marginBottom: '20px' }}>
          {error} <button style={{ marginLeft: '10px', textDecoration: 'underline', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', fontWeight: 700 }} onClick={() => void fetchQuizzes()}>Thử tải lại</button>
        </div>
      )}

      {loading ? (
        <div className="qz-grid" role="status" aria-label="Đang tải danh sách ngân hàng đề thi">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="qz-skel-card" aria-hidden="true">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="sf-skel" style={{ width: 96, height: 22, borderRadius: 999 }} />
                <div className="sf-skel" style={{ width: 54, height: 16 }} />
              </div>
              <div className="sf-skel" style={{ width: '78%', height: 20 }} />
              <div className="sf-skel" style={{ width: '56%', height: 14, opacity: 0.7 }} />
              <div className="sf-skel" style={{ height: 42, borderRadius: 12, opacity: 0.6 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
                <div className="sf-skel" style={{ flex: 1, height: 42, borderRadius: 12 }} />
                <div className="sf-skel" style={{ width: 104, height: 42, borderRadius: 12 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="qz-empty">
          <div className="qz-empty-ic">
            {search ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8.5" y1="11" x2="13.5" y2="11"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>
            )}
          </div>
          <b style={{ fontSize: '16px', color: 'var(--ux-ink)', display: 'block', marginBottom: '6px' }}>
            {search ? 'Không tìm thấy đề thi phù hợp' : 'Chưa có đề thi nào trong ngân hàng'}
          </b>
          <p style={{ fontSize: '13px', color: 'var(--ux-ink-3)', margin: '0 0 16px' }}>
            {search ? 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.' : 'Hãy tạo đề thi mới bằng AI từ tài liệu học tập của bạn.'}
          </p>
          <Link href="/quizzes/create" className="qz-create-btn" style={{ display: 'inline-flex' }}>
            Tạo đề kiểm tra mới
          </Link>
        </div>
      ) : (
        <div className="qz-grid sf-stagger" key={`${filter}-${search ? 'q' : ''}`}>
          {filteredQuizzes.map((quiz) => {
            const isPractice = quiz.description?.includes('[mode:practice]');
            const displayDesc = (quiz.description || 'Bài kiểm tra ôn tập và đánh giá kiến thức.').replace(/\[mode:(?:practice|exam)\]\s*/g, '');
            return (
            <div key={quiz.id} className="qz-card sf-spot">
              <div className="qz-card-head">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={quiz.isPublished ? 'badge-pub' : 'badge-draft'}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: quiz.isPublished ? 'var(--ux-mint)' : 'var(--ux-ink-3)' }} />
                    {quiz.isPublished ? 'Đã phát hành' : 'Bản nháp'}
                  </span>
                  {quiz.isPublished && (
                    <span className={isPractice ? 'badge-practice' : 'badge-exam'}>
                      {isPractice ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                          </svg>
                          Luyện tập
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="16" rx="2" />
                            <line x1="8" y1="10" x2="16" y2="10" />
                            <line x1="8" y1="14" x2="13" y2="14" />
                          </svg>
                          Bài kiểm tra
                        </>
                      )}
                    </span>
                  )}
                </div>
                <span className="qz-duration">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {quiz.durationMinutes >= 1440 ? 'Tự do' : `${quiz.durationMinutes || 15} phút`}
                </span>
              </div>

              <div>
                <h3 className="qz-name" title={quiz.title}>{quiz.title}</h3>
                <p className="qz-desc">{displayDesc}</p>
              </div>

              {quiz.shareCode && (
                <div className="share-pill">
                  <span>Mã thi: <b className="share-pill-code">{quiz.shareCode}</b></span>
                  <button
                    type="button"
                    className="share-pill-btn"
                    data-copied={copiedCode === quiz.shareCode}
                    onClick={() => copyToClipboard(quiz.shareCode)}
                    title="Sao chép mã đề thi"
                  >
                    {copiedCode === quiz.shareCode ? (
                      <span key="copied" className="sf-title-swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        Đã chép!
                      </span>
                    ) : (
                      <span key="copy" className="sf-title-swap" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        Sao chép mã
                      </span>
                    )}
                  </button>
                </div>
              )}

              {(quiz.maxAttempts || quiz.opensAt || quiz.deadline) && (
                <div className="qz-limits">
                  {quiz.opensAt && <span>Mở: {new Date(quiz.opensAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  {quiz.deadline && <span>Đóng: {new Date(quiz.deadline).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  {quiz.maxAttempts && <span>Tối đa {quiz.maxAttempts} lượt</span>}
                </div>
              )}

              <div className="qz-card-tools">
                {quiz.isPublished && quiz.shareCode && (
                  <button type="button" className="qz-tool" onClick={() => setShareQuiz({ code: quiz.shareCode, title: quiz.title })}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-7" /></svg>
                    Chia sẻ QR
                  </button>
                )}
                {quiz.isPublished && (
                  <Link className="qz-tool" href={`/quizzes/${quiz.id}/analytics`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18" /><rect x="5" y="11" width="3" height="7" /><rect x="10.5" y="7" width="3" height="11" /><rect x="16" y="13" width="3" height="5" /></svg>
                    Thống kê
                  </Link>
                )}
                <Link className="qz-tool" href={`/quizzes/${quiz.id}/print`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  In · Word
                </Link>
              </div>

              <div className="qz-card-foot">
                {quiz.shareCode && (
                  <Link href={`/quizzes/take?code=${quiz.shareCode}`} className="qz-btn-take">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    {isPractice ? 'Luyện tập' : 'Làm bài thi'}
                  </Link>
                )}
                {quiz.isPublished ? (
                  <button
                    type="button"
                    className="qz-btn-edit"
                    onClick={() => openCustomize(quiz)}
                    title="Tùy chỉnh chế độ bài thi hoặc bài luyện tập, chỉnh sửa thông tin"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Tùy chỉnh
                  </button>
                ) : (
                  <Link
                    href={`/quizzes/create?quizId=${quiz.id}`}
                    className="qz-btn-edit"
                    title="Biên soạn tiếp đề thi"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    Biên soạn
                  </Link>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {shareQuiz && <ShareDialog code={shareQuiz.code} title={shareQuiz.title} onClose={() => setShareQuiz(null)} />}

      {customQuiz && (
        <QuizSettingsModal
          quiz={customQuiz}
          onClose={() => setCustomQuiz(null)}
          onSaved={() => {
            setCustomQuiz(null);
            void fetchQuizzes();
          }}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  blur,
  ReducedMotionConfig,
  shift,
  transition as motionTokens,
  useShouldReduceMotion,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { MathText } from '@/components/common/MathText';
import { useFeedback, useOnline } from '@/components/ui/Feedback';
import { MatchingInput, OrderingInput, PracticeFeedback, QuestionAudio, type CheckFeedback } from '@/components/exam/QuestionInputs';

const hasAnswer = (values?: string[]) => Array.isArray(values) && values.some((value) => value !== '');

export default function TakeQuizPage() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [shareCode, setShareCode] = useState(initialCode);
  const [attempt, setAttempt] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'offline'>('saved');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeNotice, setTimeNotice] = useState('');
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [checked, setChecked] = useState<Record<string, CheckFeedback>>({});
  const [checking, setChecking] = useState(false);
  const [deckBusy, setDeckBusy] = useState(false);
  const online = useOnline();
  const router = useRouter();
  const { toast } = useFeedback();
  const reduceMotion = useShouldReduceMotion();
  const panelIn = useTempoTransition(motionTokens.panelIn);
  const panelOut = useTempoTransition(motionTokens.panelOut);
  const directionRef = useRef<1 | -1>(1);
  const confirmOpener = useRef<HTMLButtonElement | null>(null);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const lastSavedRef = useRef<Record<string, string[]>>({});

  // Start Exam (busy flag wraps the original flow)
  const handleStart = async (codeToUse?: string, retry = false) => {
    setStarting(true);
    try {
      await startAttempt(codeToUse, retry);
    } finally {
      setStarting(false);
    }
  };

  const startAttempt = async (codeToUse?: string, retry = false) => {
    const raw = codeToUse || shareCode;
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setErrorMsg('');
    setSubmitError('');
    if (retry) {
      setResult(null);
      setAnswers({});
      setCurrentIdx(0);
      lastSavedRef.current = {};
    }

    try {
      const res = await fetch('/api/attempts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareCode: code, retry }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error?.message || 'Không thể bắt đầu làm bài');
        return;
      }

      setAttempt(data);
      setChecked(data.checked || {});
      let initialAnswers: Record<string, string[]> = data.answers || {};
      try {
        const cached = localStorage.getItem(`sf_attempt_${data.attemptId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            initialAnswers = { ...initialAnswers, ...parsed };
          }
        }
      } catch {}

      if (Object.keys(initialAnswers).length > 0) {
        setAnswers(initialAnswers);
      }
      lastSavedRef.current = data.answers || {};

      if (data.isSubmitted) {
        setResult(data);
      }
      const remaining = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeftSec(remaining);
    } catch (e: any) {
      setErrorMsg(e.message || 'Lỗi kết nối máy chủ');
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleStart(initialCode);
    }
  }, [initialCode]);

  // Countdown timer calculated directly from server expiresAt with auto-submit jitter
  useEffect(() => {
    if (!attempt || result) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // Random jitter (0 - 1500ms) prevents thundering herd when 100 students reach 0:00 simultaneously
        const jitter = Math.floor(Math.random() * 1500);
        setTimeout(() => {
          handleSubmit();
        }, jitter);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, result]);

  // Delta autosave: Only send dirty (modified) answers to drastically cut DB load and query duration
  useEffect(() => {
    if (!attempt || result || Object.keys(answers).length === 0) return;

    // Cache locally immediately on each change
    try {
      localStorage.setItem(`sf_attempt_${attempt.attemptId}`, JSON.stringify(answers));
    } catch {}
    if (!online) { setSaveStatus('offline'); return; }

    const saveTimer = setTimeout(async () => {
      // Find modified answers since last successful save
      const dirty: Record<string, string[]> = {};
      for (const [qId, vals] of Object.entries(answers)) {
        const saved = lastSavedRef.current[qId];
        if (!saved || JSON.stringify(saved) !== JSON.stringify(vals)) {
          dirty[qId] = vals;
        }
      }

      if (Object.keys(dirty).length === 0) {
        return; // Already synchronized
      }

      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/save-answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: dirty }),
        });
        if (res.ok) {
          lastSavedRef.current = { ...lastSavedRef.current, ...dirty };
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [answers, attempt, result, online]);

  // Flags ("xem lại sau") live on this device only
  useEffect(() => {
    if (!attempt) return;
    try { setFlags(new Set(JSON.parse(localStorage.getItem(`sf_flags_${attempt.attemptId}`) || '[]'))); } catch { setFlags(new Set()); }
  }, [attempt?.attemptId]);
  const toggleFlag = (questionId: string) => {
    setFlags(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId); else next.add(questionId);
      try { localStorage.setItem(`sf_flags_${attempt?.attemptId}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Practice mode: check one answer now (server reveals the key only for practice quizzes)
  const checkAnswer = async (questionId: string) => {
    const values = answers[questionId] || [];
    if (!attempt || checking || !values.some(v => v !== '')) return;
    setChecking(true);
    try {
      const res = await fetch(`/api/attempts/${attempt.attemptId}/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, values }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa kiểm tra được đáp án.');
      setChecked(prev => ({ ...prev, [questionId]: data }));
      lastSavedRef.current = { ...lastSavedRef.current, [questionId]: values };
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally { setChecking(false); }
  };

  // Result: wrong answers become a spaced-repetition deck
  const practiceWrongAnswers = async () => {
    if (!attempt || deckBusy) return;
    setDeckBusy(true);
    try {
      const res = await fetch('/api/study/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'attempt', attemptId: attempt.attemptId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tạo được bộ ôn tập.');
      toast(data.created ? `Đã thêm ${data.created} thẻ ôn tập từ câu sai.` : 'Các câu sai đã có trong bộ ôn tập.', 'success');
      router.push(`/study?deck=${encodeURIComponent(data.deck)}`);
    } catch (err) {
      toast((err as Error).message, 'danger');
      setDeckBusy(false);
    }
  };

  const setAnswer = (questionId: string, values: string[]) => {
    if (checked[questionId]) return;
    setAnswers(prev => ({ ...prev, [questionId]: values }));
  };

  const handleSelectOption = (questionId: string, optionId: string, isMultiple = false) => {
    if (checked[questionId]) return; // checked practice answers are locked
    setAnswers(prev => {
      const current = prev[questionId] || [];
      if (isMultiple) {
        const next = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  };

  const handleSubmit = async (overrideAnswers?: Record<string, string[]>) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    const finalAnswers = overrideAnswers || answersRef.current;
    const maxRetries = 2;

    for (let attemptCount = 0; attemptCount <= maxRetries; attemptCount++) {
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: finalAnswers }),
        });
        const data = await res.json();
        if (res.ok) {
          try {
            localStorage.removeItem(`sf_attempt_${attempt.attemptId}`);
          } catch {}
          setResult(data);
          setSubmitting(false);
          return;
        }

        if (attemptCount === maxRetries) {
          setSubmitError(data.error?.message || 'Không thể nộp bài do nghẽn mạng máy chủ. Vui lòng bấm thử lại.');
        }
      } catch (err: any) {
        if (attemptCount === maxRetries) {
          setSubmitError('Lỗi kết nối khi nộp bài. Vui lòng kiểm tra mạng và bấm Thử nộp lại.');
        }
      }

      if (attemptCount < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attemptCount + 1)));
      }
    }

    setSubmitting(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // Each view (room, result) starts at the top of the page
  const viewKey = attempt ? (result ? 'result' : `room-${attempt.attemptId}`) : 'join';
  useEffect(() => {
    if (viewKey === 'join') return;
    document.querySelector('.app-content')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [viewKey]);

  // Spoken time warnings (screen readers) at 5 and 1 minute(s) left
  useEffect(() => {
    if (!attempt || result) return;
    if (timeLeftSec === 300) setTimeNotice('Còn 5 phút làm bài.');
    else if (timeLeftSec === 60) setTimeNotice('Còn 1 phút làm bài. Bài sẽ tự nộp khi hết giờ.');
  }, [timeLeftSec, attempt, result]);

  const goTo = (next: number) => {
    if (!attempt) return;
    const clamped = Math.max(0, Math.min(attempt.questions.length - 1, next));
    if (clamped === currentIdx) return;
    directionRef.current = clamped > currentIdx ? 1 : -1;
    setCurrentIdx(clamped);
  };

  // Keyboard: A–H / 1–9 pick an option, ← → move between questions (never while typing)
  useEffect(() => {
    if (!attempt || result || confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
      const q = attempt.questions[currentIdx];
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(currentIdx + 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(currentIdx - 1);
        return;
      }
      if ((event.key === 'f' || event.key === 'F') && q) {
        event.preventDefault();
        toggleFlag(q.id);
        return;
      }
      if (!q?.options?.length || q.type === 'fill' || q.type === 'short' || q.type === 'ordering' || q.type === 'matching') return;
      const key = event.key.toUpperCase();
      let index = -1;
      if (/^[A-H]$/.test(key)) index = key.charCodeAt(0) - 65;
      else if (/^[1-9]$/.test(key)) index = Number(key) - 1;
      if (index < 0 || index >= q.options.length) return;
      event.preventDefault();
      handleSelectOption(q.id, q.options[index].id, q.type === 'multiple');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Confirmation dialog: Escape closes, focus returns to the button that opened it
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      confirmOpener.current?.focus();
    };
  }, [confirmOpen]);

  const requestSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
    confirmOpener.current = event.currentTarget;
    setConfirmOpen(true);
  };

  // View 1: Enter code screen
  if (!attempt) {
    return (
      <div className="ux take-exam-canvas">
        <style>{`
          .take-exam-canvas {
            position: relative;
            min-height: calc(100vh - 128px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
            overflow: hidden;
            isolation: isolate;
          }
          .ambient-radial-glow {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: -1;
            background:
              radial-gradient(34% 40% at 50% 46%, color-mix(in srgb, var(--ux-accent) 16%, transparent), transparent 70%),
              radial-gradient(26% 30% at 64% 62%, color-mix(in srgb, var(--ux-accent-2) 12%, transparent), transparent 70%);
          }
          .join-card {
            position: relative;
            width: 100%;
            max-width: 480px;
            padding: 44px 36px 36px;
            border-radius: 24px;
            background: color-mix(in srgb, var(--ux-surface) 92%, transparent);
            border: 1px solid var(--ux-line-2);
            box-shadow: var(--ux-elev-4), var(--ux-highlight);
            text-align: center;
            -webkit-backdrop-filter: blur(12px);
            backdrop-filter: blur(12px);
            animation: sf-fade-in .35s var(--ux-ease-out) backwards, take-card-in .7s var(--ux-spring-entrance) backwards;
          }
          @keyframes take-card-in {
            from { transform: translate3d(0, 16px, 0) scale(.97); }
          }
          .join-icon-badge {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            border-radius: 18px;
            background: var(--ux-brand-grad);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFFFFF;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, .3), 0 14px 30px -12px var(--ux-brand-glow);
            animation: sf-pop-in .6s var(--ux-spring-pop) .15s backwards;
          }
          .join-title {
            font-size: 26px;
            font-weight: 850;
            color: var(--ux-ink);
            margin: 0 0 8px;
            letter-spacing: -0.03em;
          }
          .join-desc {
            font-size: 14px;
            color: var(--ux-ink-3);
            margin: 0 0 26px;
            line-height: 1.6;
          }
          .join-input {
            width: 100%;
            height: 58px;
            border-radius: 14px;
            background: var(--ux-surface-2);
            border: 1px solid var(--ux-line-2);
            text-align: center;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: .22em;
            font-variant-numeric: tabular-nums;
            color: var(--ux-ink);
            outline: none;
            margin: 0 0 16px;
            text-transform: uppercase;
            box-shadow: inset 0 2px 4px var(--ux-shadow-c);
            transition: border-color .2s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out), background-color .2s var(--ux-ease-color);
          }
          .join-input::placeholder {
            color: var(--ux-ink-3);
            letter-spacing: .06em;
            font-weight: 500;
            font-size: 15px;
          }
          .join-input:focus {
            border-color: var(--ux-accent);
            background: var(--ux-surface);
            box-shadow: var(--ux-ring), inset 0 2px 4px var(--ux-shadow-c);
          }
          .join-btn {
            width: 100%;
            height: 52px;
            border-radius: 14px;
            background: var(--ux-accent);
            color: var(--ux-accent-ink);
            border: none;
            font-size: 15px;
            font-weight: 750;
            cursor: pointer;
            box-shadow: 0 10px 24px -10px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, .18);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: transform .4s var(--ux-spring-press), background-color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out);
          }
          .join-btn svg { transition: transform .45s var(--ux-spring-pop); }
          @media (hover: hover) and (pointer: fine) {
            .join-btn:hover:not(:disabled) {
              background: var(--ux-accent-hover);
              box-shadow: 0 14px 30px -10px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, .18);
            }
            .join-btn:hover:not(:disabled) svg { transform: translateX(3px); }
          }
          .join-btn:active:not(:disabled) {
            transform: var(--ux-press);
          }
          .join-btn:disabled {
            cursor: progress;
            opacity: .85;
          }
          .join-spin {
            width: 16px;
            height: 16px;
            border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
            border-top-color: currentColor;
            border-radius: 50%;
            animation: take-spin .7s linear infinite;
          }
          @keyframes take-spin { to { transform: rotate(360deg); } }
          .join-error {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: var(--ux-danger);
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
            padding: 9px 12px;
            background: color-mix(in srgb, var(--ux-danger) 10%, transparent);
            border-radius: 10px;
            border: 1px solid color-mix(in srgb, var(--ux-danger) 25%, transparent);
            animation: take-shake .4s var(--ux-ease-inout);
          }
          @keyframes take-shake {
            20% { translate: -3px 0; }
            40% { translate: 3px 0; }
            60% { translate: -2px 0; }
            80% { translate: 1px 0; }
          }
          .join-foot {
            margin: 18px 0 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            flex-wrap: wrap;
            font-size: 12px;
            color: var(--ux-ink-3);
          }
          .join-foot span {
            display: inline-flex;
            align-items: center;
            gap: 5px;
          }
          @media (prefers-reduced-motion: reduce) {
            .join-card, .join-icon-badge, .join-error { animation: sf-fade-in .2s ease-out backwards; }
          }
        `}</style>

        <div className="ambient-radial-glow" aria-hidden="true" />

        <div className="join-card">
          <div className="join-icon-badge" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13.5V4a2 2 0 0 1 2-2h8.5L20 7.5V20a2 2 0 0 1-2 2h-5.5" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M10.42 12.61a2.1 2.1 0 1 1 2.97 2.97L7.95 21 4 22l1-3.95 5.42-5.44Z" />
            </svg>
          </div>

          <h1 className="join-title">Phòng thi trực tuyến</h1>
          <p className="join-desc">
            Nhập mã chia sẻ đề thi từ giáo viên để bắt đầu làm bài.
          </p>

          <input
            className="join-input"
            placeholder="VD: SINHHOC8DEMO"
            value={shareCode}
            onChange={e => setShareCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && !starting && handleStart()}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="Mã đề thi"
            aria-invalid={Boolean(errorMsg)}
          />

          {errorMsg && (
            <div key={errorMsg} className="join-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <button className="join-btn" onClick={() => handleStart()} type="button" disabled={starting} aria-busy={starting}>
            {starting ? (
              <>
                <span className="join-spin" aria-hidden="true" />
                <span>Đang mở phòng thi…</span>
              </>
            ) : (
              <>
                <span>Bắt đầu làm bài thi</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>

          <div className="join-foot" aria-hidden="true">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Đáp án khoá phía máy chủ
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Tự lưu mỗi giây
            </span>
          </div>
        </div>
      </div>
    );
  }

  // View 3: Result Screen
  if (result) {
    const questionsList = result.details?.questions || [];
    const incorrectQuestions = questionsList.filter((q: any) => !q.correct);
    const correctCount = questionsList.length - incorrectQuestions.length;
    const total = Number(result.totalPoints) || 0;
    const score = Number(result.score) || 0;
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((score / total) * 100))) : 0;
    const scoreDecimals = Math.min(2, (String(result.score).split('.')[1] || '').length);
    const maxAttempts: number | null = attempt.maxAttempts ?? null;
    const usedAttempts = (attempt.attemptsUsed ?? 0) + (attempt.isSubmitted ? 0 : 1);
    const attemptsLeft = maxAttempts ? Math.max(0, maxAttempts - usedAttempts) : null;
    const pendingCount = questionsList.filter((q: any) => q.pendingReview).length;

    return (
      <div className="ux res-page" style={{ maxWidth: '860px', margin: '0 auto' }}>
        <style>{`
          .res-card {
            position: relative;
            padding: 40px 32px 32px;
            border-radius: 24px;
            background:
              radial-gradient(60% 70% at 50% 0%, color-mix(in srgb, var(--res-tone) 12%, transparent), transparent 70%),
              var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: var(--ux-elev-3), var(--ux-highlight);
            margin-bottom: 28px;
            text-align: center;
            overflow: hidden;
          }
          .res-ring-wrap {
            position: relative;
            width: 168px;
            height: 168px;
            margin: 0 auto 18px;
            display: grid;
            place-items: center;
          }
          .res-ring-wrap::before {
            content: "";
            position: absolute;
            inset: 10px;
            border-radius: 50%;
            background: radial-gradient(circle, color-mix(in srgb, var(--res-tone) 22%, transparent), transparent 70%);
            animation: res-glow 1.6s var(--ux-ease-out) .5s backwards;
          }
          @keyframes res-glow {
            from { opacity: 0; transform: scale(.6); }
          }
          .res-ring {
            position: absolute;
            inset: 0;
            transform: rotate(-90deg);
            overflow: visible;
            filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--res-tone) 30%, transparent));
          }
          .res-ring circle {
            fill: none;
            stroke-width: 10;
            stroke-linecap: round;
          }
          .res-ring-bg {
            stroke: var(--ux-surface-3);
          }
          .res-ring-fg {
            stroke: var(--res-tone);
            stroke-dasharray: 100;
            stroke-dashoffset: calc(100 - var(--pct));
            animation: res-ring-draw 1.4s var(--ux-ease-out) .25s backwards;
          }
          @keyframes res-ring-draw {
            from { stroke-dashoffset: 100; }
          }
          .res-ring-center {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            line-height: 1;
          }
          .res-score {
            font-size: 44px;
            font-weight: 900;
            color: var(--ux-ink);
            letter-spacing: -0.04em;
            font-variant-numeric: tabular-nums;
          }
          .res-score-total {
            margin-top: 6px;
            font-size: 13px;
            font-weight: 700;
            color: var(--ux-ink-3);
            font-variant-numeric: tabular-nums;
          }
          .res-status {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 7px 16px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: .02em;
            background: color-mix(in srgb, var(--res-tone) 14%, transparent);
            border: 1px solid color-mix(in srgb, var(--res-tone) 30%, transparent);
            color: var(--res-tone);
            margin-bottom: 14px;
            animation: sf-pop-in .5s var(--ux-spring-pop) .9s backwards;
          }
          .res-msg {
            font-size: 14.5px;
            color: var(--ux-ink-2);
            margin: 0 auto 22px;
            line-height: 1.6;
            max-width: 440px;
          }
          .res-metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
            max-width: 520px;
            margin: 0 auto 26px;
          }
          .res-metric {
            padding: 12px 10px;
            border-radius: 14px;
            background: var(--ux-surface-2);
            border: 1px solid var(--ux-line);
          }
          .res-metric b {
            display: block;
            font-size: 20px;
            font-weight: 850;
            letter-spacing: -0.02em;
            font-variant-numeric: tabular-nums;
          }
          .res-metric span {
            font-size: 11.5px;
            font-weight: 650;
            color: var(--ux-ink-3);
          }
          .res-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .res-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 22px;
            border-radius: 12px;
            border: 1px solid var(--ux-line-2);
            background: var(--ux-surface);
            color: var(--ux-ink);
            text-decoration: none;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            box-shadow: var(--ux-elev-1);
            transition: background-color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out), transform .4s var(--ux-spring-press);
          }
          .res-btn:hover { background: var(--ux-surface-2); }
          .res-btn:active { transform: var(--ux-press); }
          .res-btn.primary {
            background: var(--ux-accent);
            color: var(--ux-accent-ink);
            border-color: var(--ux-accent);
            box-shadow: 0 10px 24px -10px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, .18);
          }
          .res-btn.primary:hover { background: var(--ux-accent-hover); }
          .res-btn.ink {
            background: var(--ux-ink);
            color: var(--ux-page);
            border-color: var(--ux-ink);
          }
          .res-btn.ink:hover { background: var(--ux-ink-2); }
          .res-review-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin: 0 0 16px;
          }
          .res-review-title h3 {
            font-size: 18px;
            font-weight: 850;
            letter-spacing: -0.02em;
            color: var(--ux-ink);
            margin: 0;
          }
          .res-review-item {
            position: relative;
            padding: 18px 20px 18px 22px;
            border-radius: 16px;
            background: var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: var(--ux-elev-1);
            margin-bottom: 12px;
            text-align: left;
            overflow: hidden;
          }
          .res-review-item::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: var(--item-tone);
          }
          .res-review-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
          }
          .res-review-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13.5px;
            font-weight: 800;
            color: var(--item-tone);
          }
          .res-review-badge i {
            width: 22px;
            height: 22px;
            border-radius: 7px;
            display: grid;
            place-items: center;
            background: color-mix(in srgb, var(--item-tone) 14%, transparent);
          }
          .res-review-pts {
            font-size: 12px;
            font-weight: 750;
            color: var(--ux-ink-3);
            font-variant-numeric: tabular-nums;
          }
          .res-note { margin: 16px auto 0; max-width: 520px; font-size: 12.5px; line-height: 1.55; color: var(--ux-ink-3); font-weight: 600; }
          .res-pending { margin-top: 8px; padding: 6px 10px; border-radius: 8px; font-size: 12.5px; font-weight: 650; color: var(--ux-warn); background: color-mix(in srgb, var(--ux-warn) 10%, transparent); }
          .res-pending[data-tone="teacher"] { color: var(--ux-ink-2); background: var(--ux-accent-soft); }
          .res-btn:disabled { opacity: .55; cursor: default; }
          .citation-tag {
            margin-top: 12px;
            padding: 10px 14px;
            border-radius: 10px;
            background: var(--ux-surface-2);
            font-size: 13px;
            color: var(--ux-ink-2);
            border-left: 3px solid var(--ux-accent);
          }
          @media (max-width: 560px) {
            .res-card { padding: 32px 18px 24px; }
            .res-metrics { gap: 8px; }
            .res-actions .res-btn { flex: 1 1 100%; justify-content: center; }
          }
          @media (prefers-reduced-motion: reduce) {
            .res-ring-fg, .res-ring-wrap::before, .res-status { animation: none; }
          }
        `}</style>

        <div className="res-card" style={{ '--res-tone': result.passed ? 'var(--ux-mint)' : 'var(--ux-danger)' } as React.CSSProperties}>
          <div className="res-ring-wrap">
            <svg className="res-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="res-ring-bg" cx="60" cy="60" r="52" pathLength={100} />
              <circle className="res-ring-fg" cx="60" cy="60" r="52" pathLength={100} style={{ '--pct': pct } as React.CSSProperties} />
            </svg>
            <div className="res-ring-center">
              <CountingNumber className="res-score" number={score} decimalPlaces={scoreDecimals} delay={250} />
              <span className="res-score-total">/ {result.totalPoints} điểm</span>
            </div>
          </div>

          <div className="res-status">
            {result.passed ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            )}
            {result.passed ? 'KẾT QUẢ: ĐẠT' : 'KẾT QUẢ: CẦN CỐ GẮNG'}
          </div>
          <p className="res-msg">
            {result.passed
              ? 'Chúc mừng bạn đã hoàn thành xuất sắc bài kiểm tra!'
              : 'Hãy xem lại các câu chưa chính xác và tiếp tục luyện tập.'}
          </p>

          {questionsList.length > 0 && (
            <div className="res-metrics sf-stagger">
              <div className="res-metric">
                <b style={{ color: 'var(--ux-mint)' }}>{correctCount}</b>
                <span>Câu đúng</span>
              </div>
              <div className="res-metric">
                <b style={{ color: 'var(--ux-danger)' }}>{incorrectQuestions.length}</b>
                <span>Câu chưa đúng</span>
              </div>
              <div className="res-metric">
                <b>{pct}%</b>
                <span>Tỉ lệ điểm</span>
              </div>
            </div>
          )}

          <div className="res-actions">
            <Link href="/dashboard" className="res-btn">
              Về bảng điều khiển
            </Link>
            <button type="button" className="res-btn primary" onClick={() => void practiceWrongAnswers()} disabled={deckBusy || incorrectQuestions.length === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>{deckBusy ? 'Đang tạo bộ ôn…' : incorrectQuestions.length ? `Ôn lại câu sai (${incorrectQuestions.length})` : 'Không có câu sai'}</span>
            </button>
            <button type="button" className="res-btn ink" onClick={() => handleStart(shareCode || initialCode, true)} disabled={starting || attemptsLeft === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>{starting ? 'Đang mở lại…' : attemptsLeft === 0 ? 'Đã hết lượt làm' : 'Làm lại bài thi'}</span>
            </button>
          </div>
          {(maxAttempts || pendingCount > 0) && (
            <p className="res-note">
              {maxAttempts ? `Lượt làm: ${Math.min(usedAttempts, maxAttempts)}/${maxAttempts}${attemptsLeft ? ` · còn ${attemptsLeft} lượt` : ''}. ` : ''}
              {pendingCount > 0 ? `${pendingCount} câu trả lời ngắn đang chờ giáo viên xem xét — điểm có thể được cộng thêm.` : ''}
            </p>
          )}
        </div>

        {questionsList.length > 0 && (
          <div>
            <div className="res-review-title">
              <h3>Chi tiết giải thích &amp; Căn cứ trích dẫn nguồn</h3>
            </div>
            {questionsList.map((q: any, idx: number) => (
              <div
                key={idx}
                className="res-review-item sf-reveal"
                style={{ '--item-tone': q.correct ? 'var(--ux-mint)' : 'var(--ux-danger)' } as React.CSSProperties}
              >
                <div className="res-review-head">
                  <span className="res-review-badge">
                    <i aria-hidden="true">
                      {q.correct ? (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                    </i>
                    Câu {idx + 1}: {q.correct ? 'Đúng' : 'Chưa đúng'}
                  </span>
                  <span className="res-review-pts">+{q.earnedPoints}/{q.points} điểm</span>
                </div>
                {q.pendingReview && <div className="res-pending">Chờ giáo viên xem xét cách diễn đạt của bạn.</div>}
                {q.feedback && <div className="res-pending" data-tone="teacher"><b>Nhận xét của giáo viên:</b> {q.feedback}</div>}

                {q.explanation && (
                  <div style={{ fontSize: '13.5px', color: 'var(--ux-ink-2)', marginTop: '10px', lineHeight: 1.7 }}>
                    <b style={{ color: 'var(--ux-ink)' }}>Giải thích chi tiết:</b> <MathText text={q.explanation} inline />
                  </div>
                )}

                {q.sourceRefs?.length > 0 && (
                  <div className="citation-tag">
                    <b style={{ color: 'var(--ux-accent-text)' }}>Trích dẫn tài liệu:</b> “<MathText text={q.sourceRefs[0].quote} inline />”
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // View 2: Active Exam Room
  const currentQ = attempt.questions[currentIdx];
  const selectedOptions = answers[currentQ.id] || [];
  const totalQuestions = attempt.questions.length;
  const answeredCount = attempt.questions.filter((q: any) => hasAnswer(answers[q.id])).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const timeLevel = timeLeftSec <= 120 ? 'danger' : timeLeftSec <= 300 ? 'warn' : 'ok';
  const direction = directionRef.current;
  const isChoice = !(!currentQ.options || currentQ.options.length === 0 || currentQ.type === 'fill' || currentQ.type === 'short' || currentQ.type === 'ordering' || currentQ.type === 'matching');
  const isPractice = Boolean(attempt.isPracticeMode);
  const feedback: CheckFeedback | undefined = checked[currentQ.id];
  const isFlagged = flags.has(currentQ.id);
  const visibleIndexes = attempt.questions.map((_: unknown, i: number) => i).filter((i: number) => !flaggedOnly || flags.has(attempt.questions[i].id));

  return (
    <div className="ux exam-room" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <style>{`
        .exam-header {
          position: sticky;
          top: 8px;
          z-index: 6;
          padding: 14px 20px 0;
          border-radius: 18px;
          background: color-mix(in srgb, var(--ux-surface) 88%, transparent);
          -webkit-backdrop-filter: blur(14px) saturate(1.4);
          backdrop-filter: blur(14px) saturate(1.4);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
          margin-bottom: 22px;
          overflow: hidden;
        }
        .exam-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px 16px;
          padding-bottom: 12px;
        }
        .exam-kicker {
          font-size: 11px;
          font-weight: 800;
          color: var(--ux-ink-3);
          text-transform: uppercase;
          letter-spacing: .08em;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .exam-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ux-danger);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--ux-danger) 20%, transparent);
        }
        .exam-title {
          font-size: 17px;
          font-weight: 800;
          color: var(--ux-ink);
          margin-top: 3px;
          letter-spacing: -0.015em;
        }
        .exam-header-side {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .save-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          color: var(--ux-ink-3);
        }
        .exam-mode-pill { display: inline-flex; align-items: center; height: 30px; padding: 0 11px; border-radius: 999px; font-size: 12px; font-weight: 800; color: var(--ux-mint); background: color-mix(in srgb, var(--ux-mint) 12%, var(--ux-surface)); border: 1px solid color-mix(in srgb, var(--ux-mint) 35%, transparent); }
        .save-pill[data-state="offline"] { color: var(--ux-warn); border-color: color-mix(in srgb, var(--ux-warn) 40%, transparent); }
        .save-pill > * {
          animation: sf-title-in .3s var(--ux-ease-out) backwards;
        }
        .save-pill[data-state="saved"] { color: var(--ux-mint); }
        .save-pill[data-state="error"] { color: var(--ux-danger); border-color: color-mix(in srgb, var(--ux-danger) 30%, transparent); }
        .save-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          animation: exam-blink 1s var(--ux-ease-inout) infinite;
        }
        @keyframes exam-blink { 50% { opacity: .25; } }
        .timer-badge {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-variant-numeric: tabular-nums;
          font-size: 19px;
          font-weight: 800;
          color: var(--ux-ink);
          height: 40px;
          padding: 0 14px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line-2);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: color .3s var(--ux-ease-color), background-color .3s var(--ux-ease-color), border-color .3s var(--ux-ease-color);
        }
        .timer-badge[data-level="warn"] {
          color: var(--ux-warn);
          background: color-mix(in srgb, var(--ux-warn) 10%, var(--ux-surface));
          border-color: color-mix(in srgb, var(--ux-warn) 35%, transparent);
        }
        .timer-badge[data-level="danger"] {
          color: var(--ux-danger);
          background: color-mix(in srgb, var(--ux-danger) 10%, var(--ux-surface));
          border-color: color-mix(in srgb, var(--ux-danger) 40%, transparent);
        }
        .timer-badge[data-level="danger"] svg {
          animation: exam-tick 1s var(--ux-ease-inout) infinite;
        }
        @keyframes exam-tick { 50% { transform: scale(1.15); } }
        .exam-progress {
          position: relative;
          height: 4px;
          margin: 0 -20px;
          background: var(--ux-surface-3);
        }
        .exam-progress > i {
          position: absolute;
          inset: 0;
          background: var(--ux-brand-grad);
          transform-origin: 0 50%;
          transform: scaleX(var(--p, 0));
          transition: transform .75s var(--ux-spring-progress);
        }
        .exam-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          gap: 22px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .exam-layout { grid-template-columns: 1fr; }
        }
        .q-box {
          padding: 30px 32px 26px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
          overflow: hidden;
        }
        .q-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          gap: 10px;
        }
        .q-num {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 800;
          color: var(--ux-accent-text);
          letter-spacing: .06em;
        }
        .q-num b {
          display: inline-grid;
          place-items: center;
          min-width: 28px;
          height: 28px;
          padding: 0 6px;
          border-radius: 9px;
          background: var(--ux-accent-soft);
          font-size: 13px;
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
        }
        .q-meta-side { display: inline-flex; align-items: center; gap: 8px; }
        .q-flag {
          display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px;
          border: 1px solid var(--ux-line-2); background: var(--ux-surface); color: var(--ux-ink-3);
          font-size: 12px; font-weight: 750; cursor: pointer;
          transition: color .2s var(--ux-ease-color), background-color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .q-flag:hover { color: var(--ux-warn); border-color: color-mix(in srgb, var(--ux-warn) 45%, var(--ux-line-2)); }
        .q-flag:active { transform: var(--ux-press); }
        .q-flag[aria-pressed="true"] { color: var(--ux-warn); background: color-mix(in srgb, var(--ux-warn) 12%, var(--ux-surface)); border-color: color-mix(in srgb, var(--ux-warn) 50%, transparent); }
        .q-flag[aria-pressed="true"] svg { animation: sf-pop-in .4s var(--ux-spring-pop); }
        .opt-btn[data-verdict="right"] { border-color: var(--ux-mint); background: color-mix(in srgb, var(--ux-mint) 10%, var(--ux-surface)); color: var(--ux-ink); box-shadow: 0 0 0 1px var(--ux-mint); }
        .opt-btn[data-verdict="right"] .opt-letter { background: var(--ux-mint); border-color: var(--ux-mint); color: var(--ux-mint-ink); }
        .opt-btn[data-verdict="wrong"] { border-color: var(--ux-danger); background: color-mix(in srgb, var(--ux-danger) 8%, var(--ux-surface)); color: var(--ux-ink); box-shadow: 0 0 0 1px var(--ux-danger); }
        .opt-btn[data-verdict="wrong"] .opt-letter { background: var(--ux-danger); border-color: var(--ux-danger); color: #fff; }
        .opt-btn[aria-disabled="true"] { cursor: default; }
        .q-check-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
        .q-check-row small { font-size: 12px; color: var(--ux-ink-3); font-weight: 600; }
        .q-btn.check { border-color: color-mix(in srgb, var(--ux-accent) 40%, var(--ux-line-2)); color: var(--ux-accent-text); }
        .q-btn.check:hover:not(:disabled) { background: var(--ux-accent-soft); }
        .q-points {
          font-size: 12.5px;
          color: var(--ux-ink-3);
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--ux-surface-2);
        }
        .q-stem {
          font-size: 18px;
          font-weight: 700;
          color: var(--ux-ink);
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .q-hint {
          font-size: 12px;
          font-weight: 650;
          color: var(--ux-ink-3);
          margin: -12px 0 16px;
        }
        .opt-list {
          display: grid;
          gap: 12px;
        }
        .opt-list[data-columns="4"] { grid-template-columns: repeat(4, 1fr); }
        .opt-list[data-columns="2"] { grid-template-columns: repeat(2, 1fr); }
        .opt-list[data-columns="1"] { grid-template-columns: 1fr; }
        @media (max-width: 768px) {
          .opt-list[data-columns="4"] { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .opt-list[data-columns="4"],
          .opt-list[data-columns="2"] { grid-template-columns: 1fr; }
        }
        .opt-btn {
          position: relative;
          padding: 15px 18px;
          border-radius: 14px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          color: var(--ux-ink);
          text-align: left;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: transform .4s var(--ux-spring-press), background-color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out);
        }
        .opt-btn:active { transform: var(--ux-press-card); }
        @media (hover: hover) and (pointer: fine) {
          .opt-btn:hover {
            border-color: color-mix(in srgb, var(--ux-accent) 45%, var(--ux-line-2));
            background: var(--ux-surface);
            box-shadow: var(--ux-elev-2);
          }
        }
        .opt-btn.selected {
          border-color: var(--ux-accent);
          background: var(--ux-accent-soft);
          color: var(--ux-accent-text);
          font-weight: 700;
          box-shadow: 0 0 0 1px var(--ux-accent), 0 8px 20px -12px var(--ux-brand-glow);
        }
        .opt-letter {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 13px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line-2);
          color: var(--ux-ink-2);
          transition: background-color .2s var(--ux-ease-color), color .2s var(--ux-ease-color), border-color .2s var(--ux-ease-color);
        }
        .opt-btn.selected .opt-letter {
          background: var(--ux-accent);
          border-color: var(--ux-accent);
          color: var(--ux-accent-ink);
          animation: sf-pop-in .45s var(--ux-spring-pop);
        }
        .opt-btn[data-shape="square"] .opt-letter { border-radius: 9px; }
        .q-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface-2);
          color: var(--ux-ink);
          font-size: 15px;
          outline: none;
          transition: border-color .2s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out), background-color .2s var(--ux-ease-color);
        }
        .q-input:focus {
          border-color: var(--ux-accent);
          background: var(--ux-surface);
          box-shadow: var(--ux-ring);
        }
        .q-figure {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 14px 0;
          padding: 12px;
          background: var(--ux-surface-2);
          border-radius: 14px;
          border: 1px solid var(--ux-line-2);
        }
        .q-figure img {
          max-height: 180px;
          max-width: 320px;
          object-fit: contain;
          border-radius: 10px;
          background: #fff;
          border: 1px solid var(--ux-line);
        }
        .q-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 30px;
          padding-top: 18px;
          border-top: 1px solid var(--ux-line);
        }
        .q-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border-radius: 12px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          box-shadow: var(--ux-elev-1);
          transition: background-color .2s var(--ux-ease-color), box-shadow .3s var(--ux-ease-out), opacity .2s, transform .4s var(--ux-spring-press);
        }
        .q-btn svg { transition: transform .45s var(--ux-spring-pop); }
        .q-btn:hover:not(:disabled) { background: var(--ux-surface-2); }
        .q-btn:active:not(:disabled) { transform: var(--ux-press); }
        .q-btn:disabled { opacity: .4; cursor: not-allowed; }
        .q-btn.next {
          background: var(--ux-accent);
          border-color: var(--ux-accent);
          color: var(--ux-accent-ink);
          box-shadow: 0 10px 22px -12px var(--ux-brand-glow), inset 0 1px 0 rgba(255, 255, 255, .18);
        }
        .q-btn.next:hover:not(:disabled) { background: var(--ux-accent-hover); }
        @media (hover: hover) and (pointer: fine) {
          .q-btn.next:hover svg { transform: translateX(3px); }
          .q-btn.prev:hover:not(:disabled) svg { transform: translateX(-3px); }
        }
        .q-btn.submit {
          background: var(--ux-mint);
          border-color: var(--ux-mint);
          color: var(--ux-mint-ink);
          box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--ux-mint) 60%, transparent);
        }
        .q-btn.submit:hover:not(:disabled) { filter: brightness(1.06); }
        .q-shortcuts {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 14px;
          font-size: 11.5px;
          color: var(--ux-ink-3);
          font-weight: 600;
        }
        @media (hover: none) { .q-shortcuts { display: none; } }
        .palette {
          position: sticky;
          top: 128px;
          padding: 20px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-elev-2), var(--ux-highlight);
        }
        .palette-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }
        .palette-head b { font-size: 14px; font-weight: 800; color: var(--ux-ink); }
        .palette-head span { font-size: 12px; font-weight: 700; color: var(--ux-ink-3); font-variant-numeric: tabular-nums; }
        .palette-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 7px;
          margin-top: 14px;
          max-height: 46vh;
          overflow: auto;
          padding: 3px;
          scrollbar-width: thin;
        }
        .palette-num {
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          font-size: 13.5px;
          font-weight: 750;
          color: var(--ux-ink-3);
          display: grid;
          place-items: center;
          cursor: pointer;
          font-variant-numeric: tabular-nums;
          transition: transform .4s var(--ux-spring-press), background-color .25s var(--ux-ease-color), border-color .25s var(--ux-ease-color), color .25s var(--ux-ease-color), box-shadow .25s var(--ux-ease-out);
        }
        .palette-num:active { transform: scale(0.92); }
        .palette-num:hover { border-color: var(--ux-accent); color: var(--ux-ink); }
        .palette-num.done {
          background: var(--ux-mint);
          color: var(--ux-mint-ink);
          border-color: var(--ux-mint);
        }
        .palette-num.current {
          border-color: var(--ux-accent);
          color: var(--ux-accent-text);
          box-shadow: 0 0 0 2px var(--ux-accent), 0 6px 14px -6px var(--ux-brand-glow);
          font-weight: 850;
        }
        .palette-num.done.current { color: var(--ux-mint-ink); }
        .palette-num { position: relative; }
        .palette-num[data-flag]::after { content: ""; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--ux-warn); box-shadow: 0 0 0 2px var(--ux-surface); animation: sf-pop-in .35s var(--ux-spring-pop); }
        .palette-num[data-verdict="wrong"] { background: var(--ux-danger); border-color: var(--ux-danger); color: #fff; }
        .palette-filter {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 6px 10px; border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--ux-warn) 45%, var(--ux-line-2)); background: color-mix(in srgb, var(--ux-warn) 8%, var(--ux-surface));
          color: var(--ux-warn); font-size: 12px; font-weight: 750; cursor: pointer; transition: transform .4s var(--ux-spring-press);
        }
        .palette-filter:active { transform: var(--ux-press); }
        .palette-legend {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
          font-size: 11.5px;
          font-weight: 650;
          color: var(--ux-ink-3);
        }
        .palette-legend span { display: inline-flex; align-items: center; gap: 6px; }
        .palette-legend i { width: 10px; height: 10px; border-radius: 4px; border: 1px solid var(--ux-line-2); background: var(--ux-surface-2); }
        .palette-legend i.done { background: var(--ux-mint); border-color: var(--ux-mint); }
        .palette-legend i.current { box-shadow: 0 0 0 2px var(--ux-accent); border-color: var(--ux-accent); }
        .palette-legend i.flag { border-radius: 50%; background: var(--ux-warn); border-color: var(--ux-warn); }
        .palette-submit {
          width: 100%;
          height: 46px;
          margin-top: 18px;
          border-radius: 12px;
          background: var(--ux-mint);
          color: var(--ux-mint-ink);
          border: 0;
          font-weight: 750;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 10px 22px -12px color-mix(in srgb, var(--ux-mint) 60%, transparent);
          transition: filter .2s var(--ux-ease-color), transform .4s var(--ux-spring-press);
        }
        .palette-submit:hover:not(:disabled) { filter: brightness(1.06); }
        .palette-submit:active:not(:disabled) { transform: var(--ux-press); }
        .palette-submit:disabled { cursor: progress; opacity: .8; }
        .exam-submit-error {
          color: var(--ux-danger);
          font-size: 12.5px;
          font-weight: 650;
          line-height: 1.45;
        }
        .confirm-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 18px 0 20px;
        }
        .confirm-stats div {
          padding: 12px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          text-align: center;
        }
        .confirm-stats b { display: block; font-size: 22px; font-weight: 850; font-variant-numeric: tabular-nums; }
        .confirm-stats span { font-size: 12px; font-weight: 650; color: var(--ux-ink-3); }
        .confirm-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
        @media (max-width: 768px) {
          .exam-header { top: 66px; padding: 12px 14px 0; }
          .exam-progress { margin: 0 -14px; }
          .q-box { padding: 22px 18px 20px; }
          .palette { position: static; }
        }
        @media (max-width: 560px) {
          .exam-header-row { flex-wrap: nowrap; gap: 10px; padding-bottom: 10px; }
          .exam-kicker { display: none; }
          .exam-title { margin: 0; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .exam-header-side { gap: 8px; flex: none; }
          .save-pill { width: 30px; padding: 0; justify-content: center; }
          .save-label { display: none; }
          .timer-badge { height: 36px; padding: 0 10px; font-size: 17px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .save-dot, .timer-badge[data-level="danger"] svg { animation: none; }
        }
      `}</style>

      <span className="visually-hidden" aria-live="polite">{timeNotice}</span>

      <div className="exam-header">
        <div className="exam-header-row">
          <div style={{ minWidth: 0 }}>
            <div className="exam-kicker">
              <span className="exam-live-dot" aria-hidden="true" />
              Bài kiểm tra đang diễn ra
            </div>
            <div className="exam-title">{attempt.quizTitle}</div>
          </div>

          <div className="exam-header-side">
            {isPractice && <span className="exam-mode-pill">Luyện tập</span>}
            <span
              className="save-pill"
              data-state={saveStatus}
              role="status"
              aria-label={saveStatus === 'saving' ? 'Đang lưu' : saveStatus === 'saved' ? 'Đã đồng bộ' : saveStatus === 'offline' ? 'Ngoại tuyến, đáp án đã giữ trên máy' : 'Lỗi lưu, đáp án đã giữ trên máy'}
            >
              {saveStatus === 'saving' ? (
                <span key="saving" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="save-dot" aria-hidden="true" /> <span className="save-label">Đang lưu…</span>
                </span>
              ) : saveStatus === 'offline' ? (
                <span key="offline" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><line x1="2" y1="2" x2="22" y2="22" /><path d="M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.6M12 20h.01" /></svg>
                  <span className="save-label">Ngoại tuyến · đã giữ trên máy</span>
                </span>
              ) : saveStatus === 'saved' ? (
                <span key="saved" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="save-label">Đã đồng bộ</span>
                </span>
              ) : (
                <span key="error" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="save-label">Lỗi lưu · đã giữ trên máy</span>
                </span>
              )}
            </span>
            <div className="timer-badge" data-level={timeLevel} role="timer" aria-label={`Thời gian còn lại ${formatTimer(timeLeftSec)}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span aria-hidden="true">{formatTimer(timeLeftSec)}</span>
            </div>
          </div>
        </div>
        <div
          className="exam-progress"
          role="progressbar"
          aria-label="Số câu đã trả lời"
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={answeredCount}
        >
          <i style={{ '--p': totalQuestions ? answeredCount / totalQuestions : 0 } as React.CSSProperties} />
        </div>
      </div>

      <div className="exam-layout">
        <div className="q-box">
          <ReducedMotionConfig>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={currentQ.id}
                custom={direction}
                initial={{
                  opacity: 0,
                  filter: blur.panel,
                  transform: reduceMotion ? 'none' : `translate3d(${direction * shift.step}px, 0, 0)`,
                }}
                animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0, 0, 0)', transition: panelIn }}
                exit={{
                  opacity: 0,
                  filter: blur.panel,
                  transform: reduceMotion ? 'none' : `translate3d(${direction * -shift.step}px, 0, 0)`,
                  transition: panelOut,
                }}
              >
                <div className="q-meta">
                  <span className="q-num">
                    CÂU <b>{currentIdx + 1}</b> / {totalQuestions}
                  </span>
                  <span className="q-meta-side">
                    <button type="button" className="q-flag" aria-pressed={isFlagged} onClick={() => toggleFlag(currentQ.id)} title="Đánh dấu để xem lại (phím F)">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isFlagged ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 1-1h12l-2.5 4.5L17 12H5" /></svg>
                      {isFlagged ? 'Đã đánh dấu' : 'Xem lại sau'}
                    </button>
                    <span className="q-points">{currentQ.points} điểm</span>
                  </span>
                </div>

                <div className="q-stem"><MathText text={currentQ.stem} /></div>
                {currentQ.type === 'multiple' && <p className="q-hint">Có thể chọn nhiều đáp án.</p>}
                {currentQ.audioUrl && <QuestionAudio src={currentQ.audioUrl} />}

                {currentQ.imageRefs && currentQ.imageRefs.length > 0 && (
                  <div className="q-figure">
                    {currentQ.imageRefs.map((img: any, iIdx: number) => (
                      <div key={img.id || iIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                        {img.src ? (
                          <>
                            <img src={img.src} alt={img.placeholder} />
                            <span style={{ fontSize: '11px', fontWeight: 650, color: 'var(--ux-ink-3)' }}>{img.placeholder}</span>
                          </>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--ux-surface)', border: '1px dashed var(--ux-line-2)', borderRadius: '8px', fontSize: '12px', color: 'var(--ux-ink-3)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                            {img.placeholder}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {currentQ.type === 'ordering' ? (
                  <OrderingInput
                    options={currentQ.options}
                    value={answers[currentQ.id]}
                    onChange={ids => setAnswer(currentQ.id, ids)}
                    locked={Boolean(feedback)}
                    correctOrder={feedback?.correctOptionIds}
                  />
                ) : currentQ.type === 'matching' ? (
                  <MatchingInput
                    options={currentQ.options}
                    leftIds={currentQ.matchLeft ?? []}
                    value={answers[currentQ.id]}
                    onChange={pairs => setAnswer(currentQ.id, pairs)}
                    locked={Boolean(feedback)}
                    correctPairs={feedback?.pairs}
                  />
                ) : !isChoice ? (
                  <div style={{ marginTop: '20px' }}>
                    <label htmlFor={`answer-${currentQ.id}`} style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: 'var(--ux-ink-2)', marginBottom: '8px' }}>
                      Nhập câu trả lời của bạn:
                    </label>
                    <input
                      id={`answer-${currentQ.id}`}
                      className="q-input"
                      type="text"
                      autoComplete="off"
                      value={answers[currentQ.id]?.[0] || ''}
                      readOnly={Boolean(feedback)}
                      onChange={e => setAnswer(currentQ.id, [e.target.value])}
                      placeholder="Nhập câu trả lời tại đây..."
                    />
                  </div>
                ) : (() => {
                  const maxOptionLen = Math.max(0, ...(currentQ.options || []).map((o: any) => (o.text || '').length));
                  const optCols = currentQ.type === 'boolean' ? 2 : maxOptionLen <= 14 && currentQ.options?.length === 4 ? 4 : maxOptionLen <= 35 && currentQ.options?.length >= 2 ? 2 : 1;
                  const isMultiple = currentQ.type === 'multiple';
                  return (
                    <div className="opt-list" data-columns={optCols} role={isMultiple ? 'group' : 'radiogroup'} aria-label={`Phương án câu ${currentIdx + 1}`}>
                      {currentQ.options?.map((opt: any, oIdx: number) => {
                        const isSelected = selectedOptions.includes(opt.id);
                        const label = String.fromCharCode(65 + oIdx);
                        const verdict = feedback ? (feedback.correctOptionIds.includes(opt.id) ? 'right' : isSelected ? 'wrong' : undefined) : undefined;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role={isMultiple ? 'checkbox' : 'radio'}
                            aria-checked={isSelected}
                            aria-disabled={Boolean(feedback) || undefined}
                            data-shape={isMultiple ? 'square' : 'round'}
                            data-verdict={verdict}
                            className={`opt-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectOption(currentQ.id, opt.id, isMultiple)}
                          >
                            <span className="opt-letter" aria-hidden="true">{label}</span>
                            <span><MathText text={opt.text} inline /></span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {isPractice && (feedback ? (
                  <PracticeFeedback feedback={feedback} />
                ) : (
                  <div className="q-check-row">
                    <button type="button" className="q-btn check" onClick={() => void checkAnswer(currentQ.id)} disabled={checking || !hasAnswer(answers[currentQ.id])}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      {checking ? 'Đang kiểm tra…' : 'Kiểm tra đáp án'}
                    </button>
                    <small>Chế độ luyện tập: xem đáp án và lời giải ngay. Câu đã kiểm tra sẽ được khoá.</small>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </ReducedMotionConfig>

          <div className="q-nav">
            <button type="button" className="q-btn prev" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Câu trước</span>
            </button>

            {submitError && <div className="exam-submit-error sf-alert" role="alert">{submitError}</div>}

            {currentIdx < totalQuestions - 1 ? (
              <button type="button" className="q-btn next" onClick={() => goTo(currentIdx + 1)}>
                <span>Câu tiếp theo</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            ) : (
              <button type="button" className="q-btn submit" onClick={requestSubmit} disabled={submitting}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}</span>
              </button>
            )}
          </div>
          {isChoice && (
            <div className="q-shortcuts" aria-hidden="true">
              <kbd className="sf-kbd">A</kbd>–<kbd className="sf-kbd">D</kbd> chọn đáp án
              <span style={{ opacity: 0.5 }}>·</span>
              <kbd className="sf-kbd">←</kbd><kbd className="sf-kbd">→</kbd> chuyển câu
              <span style={{ opacity: 0.5 }}>·</span>
              <kbd className="sf-kbd">F</kbd> đánh dấu
            </div>
          )}
        </div>

        <aside className="palette" aria-label="Danh sách câu hỏi">
          <div className="palette-head">
            <b>Danh sách câu hỏi</b>
            <span>{answeredCount}/{totalQuestions}</span>
          </div>

          {flags.size > 0 && (
            <button type="button" className="palette-filter" aria-pressed={flaggedOnly} onClick={() => setFlaggedOnly(v => !v)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 22V4a1 1 0 0 1 1-1h12l-2.5 4.5L17 12H5" /></svg>
              {flaggedOnly ? 'Hiện tất cả câu' : `Chỉ câu đánh dấu (${flags.size})`}
            </button>
          )}
          <div className="palette-grid">
            {visibleIndexes.map((idx: number) => {
              const q = attempt.questions[idx];
              const isAnswered = hasAnswer(answers[q.id]);
              const isCurrent = idx === currentIdx;
              const isMarked = flags.has(q.id);
              const verdict = checked[q.id] ? (checked[q.id].correct ? 'right' : 'wrong') : undefined;
              return (
                <button
                  type="button"
                  key={q.id}
                  aria-label={`Câu hỏi ${idx + 1}: ${isAnswered ? 'Đã trả lời' : 'Chưa làm'}${isMarked ? ', đã đánh dấu xem lại' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-flag={isMarked || undefined}
                  data-verdict={verdict}
                  className={`palette-num ${isAnswered ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                  onClick={() => goTo(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="palette-legend" aria-hidden="true">
            <span><i className="done" /> Đã làm</span>
            <span><i className="current" /> Đang xem</span>
            <span><i /> Chưa làm</span>
            <span><i className="flag" /> Xem lại</span>
          </div>

          {submitError && <div className="exam-submit-error" style={{ marginTop: 14, textAlign: 'center' }}>{submitError}</div>}
          <button type="button" className="palette-submit" onClick={requestSubmit} disabled={submitting}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}</span>
          </button>
        </aside>
      </div>

      {confirmOpen && (
        <div
          className="sf-dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="sf-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-submit-title" aria-describedby="confirm-submit-desc">
            <h2 id="confirm-submit-title" style={{ margin: 0, fontSize: 19, fontWeight: 850, letterSpacing: '-0.02em', color: 'var(--ux-ink)' }}>
              Nộp bài thi ngay?
            </h2>
            <p id="confirm-submit-desc" style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--ux-ink-2)' }}>
              {unansweredCount > 0
                ? `Bạn còn ${unansweredCount} câu chưa trả lời. Sau khi nộp sẽ không thể sửa đáp án.`
                : 'Bạn đã trả lời tất cả câu hỏi. Sau khi nộp sẽ không thể sửa đáp án.'}
              {flags.size > 0 && ` Còn ${flags.size} câu bạn đánh dấu để xem lại.`}
            </p>
            <div className="confirm-stats">
              <div>
                <b style={{ color: 'var(--ux-mint)' }}>{answeredCount}</b>
                <span>Đã trả lời</span>
              </div>
              <div>
                <b style={{ color: unansweredCount ? 'var(--ux-warn)' : 'var(--ux-ink-3)' }}>{unansweredCount}</b>
                <span>Chưa trả lời</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button type="button" className="q-btn" autoFocus onClick={() => setConfirmOpen(false)}>
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                className="q-btn submit"
                onClick={() => {
                  setConfirmOpen(false);
                  void handleSubmit();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

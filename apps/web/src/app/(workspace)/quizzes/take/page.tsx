'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function TakeQuizPage() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [shareCode, setShareCode] = useState(initialCode);
  const [attempt, setAttempt] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Start Exam
  const handleStart = async (codeToUse?: string, retry = false) => {
    const raw = codeToUse || shareCode;
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setErrorMsg('');
    if (retry) {
      setResult(null);
      setAnswers({});
      setCurrentIdx(0);
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
      if (data.answers && Object.keys(data.answers).length > 0) {
        setAnswers(data.answers);
      }
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

  // Countdown timer calculated directly from server expiresAt
  useEffect(() => {
    if (!attempt || result) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, result]);

  // Periodic autosave
  useEffect(() => {
    if (!attempt || result || Object.keys(answers).length === 0) return;
    const saveTimer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch(`/api/attempts/${attempt.attemptId}/save-answers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        });
        if (res.ok) setSaveStatus('saved');
        else setSaveStatus('error');
      } catch {
        setSaveStatus('error');
      }
    }, 1500);

    return () => clearTimeout(saveTimer);
  }, [answers, attempt, result]);

  const handleSelectOption = (questionId: string, optionId: string, isMultiple = false) => {
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
    try {
      const finalAnswers = overrideAnswers || answersRef.current;
      const res = await fetch(`/api/attempts/${attempt.attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      }
    } catch {}
    setSubmitting(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // View 1: Enter code screen (Join Exam Card with Ambient Glow Canvas)
  if (!attempt) {
    return (
      <div className="take-exam-canvas">
        <style>{`
          .take-exam-canvas {
            position: relative;
            min-height: calc(100vh - 128px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 16px;
            background-color: var(--ux-page);
            overflow: hidden;
            transition: background-color .2s ease;
          }
          .ambient-radial-glow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 720px;
            height: 560px;
            max-width: 92vw;
            max-height: 92vh;
            background: radial-gradient(ellipse 65% 55% at 50% 50%, rgba(99, 102, 241, 0.12) 0%, rgba(56, 189, 248, 0.05) 45%, transparent 75%);
            pointer-events: none;
            z-index: 0;
            filter: blur(24px);
            opacity: var(--ux-glow-opacity, 0.8);
          }
          .join-card {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 480px;
            padding: 44px 36px;
            border-radius: 16px; /* rounded-2xl */
            background: var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: 0 25px 50px -12px var(--ux-shadow-strong), 0 0 0 1px var(--ux-line);
            text-align: center;
            backdrop-filter: blur(8px);
            transition: background-color .2s ease, border-color .2s ease;
          }
          .join-icon-badge {
            width: 56px;
            height: 56px;
            margin: 0 auto 20px;
            border-radius: 16px;
            background: var(--ux-accent-soft);
            border: 1px solid var(--ux-accent-soft);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--ux-accent-text);
            box-shadow: 0 4px 16px var(--ux-shadow);
          }
          .join-title {
            font-size: 24px;
            font-weight: 800;
            color: var(--ux-ink);
            margin: 0 0 8px;
            letter-spacing: -0.02em;
          }
          .join-desc {
            font-size: 14px;
            color: var(--ux-ink-3);
            margin: 0 0 24px;
            line-height: 1.5;
          }
          .join-input {
            width: 100%;
            height: 54px;
            border-radius: 12px;
            background: var(--ux-surface-2); /* Inset depth: darker than card */
            border: 1px solid var(--ux-line-2);
            text-align: center;
            font-size: 19px;
            font-weight: 700;
            letter-spacing: 3px;
            color: var(--ux-ink);
            outline: none;
            margin: 0 0 16px;
            text-transform: uppercase;
            box-shadow: inset 0 2px 4px var(--ux-shadow);
            transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
          }
          .join-input::placeholder {
            color: var(--ux-ink-3);
            letter-spacing: 1px;
            font-weight: 500;
            font-size: 15px;
          }
          .join-input:focus {
            border-color: var(--ux-accent);
            box-shadow: 0 0 0 3px var(--ux-accent-soft), inset 0 2px 4px var(--ux-shadow);
          }
          .join-btn {
            width: 100%;
            height: 50px;
            border-radius: 12px;
            background: #4F46E5; /* bg-indigo-600 */
            color: #FFFFFF;
            border: none;
            font-size: 15px;
            font-weight: 600; /* font-semibold */
            cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.25), 0 4px 6px -4px rgba(99, 102, 241, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
          }
          .join-btn:hover {
            background: #6366F1; /* bg-indigo-500 */
            box-shadow: 0 14px 20px -3px rgba(99, 102, 241, 0.35);
            transform: translateY(-1px);
          }
          .join-btn:active {
            background: #4338CA;
            transform: translateY(1px);
            box-shadow: 0 6px 10px -2px rgba(99, 102, 241, 0.25);
          }
          .join-error {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: var(--ux-danger);
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
            padding: 8px 12px;
            background: color-mix(in srgb, var(--ux-danger) 10%, transparent);
            border-radius: 8px;
            border: 1px solid color-mix(in srgb, var(--ux-danger) 25%, transparent);
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
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            autoFocus
            aria-label="Mã đề thi"
          />

          {errorMsg && (
            <div className="join-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <button className="join-btn" onClick={() => handleStart()} type="button">
            <span>Bắt đầu làm bài thi</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // View 3: Result Screen
  if (result) {
    const questionsList = result.details?.questions || [];
    const incorrectQuestions = questionsList.filter((q: any) => !q.correct);

    return (
      <div className="ux" style={{ maxWidth: '850px', margin: '0 auto' }}>
        <style>{`
          .res-card {
            padding: 40px 32px;
            border-radius: 16px;
            background: var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: 0 25px 50px -12px var(--ux-shadow-strong);
            margin-bottom: 24px;
            text-align: center;
          }
          .res-icon-badge {
            width: 64px;
            height: 64px;
            margin: 0 auto 16px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .res-icon-pass {
            background: color-mix(in srgb, var(--ux-mint) 12%, transparent);
            border: 1px solid color-mix(in srgb, var(--ux-mint) 25%, transparent);
            color: var(--ux-mint);
          }
          .res-icon-fail {
            background: color-mix(in srgb, var(--ux-danger) 12%, transparent);
            border: 1px solid color-mix(in srgb, var(--ux-danger) 25%, transparent);
            color: var(--ux-danger);
          }
          .res-score {
            font-size: 56px;
            font-weight: 900;
            color: ${result.passed ? 'var(--ux-mint)' : 'var(--ux-danger)'};
            letter-spacing: -0.03em;
            margin: 8px 0 4px;
          }
          .res-status {
            display: inline-block;
            padding: 6px 18px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 800;
            background: ${result.passed ? 'color-mix(in srgb, var(--ux-mint) 15%, transparent)' : 'color-mix(in srgb, var(--ux-danger) 15%, transparent)'};
            color: ${result.passed ? 'var(--ux-mint)' : 'var(--ux-danger)'};
            margin-bottom: 20px;
          }
          .res-review-item {
            padding: 20px;
            border-radius: 14px;
            background: var(--ux-surface-2);
            border: 1px solid var(--ux-line);
            margin-bottom: 16px;
            text-align: left;
          }
          .citation-tag {
            margin-top: 10px;
            padding: 10px 14px;
            border-radius: 8px;
            background: var(--ux-surface);
            font-size: 13px;
            color: var(--ux-ink-2);
            border-left: 3px solid var(--ux-accent);
          }
        `}</style>

        <div className="res-card">
          <div className={`res-icon-badge ${result.passed ? 'res-icon-pass' : 'res-icon-fail'}`} aria-hidden="true">
            {result.passed ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            )}
          </div>

          <div className="res-score">
            {result.score} / {result.totalPoints}
          </div>
          <div className="res-status">
            {result.passed ? 'KẾT QUẢ: ĐẠT' : 'KẾT QUẢ: CẦN CỐ GẮNG'}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--ux-ink-3)', margin: '0 0 24px', lineHeight: 1.5 }}>
            {result.passed
              ? 'Chúc mừng bạn đã hoàn thành xuất sắc bài kiểm tra!'
              : 'Hãy xem lại các câu chưa chính xác và tiếp tục luyện tập.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'var(--ux-surface-2)',
                border: '1px solid var(--ux-line)',
                color: 'var(--ux-ink)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Về bảng điều khiển
            </Link>
            <Link
              href="/study"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                borderRadius: '12px',
                background: 'var(--ux-accent)',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Luyện lại câu sai ({incorrectQuestions.length})</span>
            </Link>
            <button
              type="button"
              onClick={() => handleStart(shareCode || initialCode, true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 0,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>Làm lại bài thi (Luyện tập)</span>
            </button>
          </div>
        </div>

        {questionsList.length > 0 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ux-ink)', marginBottom: '16px' }}>
              Chi tiết giải thích & Căn cứ trích dẫn nguồn:
            </h3>
            {questionsList.map((q: any, idx: number) => (
              <div
                key={idx}
                className="res-review-item"
                style={{
                  borderLeft: `4px solid ${q.correct ? 'var(--ux-mint)' : 'var(--ux-danger)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '14px', color: q.correct ? 'var(--ux-mint)' : 'var(--ux-danger)' }}>
                    Câu {idx + 1}: {q.correct ? '✓ Đúng' : '✕ Chưa đúng'} (+{q.earnedPoints}/{q.points} điểm)
                  </b>
                </div>

                {q.explanation && (
                  <div style={{ fontSize: '13px', color: 'var(--ux-ink-2)', marginTop: '8px', lineHeight: 1.6 }}>
                    <b style={{ color: 'var(--ux-ink)' }}>Giải thích chi tiết:</b> {q.explanation}
                  </div>
                )}

                {q.sourceRefs?.length > 0 && (
                  <div className="citation-tag">
                    <b style={{ color: 'var(--ux-accent)' }}>Trích dẫn tài liệu:</b> "{q.sourceRefs[0].quote}"
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
  const answeredCount = Object.keys(answers).filter(k => (answers[k] || []).length > 0).length;

  return (
    <div className="ux" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <style>{`
        .exam-header {
          padding: 16px 24px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 25px -5px var(--ux-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .timer-badge {
          font-family: monospace;
          font-size: 22px;
          font-weight: 800;
          color: ${timeLeftSec < 120 ? 'var(--ux-danger)' : 'var(--ux-accent)'};
          padding: 6px 14px;
          border-radius: 10px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .exam-layout {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 24px;
        }
        @media (max-width: 800px) {
          .exam-layout { grid-template-columns: 1fr; }
        }
        .q-box {
          padding: 32px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 25px -5px var(--ux-shadow);
        }
        .q-stem {
          font-size: 18px;
          font-weight: 700;
          color: var(--ux-ink);
          line-height: 1.55;
          margin-bottom: 24px;
        }
        .opt-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .opt-btn {
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          color: var(--ux-ink);
          text-align: left;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .opt-btn:hover {
          border-color: var(--ux-accent);
          background: var(--ux-surface-3);
        }
        .opt-btn.selected {
          border-color: var(--ux-accent);
          background: var(--ux-accent-soft);
          color: var(--ux-accent-text);
          font-weight: 700;
          box-shadow: 0 0 0 1px var(--ux-accent);
        }
        .palette {
          padding: 24px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 25px -5px var(--ux-shadow);
          height: fit-content;
        }
        .palette-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 14px;
        }
        .palette-num {
          height: 42px;
          border-radius: 10px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          font-size: 14px;
          font-weight: 700;
          color: var(--ux-ink-3);
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .palette-num:hover {
          border-color: var(--ux-accent);
          color: var(--ux-ink);
        }
        .palette-num.done {
          background: var(--ux-mint);
          color: white;
          border-color: var(--ux-mint);
        }
        .palette-num.current {
          border-color: var(--ux-accent);
          color: var(--ux-accent-text);
          box-shadow: 0 0 0 2px var(--ux-accent);
          font-weight: 800;
        }
      `}</style>

      <div className="exam-header">
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ux-ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Bài kiểm tra đang diễn ra
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ux-ink)', marginTop: '2px' }}>
            {attempt.quizTitle}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--ux-ink-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {saveStatus === 'saving' ? (
              <span>Đang lưu...</span>
            ) : saveStatus === 'saved' ? (
              <span style={{ color: 'var(--ux-mint)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Đã đồng bộ
              </span>
            ) : (
              <span style={{ color: 'var(--ux-danger)' }}>Lỗi lưu</span>
            )}
          </div>
          <div className="timer-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formatTimer(timeLeftSec)}</span>
          </div>
        </div>
      </div>

      <div className="exam-layout">
        <div className="q-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ux-accent-text)', letterSpacing: '0.04em' }}>
              CÂU {currentIdx + 1} / {attempt.questions.length}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--ux-ink-3)', fontWeight: 600 }}>
              {currentQ.points} điểm
            </span>
          </div>

          <div className="q-stem">{currentQ.stem}</div>

          {(!currentQ.options || currentQ.options.length === 0 || currentQ.type === 'fill' || currentQ.type === 'short') ? (
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ux-ink-2)', marginBottom: '8px' }}>
                Nhập câu trả lời của bạn:
              </label>
              <input
                type="text"
                value={answers[currentQ.id]?.[0] || ''}
                onChange={e => {
                  const val = e.target.value;
                  setAnswers(prev => ({
                    ...prev,
                    [currentQ.id]: [val],
                  }));
                }}
                placeholder="Nhập câu trả lời tại đây..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--ux-line-2)',
                  background: 'var(--ux-surface-2)',
                  color: 'var(--ux-ink)',
                  fontSize: '15px',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <div className="opt-list">
              {currentQ.options?.map((opt: any, oIdx: number) => {
                const isSelected = selectedOptions.includes(opt.id);
                const label = String.fromCharCode(65 + oIdx);
                return (
                  <button
                    key={opt.id}
                    className={`opt-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(currentQ.id, opt.id, currentQ.type === 'multiple')}
                  >
                    <span
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--ux-accent)' : 'var(--ux-surface)',
                        border: isSelected ? 'none' : '1px solid var(--ux-line)',
                        color: isSelected ? 'white' : 'var(--ux-ink-2)',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 800,
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </span>
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
            <button
              onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '12px',
                border: '1px solid var(--ux-line)',
                background: 'var(--ux-surface-2)',
                color: 'var(--ux-ink)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIdx === 0 ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Câu trước</span>
            </button>

            {currentIdx < attempt.questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(prev => Math.min(attempt.questions.length - 1, prev + 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'var(--ux-accent)',
                  color: 'white',
                  border: 0,
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                }}
              >
                <span>Câu tiếp theo</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={submitting}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: 'var(--ux-mint)',
                  color: 'white',
                  border: 0,
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="palette">
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ux-ink)' }}>
            Danh sách câu hỏi
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ux-ink-3)', marginTop: '2px' }}>
            Đã làm: {answeredCount} / {attempt.questions.length} câu
          </div>

          <div className="palette-grid">
            {attempt.questions.map((q: any, idx: number) => {
              const isAnswered = (answers[q.id] || []).length > 0;
              const isCurrent = idx === currentIdx;
              return (
                <button
                  type="button"
                  key={q.id}
                  aria-label={`Câu hỏi ${idx + 1}: ${isAnswered ? 'Đã trả lời' : 'Chưa làm'}`}
                  className={`palette-num ${isAnswered ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                  onClick={() => setCurrentIdx(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={submitting}
              style={{
                width: '100%',
                height: '46px',
                borderRadius: '12px',
                background: 'var(--ux-mint)',
                color: 'white',
                border: 0,
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

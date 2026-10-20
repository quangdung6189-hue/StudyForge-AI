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
  const handleStart = async (codeToUse?: string) => {
    const raw = codeToUse || shareCode;
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setErrorMsg('');

    try {
      const res = await fetch('/api/attempts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareCode: code }),
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

  // View 1: Enter code screen
  if (!attempt) {
    return (
      <div className="ux" style={{ maxWidth: '500px', margin: '60px auto', textAlign: 'center' }}>
        <style>{`
          .join-card {
            padding: 40px 32px;
            border-radius: 28px;
            background: var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: 0 10px 40px var(--ux-shadow);
          }
          .join-input {
            width: 100%;
            height: 56px;
            border-radius: 14px;
            border: 1px solid var(--ux-line);
            background: var(--ux-surface-2);
            text-align: center;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: 2px;
            color: var(--ux-ink);
            outline: none;
            margin: 20px 0;
            text-transform: uppercase;
          }
          .join-input:focus {
            border-color: var(--ux-accent);
            box-shadow: 0 0 0 3px var(--ux-accent-soft);
          }
          .join-btn {
            width: 100%;
            height: 50px;
            border-radius: 14px;
            background: var(--ux-accent);
            color: white;
            border: 0;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
          }
        `}</style>

        <div className="join-card">
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✍️</div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px' }}>Phòng thi trực tuyến</h1>
          <p style={{ fontSize: '14px', color: 'var(--ux-ink-3)', margin: 0 }}>
            Nhập mã chia sẻ đề thi từ giáo viên để bắt đầu làm bài.
          </p>

          <input
            className="join-input"
            placeholder="VD: SINHHOC8DEMO"
            value={shareCode}
            onChange={e => setShareCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />

          {errorMsg && (
            <div style={{ color: 'var(--ux-danger)', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          <button className="join-btn" onClick={() => handleStart()}>
            Bắt đầu làm bài thi
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
            padding: 36px;
            border-radius: 26px;
            background: var(--ux-surface);
            border: 1px solid var(--ux-line);
            box-shadow: 0 10px 40px var(--ux-shadow);
            margin-bottom: 24px;
            text-align: center;
          }
          .res-score {
            font-size: 56px;
            font-weight: 900;
            color: ${result.passed ? 'var(--ux-mint)' : 'var(--ux-danger)'};
            letter-spacing: -0.03em;
            margin: 12px 0 4px;
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
            border-radius: 16px;
            background: var(--ux-surface-2);
            margin-bottom: 16px;
            text-align: left;
          }
          .citation-tag {
            margin-top: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--ux-surface);
            font-size: 12px;
            color: var(--ux-ink-2);
            border-left: 3px solid var(--ux-accent);
          }
        `}</style>

        <div className="res-card">
          <div style={{ fontSize: '48px' }}>{result.passed ? '🏆' : '📚'}</div>
          <div className="res-score">
            {result.score} / {result.totalPoints}
          </div>
          <div className="res-status">
            {result.passed ? 'KẾT QUẢ: ĐẠT' : 'KẾT QUẢ: CẦN CỐ GẮNG'}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--ux-ink-2)', margin: '0 0 24px' }}>
            {result.passed
              ? 'Chúc mừng bạn đã hoàn thành xuất sắc bài kiểm tra!'
              : 'Hãy xem lại các câu chưa chính xác và luyện tập lại.'}
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link
              href="/dashboard"
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'var(--ux-surface-2)',
                color: 'var(--ux-ink)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Về bảng điều khiển
            </Link>
            <Link
              href="/study"
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                background: 'var(--ux-accent)',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              🔄 Luyện lại câu sai ({incorrectQuestions.length})
            </Link>
          </div>
        </div>

        {questionsList.length > 0 && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>
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
                  <div style={{ fontSize: '13px', color: 'var(--ux-ink)', marginTop: '8px' }}>
                    <b>Giải thích chi tiết:</b> {q.explanation}
                  </div>
                )}

                {q.sourceRefs?.length > 0 && (
                  <div className="citation-tag">
                    <b>Trích dẫn tài liệu:</b> "{q.sourceRefs[0].quote}"
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
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 20px var(--ux-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .timer-badge {
          font-family: monospace;
          font-size: 24px;
          font-weight: 800;
          color: ${timeLeftSec < 120 ? 'var(--ux-danger)' : 'var(--ux-accent)'};
          padding: 6px 16px;
          border-radius: 12px;
          background: var(--ux-surface-2);
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
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 6px 24px var(--ux-shadow);
        }
        .q-stem {
          font-size: 18px;
          font-weight: 750;
          color: var(--ux-ink);
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .opt-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .opt-btn {
          padding: 16px 20px;
          border-radius: 16px;
          border: 2px solid var(--ux-line);
          background: var(--ux-surface);
          color: var(--ux-ink);
          text-align: left;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color .2s, background-color .2s, transform .15s;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .opt-btn:hover {
          border-color: var(--ux-line-2);
          background: var(--ux-surface-2);
        }
        .opt-btn.selected {
          border-color: var(--ux-accent);
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
          font-weight: 750;
        }
        .palette {
          padding: 24px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
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
          color: var(--ux-ink);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .palette-num.done {
          background: var(--ux-mint);
          color: white;
          border-color: var(--ux-mint);
        }
        .palette-num.current {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 2px var(--ux-accent);
        }
      `}</style>

      <div className="exam-header">
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ux-ink-3)', textTransform: 'uppercase' }}>
            Bài kiểm tra đang diễn ra
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ux-ink)' }}>
            {attempt.quizTitle}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--ux-ink-3)' }}>
            {saveStatus === 'saving' ? 'Đang lưu...' : saveStatus === 'saved' ? '✓ Đã đồng bộ' : '⚠️ Lỗi lưu'}
          </div>
          <div className="timer-badge">
            <span>⏱️</span>
            <span>{formatTimer(timeLeftSec)}</span>
          </div>
        </div>
      </div>

      <div className="exam-layout">
        <div className="q-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ux-accent)' }}>
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
                  border: '1px solid var(--ux-line)',
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
                        background: isSelected ? 'var(--ux-accent)' : 'var(--ux-surface-2)',
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
                padding: '12px 20px',
                borderRadius: '12px',
                border: '1px solid var(--ux-line)',
                background: 'var(--ux-surface-2)',
                fontWeight: 700,
                fontSize: '14px',
                cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIdx === 0 ? 0.4 : 1,
              }}
            >
              ← Câu trước
            </button>

            {currentIdx < attempt.questions.length - 1 ? (
              <button
                onClick={() => setCurrentIdx(prev => Math.min(attempt.questions.length - 1, prev + 1))}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  background: 'var(--ux-accent)',
                  color: 'white',
                  border: 0,
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Câu tiếp theo →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={submitting}
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: 'var(--ux-mint)',
                  color: 'white',
                  border: 0,
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {submitting ? 'Đang chấm điểm...' : 'Nộp bài thi ✓'}
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
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Đang chấm điểm...' : 'Nộp bài thi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

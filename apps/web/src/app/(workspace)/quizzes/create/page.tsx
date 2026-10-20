'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CreateQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get('docId') || '';

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'ai_generate' | 'extract_existing'>('ai_generate');
  const [questionCount, setQuestionCount] = useState(5);
  const [types, setTypes] = useState<string[]>(['single', 'boolean']);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [allowReview, setAllowReview] = useState(true);

  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [publishedInfo, setPublishedInfo] = useState<{ shareCode: string; shareUrl: string } | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/documents')
      .then(res => res.json())
      .then(data => {
        setDocuments(data.items || []);
        if (data.items?.length && !selectedDocId) {
          setSelectedDocId(data.items[0].id);
          setTitle(`Bài kiểm tra: ${data.items[0].title}`);
        }
      });
  }, []);

  const handleDocChange = (docId: string) => {
    setSelectedDocId(docId);
    const doc = documents.find(d => d.id === docId);
    if (doc) setTitle(`Bài kiểm tra: ${doc.title}`);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId,
          mode,
          questionCount,
          types,
        }),
      });

      const data = await res.json();
      if (res.ok && data.questions) {
        setQuestions(data.questions);
        setStep(3);
      }
    } catch {}
    setLoading(false);
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      // 1. Save Quiz
      const saveRes = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId,
          title,
          durationMinutes,
          questions,
        }),
      });

      const saveData = await saveRes.json();
      if (saveRes.ok && saveData.quiz) {
        const quizId = saveData.quiz.id;
        // 2. Publish Quiz
        const pubRes = await fetch(`/api/quizzes/${quizId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            durationMinutes,
            allowReview,
          }),
        });

        const pubData = await pubRes.json();
        if (pubRes.ok) {
          setPublishedInfo({
            shareCode: pubData.shareCode,
            shareUrl: pubData.shareUrl,
          });
          setStep(4);
        }
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div className="ux" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <style>{`
        .wiz-steps {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
          position: relative;
        }
        .wiz-step {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink-3);
        }
        .wiz-step.active {
          color: var(--ux-accent);
        }
        .wiz-step.done {
          color: var(--ux-mint);
        }
        .wiz-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid var(--ux-line-2);
          display: grid;
          place-items: center;
          font-weight: 800;
          background: var(--ux-surface);
        }
        .wiz-step.active .wiz-num {
          border-color: var(--ux-accent);
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
        }
        .wiz-step.done .wiz-num {
          border-color: var(--ux-mint);
          background: var(--ux-mint);
          color: var(--ux-accent-ink);
        }
        .card-box {
          padding: 32px;
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 30px var(--ux-shadow);
        }
        .f-group {
          margin-bottom: 20px;
        }
        .f-label {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--ux-ink);
          margin-bottom: 8px;
        }
        .f-input {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          padding: 0 16px;
          font-family: inherit;
          font-size: 14px;
          color: var(--ux-ink);
          outline: none;
        }
        .f-input:focus {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
        }
        .q-card {
          padding: 20px;
          border-radius: 18px;
          background: var(--ux-surface-2);
          margin-bottom: 16px;
          border-left: 4px solid var(--ux-accent);
        }
        .origin-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .origin-ai {
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
        }
        .origin-doc {
          background: color-mix(in srgb, var(--ux-mint) 15%, transparent);
          color: var(--ux-mint);
        }
        .citation-box {
          margin-top: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--ux-surface);
          font-size: 12px;
          color: var(--ux-ink-2);
        }
      `}</style>

      <div className="wiz-steps">
        <div className={`wiz-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
          <div className="wiz-num">{step > 1 ? '✓' : '1'}</div>
          <span>Chọn tài liệu</span>
        </div>
        <div className={`wiz-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>
          <div className="wiz-num">{step > 2 ? '✓' : '2'}</div>
          <span>Cấu hình đề</span>
        </div>
        <div className={`wiz-step ${step === 3 ? 'active' : step > 3 ? 'done' : ''}`}>
          <div className="wiz-num">{step > 3 ? '✓' : '3'}</div>
          <span>Duyệt & Sửa</span>
        </div>
        <div className={`wiz-step ${step === 4 ? 'active' : ''}`}>
          <div className="wiz-num">4</div>
          <span>Xuất bản</span>
        </div>
      </div>

      {step === 1 && (
        <div className="card-box">
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Bước 1: Chọn tài liệu gốc</h2>
          <p style={{ color: 'var(--ux-ink-3)', fontSize: '14px', marginBottom: '24px' }}>
            AI sẽ phân tích các đoạn trích dẫn (chunks) từ tài liệu này để tạo câu hỏi.
          </p>

          <div className="f-group">
            <label className="f-label">Tài liệu trong thư viện</label>
            <select
              className="f-input"
              value={selectedDocId}
              onChange={e => handleDocChange(e.target.value)}
            >
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.fileType})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => setStep(2)}
              disabled={!selectedDocId}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                background: 'var(--ux-accent)',
                color: 'var(--ux-accent-ink)',
                border: 0,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tiếp tục: Cấu hình đề →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card-box">
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px' }}>Bước 2: Cấu hình bài kiểm tra</h2>
          <p style={{ color: 'var(--ux-ink-3)', fontSize: '14px', marginBottom: '24px' }}>
            Thiết lập tiêu đề, số lượng câu hỏi và chế độ sinh trắc nghiệm.
          </p>

          <div className="f-group">
            <label className="f-label">Tiêu đề bài kiểm tra</label>
            <input
              type="text"
              className="f-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="f-group">
            <label className="f-label">Chế độ tạo câu hỏi</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'ai_generate'}
                  onChange={() => setMode('ai_generate')}
                />
                <b>AI suy luận từ tài liệu</b> (Sinh câu mới có giải thích)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'extract_existing'}
                  onChange={() => setMode('extract_existing')}
                />
                <b>Trích xuất đề có sẵn</b> (Giữ nguyên cấu trúc gốc)
              </label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="f-group">
              <label className="f-label">Số lượng câu hỏi</label>
              <input
                type="number"
                min={1}
                max={20}
                className="f-input"
                value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
              />
            </div>
            <div className="f-group">
              <label className="f-label">Thời lượng làm bài (phút)</label>
              <input
                type="number"
                min={5}
                max={180}
                className="f-input"
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'var(--ux-surface-2)',
                color: 'var(--ux-ink)',
                border: 0,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Quay lại
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                background: 'var(--ux-grad)',
                color: 'white',
                border: 0,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Đang tạo câu hỏi...' : '✨ Bắt đầu tạo đề nháp'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Bước 3: Duyệt bản nháp câu hỏi ({questions.length} câu)</h2>
              <p style={{ color: 'var(--ux-ink-3)', fontSize: '14px', margin: '4px 0 0' }}>
                Kiểm tra câu hỏi, các phương án và căn cứ trích dẫn nguồn trước khi phát hành.
              </p>
            </div>
            <button
              onClick={handlePublish}
              disabled={loading}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'var(--ux-mint)',
                color: 'white',
                border: 0,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Đang xuất bản...' : '🚀 Xuất bản & Lấy mã thi'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {questions.map((q, idx) => (
              <div key={idx} className="q-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`origin-badge ${q.answerOrigin === 'document' ? 'origin-doc' : 'origin-ai'}`}>
                      {q.answerOrigin === 'document' ? '📄 Đáp án gốc trong tài liệu' : '🤖 AI đề xuất (Cần duyệt)'}
                    </span>
                    {q.reviewed && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ux-mint)', background: 'color-mix(in srgb, var(--ux-mint) 15%, transparent)', padding: '2px 8px', borderRadius: '6px' }}>
                        ✓ Đã duyệt
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ux-ink-3)' }}>
                      {q.points} điểm · {q.type === 'single' ? 'Trắc nghiệm đơn' : q.type === 'boolean' ? 'Đúng/Sai' : q.type === 'multiple' ? 'Nhiều đáp án' : 'Điền từ'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--ux-line)',
                        background: 'var(--ux-surface-2)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        color: 'var(--ux-ink-2)',
                      }}
                    >
                      {editingIdx === idx ? 'Đóng' : '✏️ Sửa'}
                    </button>
                  </div>
                </div>

                {editingIdx === idx ? (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ux-ink-2)', marginBottom: '4px' }}>
                        Nội dung câu hỏi:
                      </label>
                      <textarea
                        value={q.stem}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, stem: val, reviewed: true } : item));
                        }}
                        style={{
                          width: '100%',
                          minHeight: '60px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--ux-line)',
                          background: 'var(--ux-surface)',
                          color: 'var(--ux-ink)',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--ux-ink-2)', marginBottom: '4px' }}>
                        Giải thích chi tiết:
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, explanation: val, reviewed: true } : item));
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--ux-line)',
                          background: 'var(--ux-surface)',
                          color: 'var(--ux-ink)',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions(prev => prev.map((item, i) => i === idx ? { ...item, reviewed: true } : item));
                          setEditingIdx(null);
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: 'var(--ux-mint)',
                          color: 'white',
                          border: 0,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Lưu & Xác nhận duyệt
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '15px', fontWeight: 700, margin: '8px 0' }}>
                    Câu {idx + 1}: {q.stem}
                  </div>
                )}

                {q.options?.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', margin: '12px 0' }}>
                    {q.options.map((opt: any) => {
                      const isCorrect = q.correctOptionIds?.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: isCorrect ? 'color-mix(in srgb, var(--ux-mint) 15%, transparent)' : 'var(--ux-surface)',
                            border: `1px solid ${isCorrect ? 'var(--ux-mint)' : 'var(--ux-line)'}`,
                            fontSize: '13px',
                            fontWeight: isCorrect ? 700 : 500,
                            color: isCorrect ? 'var(--ux-mint)' : 'var(--ux-ink)',
                          }}
                        >
                          {opt.text} {isCorrect && '✓ (Đáp án đúng)'}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.explanation && (
                  <div style={{ fontSize: '13px', color: 'var(--ux-ink-2)', marginTop: '8px' }}>
                    <b>Giải thích:</b> {q.explanation}
                  </div>
                )}

                {q.sourceRefs?.length > 0 && (
                  <div className="citation-box">
                    <b>🔗 Trích dẫn nguồn (sourceRefs):</b> "{q.sourceRefs[0].quote}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && publishedInfo && (
        <div className="card-box" style={{ textAlign: 'center', padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 10px' }}>
            Xuất bản đề thi thành công!
          </h2>
          <p style={{ color: 'var(--ux-ink-2)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 24px', lineHeight: 1.5 }}>
            Đề thi đã được lưu phiên bản bất biến (immutable snapshot). Học sinh cần đăng nhập tài khoản để vào làm bài.
          </p>

          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '20px 24px',
              borderRadius: '18px',
              background: 'var(--ux-surface-2)',
              border: '2px dashed var(--ux-accent)',
              marginBottom: '28px',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--ux-ink-3)', textTransform: 'uppercase' }}>
              Mã tham gia bài thi
            </span>
            <span style={{ fontSize: 'clamp(20px, 6vw, 30px)', fontWeight: 900, color: 'var(--ux-accent)', letterSpacing: '2px', margin: '8px 0', wordBreak: 'break-all' }}>
              {publishedInfo.shareCode}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(publishedInfo.shareCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{
                marginTop: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid var(--ux-line)',
                background: 'var(--ux-surface)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--ux-ink-2)',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Đã sao chép mã!' : '📋 Sao chép mã'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href={`/quizzes/take?code=${publishedInfo.shareCode}`}
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'var(--ux-accent)',
                color: 'white',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              ✍️ Tự làm thử bài kiểm tra này
            </Link>
            <Link
              href="/quizzes"
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: 'var(--ux-surface-2)',
                color: 'var(--ux-ink)',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Về ngân hàng đề
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function QuizzesListPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="ux">
      <style>{`
        .qz-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .qz-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .qz-desc {
          font-size: 14px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .qz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
          gap: 20px;
        }
        .qz-card {
          padding: 24px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 16px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .qz-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .qz-name {
          font-size: 17px;
          font-weight: 800;
          color: var(--ux-ink);
        }
        .badge-pub {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: color-mix(in srgb, var(--ux-mint) 15%, transparent);
          color: var(--ux-mint);
        }
        .badge-draft {
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: var(--ux-surface-2);
          color: var(--ux-ink-3);
        }
        .share-pill {
          padding: 8px 12px;
          border-radius: 10px;
          background: var(--ux-surface-2);
          font-size: 12px;
          font-weight: 700;
          color: var(--ux-accent);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
      `}</style>

      <div className="qz-header">
        <div>
          <h1 className="qz-title">Ngân hàng câu hỏi & Đề thi</h1>
          <p className="qz-desc">
            Quản lý các bộ đề đã tạo, xuất bản bài thi và chia sẻ mã tham gia cho học sinh.
          </p>
        </div>
        <Link
          href="/quizzes/create"
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            background: 'var(--ux-accent)',
            color: 'var(--ux-accent-ink)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 800,
          }}
        >
          ✨ Tạo đề kiểm tra mới
        </Link>
      </div>

      {error && <div role="alert">{error} <button onClick={() => void fetchQuizzes()}>Thử tải lại</button></div>}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ux-ink-3)' }}>
          Đang tải danh sách đề thi...
        </div>
      ) : quizzes.length === 0 && !error ? (
        <div style={{ padding: '60px', textAlign: 'center', background: 'var(--ux-surface)', borderRadius: '20px' }}>
          Chưa có đề thi nào trong ngân hàng. Hãy nhấn <b>Tạo đề kiểm tra mới</b>.
        </div>
      ) : (
        <div className="qz-grid">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="qz-card">
              <div className="qz-card-top">
                <span className={quiz.isPublished ? 'badge-pub' : 'badge-draft'}>
                  {quiz.isPublished ? 'Đã phát hành' : 'Bản nháp'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--ux-ink-3)', fontWeight: 600 }}>
                  {quiz.durationMinutes} phút
                </span>
              </div>

              <div className="qz-name">{quiz.title}</div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ux-ink-2)' }}>
                {quiz.description || 'Bài kiểm tra ôn tập kiến thức'}
              </p>

              {quiz.shareCode && (
                <div className="share-pill">
                  <span>Mã thi: <b>{quiz.shareCode}</b></span>
                  <Link
                    href={`/quizzes/take?code=${quiz.shareCode}`}
                    style={{ color: 'var(--ux-accent)', textDecoration: 'none' }}
                  >
                    Vào thi →
                  </Link>
                </div>
              )}

              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', paddingTop: '12px' }}>
                {!quiz.isPublished && <Link href={`/quizzes/create?quizId=${quiz.id}`}>Tiếp tục duyệt bản nháp →</Link>}
                {quiz.shareCode && (
                  <Link
                    href={`/quizzes/take?code=${quiz.shareCode}`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'var(--ux-accent)',
                      color: 'white',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    ✍️ Làm bài thi
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function QuizzesListPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

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
        .qz-title-group h1 {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
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
          padding: 12px 22px;
          border-radius: 14px;
          background: var(--ux-accent);
          color: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 4px 16px color-mix(in srgb, var(--ux-accent) 35%, transparent);
          transition: all 0.2s var(--ux-ease);
        }
        .qz-create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--ux-accent) 45%, transparent);
          filter: brightness(1.05);
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
          padding: 0 14px 0 38px;
          font-size: 13px;
          color: var(--ux-ink);
          transition: border-color .2s;
        }
        .qz-search-input:focus {
          border-color: var(--ux-accent);
          outline: none;
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
        }
        .qz-search-ic {
          position: absolute;
          left: 12px;
          top: 12px;
          color: var(--ux-ink-3);
        }

        .qz-tabs {
          display: flex;
          gap: 6px;
          background: var(--ux-surface-2);
          padding: 4px;
          border-radius: 12px;
          border: 1px solid var(--ux-line);
        }
        .qz-tab {
          padding: 7px 14px;
          border-radius: 8px;
          border: 0;
          background: transparent;
          color: var(--ux-ink-2);
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all .2s;
        }
        .qz-tab.active {
          background: var(--ux-surface);
          color: var(--ux-ink);
          box-shadow: 0 2px 8px var(--ux-shadow);
        }

        .qz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 20px;
        }
        .qz-card {
          padding: 24px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 6px 20px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: transform .25s var(--ux-ease), box-shadow .25s, border-color .25s;
          position: relative;
        }
        .qz-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 36px var(--ux-shadow-strong);
          border-color: color-mix(in srgb, var(--ux-accent) 30%, transparent);
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
          transition: all 0.2s;
        }
        .share-pill-btn:hover {
          color: var(--ux-accent);
          background: var(--ux-surface);
        }

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
          color: #ffffff;
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 700;
          transition: all 0.2s var(--ux-ease);
        }
        .qz-btn-take:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
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
          transition: all 0.2s;
        }
        .qz-btn-edit:hover {
          border-color: var(--ux-accent);
          color: var(--ux-accent);
        }
      `}</style>

      {/* Header */}
      <div className="qz-header">
        <div className="qz-title-group">
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
            placeholder="Tìm theo tên đề thi hoặc mã tham gia…"
            aria-label="Tìm kiếm đề thi"
          />
        </div>

        <div className="qz-tabs" role="tablist">
          <button
            type="button"
            className={`qz-tab${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tất cả ({counts.all})
          </button>
          <button
            type="button"
            className={`qz-tab${filter === 'published' ? ' active' : ''}`}
            onClick={() => setFilter('published')}
          >
            Đã phát hành ({counts.published})
          </button>
          <button
            type="button"
            className={`qz-tab${filter === 'draft' ? ' active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Bản nháp ({counts.draft})
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '12px', background: 'color-mix(in srgb, var(--ux-danger) 10%, var(--ux-surface))', color: 'var(--ux-danger)', border: '1px solid var(--ux-danger)', marginBottom: '20px' }}>
          {error} <button style={{ marginLeft: '10px', textDecoration: 'underline', background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', fontWeight: 700 }} onClick={() => void fetchQuizzes()}>Thử tải lại</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--ux-ink-3)', fontSize: '14px' }}>
          Đang tải danh sách ngân hàng đề thi…
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--ux-surface)', borderRadius: '24px', border: '1px solid var(--ux-line)' }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 16px', borderRadius: '16px', background: 'var(--ux-surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ux-ink-3)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
        <div className="qz-grid">
          {filteredQuizzes.map((quiz) => (
            <div key={quiz.id} className="qz-card">
              <div className="qz-card-head">
                <span className={quiz.isPublished ? 'badge-pub' : 'badge-draft'}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: quiz.isPublished ? 'var(--ux-mint)' : 'var(--ux-ink-3)' }} />
                  {quiz.isPublished ? 'Đã phát hành' : 'Bản nháp'}
                </span>
                <span className="qz-duration">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  {quiz.durationMinutes || 15} phút
                </span>
              </div>

              <div>
                <h3 className="qz-name" title={quiz.title}>{quiz.title}</h3>
                <p className="qz-desc">{quiz.description || 'Bài kiểm tra ôn tập và đánh giá kiến thức.'}</p>
              </div>

              {quiz.shareCode && (
                <div className="share-pill">
                  <span>Mã thi: <b className="share-pill-code">{quiz.shareCode}</b></span>
                  <button
                    type="button"
                    className="share-pill-btn"
                    onClick={() => copyToClipboard(quiz.shareCode)}
                    title="Sao chép mã đề thi"
                  >
                    {copiedCode === quiz.shareCode ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Đã chép!
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        Sao chép mã
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="qz-card-foot">
                {quiz.shareCode && (
                  <Link href={`/quizzes/take?code=${quiz.shareCode}`} className="qz-btn-take">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Làm bài thi
                  </Link>
                )}
                <Link
                  href={quiz.isPublished ? `/quizzes/create?quizId=${quiz.id}` : `/quizzes/create?quizId=${quiz.id}`}
                  className="qz-btn-edit"
                  title="Chỉnh sửa hoặc xem cấu trúc đề"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  {quiz.isPublished ? 'Chi tiết' : 'Biên soạn'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

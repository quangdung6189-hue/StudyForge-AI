'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { QuizSettingsModal } from '@/components/lucian/QuizSettingsModal';

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

  const [customQuiz, setCustomQuiz] = useState<any | null>(null);
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
          animation: qzFadeIn 0.2s ease-out;
        }
        .qz-modal {
          width: 100%;
          max-width: 580px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          border-radius: 24px;
          box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          animation: qzScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
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
          transition: background 0.2s;
        }
        .qz-modal-close:hover {
          background: var(--ux-surface-3);
          color: var(--ux-ink);
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
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .qz-mode-card:hover {
          border-color: var(--ux-accent);
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
        .qz-form-input:focus, .qz-form-textarea:focus {
          border-color: var(--ux-accent);
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
        }
        .qz-btn-save {
          padding: 10px 22px;
          border-radius: 12px;
          background: var(--ux-accent);
          border: 0;
          color: white;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px color-mix(in srgb, var(--ux-accent) 30%, transparent);
          transition: transform 0.2s;
        }
        .qz-btn-save:hover:not(:disabled) {
          transform: translateY(-1px);
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
          {filteredQuizzes.map((quiz) => {
            const isPractice = quiz.description?.includes('[mode:practice]');
            const displayDesc = (quiz.description || 'Bài kiểm tra ôn tập và đánh giá kiến thức.').replace(/\[mode:(?:practice|exam)\]\s*/g, '');
            return (
            <div key={quiz.id} className="qz-card">
              <div className="qz-card-head">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={quiz.isPublished ? 'badge-pub' : 'badge-draft'}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: quiz.isPublished ? 'var(--ux-mint)' : 'var(--ux-ink-3)' }} />
                    {quiz.isPublished ? 'Đã phát hành' : 'Bản nháp'}
                  </span>
                  {quiz.isPublished && (
                    <span className={isPractice ? 'badge-practice' : 'badge-exam'}>
                      {isPractice ? '🔄 Luyện tập' : '📝 Bài kiểm tra'}
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

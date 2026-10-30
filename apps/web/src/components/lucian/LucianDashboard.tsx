// Lucian UX/UI Prompt · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/
// Dashboard home: welcome card, stat cards, document & quiz lists with empty states (port of #088 empty state)
'use client';

import Link from 'next/link';

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
}

export function LucianDashboard({ docs, quizzes }: LucianDashboardProps) {
  const readyDocs = docs.filter((d) => d.status === 'ready');
  return (
    <div className="ux" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <style>{`
        .ld-welcome {
          padding: 32px;
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 30px var(--ux-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }
        .ld-welcome-text { flex: 1; min-width: 220px; }
        .ld-welcome h2 {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .ld-welcome p {
          font-size: 14px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .ld-welcome-actions { display: flex; gap: 10px; flex-shrink: 0; }
        .ld-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 14px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: transform .15s var(--ux-ease), box-shadow .2s, border-color .2s;
        }
        .ld-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--ux-shadow); border-color: var(--ux-line-2); }
        .ld-btn.primary { background: var(--ux-accent); color: var(--ux-accent-ink); border-color: var(--ux-accent); }
        .ld-btn.primary:hover { box-shadow: 0 8px 24px var(--ux-shadow-strong); }

        .ld-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
        .ld-stat {
          padding: 20px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 14px var(--ux-shadow);
        }
        .ld-stat-val {
          font-size: 32px;
          font-weight: 900;
          color: var(--ux-accent);
          letter-spacing: -0.02em;
        }
        .ld-stat-lbl { font-size: 13px; font-weight: 600; color: var(--ux-ink-3); margin-top: 4px; }

        .ld-sections { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 900px) { .ld-sections { grid-template-columns: 1fr; } }

        .ld-section { padding: 24px; border-radius: 20px; background: var(--ux-surface); border: 1px solid var(--ux-line); box-shadow: 0 4px 16px var(--ux-shadow); }
        .ld-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .ld-section-title { font-size: 17px; font-weight: 800; color: var(--ux-ink); }
        .ld-section-link { font-size: 13px; font-weight: 700; color: var(--ux-accent); text-decoration: none; }

        .ld-list { display: flex; flex-direction: column; gap: 10px; }
        .ld-row {
          padding: 12px 16px;
          border-radius: 14px;
          background: var(--ux-surface-2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-decoration: none;
          color: var(--ux-ink);
          transition: background-color .2s var(--ux-ease);
        }
        .ld-row:hover { background: color-mix(in srgb, var(--ux-accent) 8%, var(--ux-surface-2)); }
        .ld-row-info { min-width: 0; }
        .ld-row-name { font-size: 14px; font-weight: 700; color: var(--ux-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ld-row-sub { font-size: 12px; color: var(--ux-ink-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ld-badge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: var(--ux-surface-3);
          color: var(--ux-ink-2);
        }
        .ld-badge.ok { background: color-mix(in srgb, var(--ux-mint) 12%, transparent); color: var(--ux-mint); }
        .ld-badge.draft { background: color-mix(in srgb, var(--ux-warn) 12%, transparent); color: var(--ux-warn); }

        .ld-empty {
          padding: 40px 24px;
          text-align: center;
          color: var(--ux-ink-3);
          border-radius: 20px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
        }
        .ld-empty b { color: var(--ux-ink); }
      `}</style>

      <div className="ld-welcome">
        <div className="ld-welcome-text">
          <h2>Chào mừng quay lại</h2>
          <p>Tổng quan tài liệu và ngân hàng đề thi của bạn. Hãy bắt đầu bằng việc tải tài liệu hoặc tạo đề mới.</p>
        </div>
        <div className="ld-welcome-actions">
          <Link href="/documents" className="ld-btn primary">⬆️ Tải tài liệu</Link>
          <Link href="/quizzes/create" className="ld-btn">✨ Tạo đề AI</Link>
        </div>
      </div>

      <div className="ld-stats">
        <div className="ld-stat">
          <div className="ld-stat-val">{docs.length}</div>
          <div className="ld-stat-lbl">Tài liệu đã tải</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-val">{quizzes.length}</div>
          <div className="ld-stat-lbl">Đề thi trong ngân hàng</div>
        </div>
        <div className="ld-stat">
          <div className="ld-stat-val">{readyDocs.length}</div>
          <div className="ld-stat-lbl">Sẵn sàng làm bài</div>
        </div>
      </div>

      <div className="ld-sections">
        <div className="ld-section">
          <div className="ld-section-head">
            <div className="ld-section-title">Tài liệu gần đây</div>
            <Link href="/documents" className="ld-section-link">Xem tất cả →</Link>
          </div>
          <div className="ld-list">
            {docs.length === 0 ? (
              <div className="ld-empty">
                Chưa có tài liệu nào. Nhấn <b>Tải tài liệu</b> để bắt đầu.
              </div>
            ) : (
              docs.map((doc) => (
                <Link key={doc.id} href={`/documents?id=${doc.id}`} className="ld-row">
                  <div className="ld-row-info">
                    <div className="ld-row-name">{doc.title}</div>
                    <div className="ld-row-sub">
                      {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                      {doc.fileType ? ` · ${doc.fileType.toUpperCase()}` : ''}
                    </div>
                  </div>
                  <span className={`ld-badge ${doc.status === 'ready' ? 'ok' : 'draft'}`}>
                    {doc.status === 'ready' ? 'Sẵn sàng' : 'Đang xử lý'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="ld-section">
          <div className="ld-section-head">
            <div className="ld-section-title">Đề thi & Ngân hàng</div>
            <Link href="/quizzes" className="ld-section-link">Xem tất cả →</Link>
          </div>
          <div className="ld-list">
            {quizzes.length === 0 ? (
              <div className="ld-empty">
                Chưa có đề thi nào. Hãy vào <b>Tạo đề AI</b> để sinh câu hỏi.
              </div>
            ) : (
              quizzes.map((quiz) => (
                <Link key={quiz.id} href={`/quizzes?id=${quiz.id}`} className="ld-row">
                  <div className="ld-row-info">
                    <div className="ld-row-name">{quiz.title}</div>
                    <div className="ld-row-sub">
                      Thời lượng: {quiz.durationMinutes ?? 0} phút
                      {quiz.shareCode ? ` · Mã: ${quiz.shareCode}` : ''}
                    </div>
                  </div>
                  <span className={`ld-badge ${quiz.isPublished ? 'ok' : 'draft'}`}>
                    {quiz.isPublished ? 'Đang mở' : 'Bản nháp'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
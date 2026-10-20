import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { listUserDocuments, listUserQuizzes } from '@/server/dal';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const [docsData, quizzes] = await Promise.all([
    listUserDocuments(user.id, 1, 5),
    listUserQuizzes(user.id),
  ]);

  return (
    <div className="ux">
      <style>{`
        .dash-welcome {
          padding: 32px;
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 30px var(--ux-shadow);
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }
        .dash-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .dash-desc {
          font-size: 14px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .stat-card {
          padding: 20px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 14px var(--ux-shadow);
        }
        .stat-val {
          font-size: 32px;
          font-weight: 900;
          color: var(--ux-accent);
          letter-spacing: -0.02em;
        }
        .stat-lbl {
          font-size: 13px;
          font-weight: 600;
          color: var(--ux-ink-3);
          margin-top: 4px;
        }
        .dash-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .dash-grid { grid-template-columns: 1fr; }
        }
        .dash-section {
          padding: 24px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 16px var(--ux-shadow);
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 17px;
          font-weight: 800;
          color: var(--ux-ink);
        }
        .section-link {
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-accent);
          text-decoration: none;
        }
        .item-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .item-row {
          padding: 12px 16px;
          border-radius: 14px;
          background: var(--ux-surface-2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-decoration: none;
          color: var(--ux-ink);
          transition: background-color .2s;
        }
        .item-row:hover {
          background: color-mix(in srgb, var(--ux-accent) 8%, var(--ux-surface-2));
        }
        .item-name {
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 300px;
        }
        .item-sub {
          font-size: 12px;
          color: var(--ux-ink-3);
        }
        .badge {
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }
        .badge-green {
          background: color-mix(in srgb, var(--ux-mint) 15%, transparent);
          color: var(--ux-mint);
        }
        .badge-gray {
          background: var(--ux-line-2);
          color: var(--ux-ink-3);
        }
      `}</style>

      <div className="dash-welcome">
        <div>
          <h1 className="dash-title">Xin chào, {user.name} 👋</h1>
          <p className="dash-desc">
            Không gian ôn tập và kiểm tra tài liệu học tập của bạn.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href="/documents"
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'var(--ux-accent)',
              color: 'var(--ux-accent-ink)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            + Tải tài liệu
          </Link>
          <Link
            href="/quizzes/take"
            style={{
              padding: '10px 18px',
              borderRadius: '12px',
              background: 'var(--ux-surface-2)',
              color: 'var(--ux-ink)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 700,
              border: '1px solid var(--ux-line)',
            }}
          >
            ✍️ Vào phòng thi
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-val">{docsData.total}</div>
          <div className="stat-lbl">Tài liệu đã tải</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">{quizzes.length}</div>
          <div className="stat-lbl">Đề thi trong ngân hàng</div>
        </div>
        <div className="stat-card">
          <div className="stat-val">
            {quizzes.filter(q => q.isPublished).length}
          </div>
          <div className="stat-lbl">Đề đang phát hành</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-section">
          <div className="section-header">
            <div className="section-title">Tài liệu gần đây</div>
            <Link href="/documents" className="section-link">Xem tất cả →</Link>
          </div>
          <div className="item-list">
            {docsData.items.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ux-ink-3)', fontSize: '14px' }}>
                Chưa có tài liệu nào. Nhấn <b>+ Tải tài liệu</b> để bắt đầu.
              </div>
            ) : (
              docsData.items.map(doc => (
                <Link key={doc.id} href={`/documents?id=${doc.id}`} className="item-row">
                  <div>
                    <div className="item-name">{doc.title}</div>
                    <div className="item-sub">
                      {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <span className="badge badge-green">Sẵn sàng</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="dash-section">
          <div className="section-header">
            <div className="section-title">Đề thi & Ngân hàng</div>
            <Link href="/quizzes" className="section-link">Xem tất cả →</Link>
          </div>
          <div className="item-list">
            {quizzes.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--ux-ink-3)', fontSize: '14px' }}>
                Chưa có đề thi nào. Hãy vào <b>Tạo đề AI</b> để sinh câu hỏi.
              </div>
            ) : (
              quizzes.map(quiz => (
                <Link key={quiz.id} href={`/quizzes?id=${quiz.id}`} className="item-row">
                  <div>
                    <div className="item-name">{quiz.title}</div>
                    <div className="item-sub">
                      Thời lượng: {quiz.durationMinutes} phút
                      {quiz.shareCode ? ` · Mã: ${quiz.shareCode}` : ''}
                    </div>
                  </div>
                  <span className={`badge ${quiz.isPublished ? 'badge-green' : 'badge-gray'}`}>
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

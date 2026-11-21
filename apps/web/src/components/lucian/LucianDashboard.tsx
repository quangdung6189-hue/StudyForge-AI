// Lucian UX/UI Prompt · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/
// Study Command Center Dashboard with Lucian #178 Bulk Selection Dock
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppIcon } from '../layout/AppIcon';

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
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const toggleSelectDoc = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  return (
    <div className="ux ld-container">
      <style>{`
        .ld-container {
          display: flex;
          flex-direction: column;
          gap: 28px;
          position: relative;
        }

        /* Study Command Center Welcome Card */
        .ld-welcome {
          padding: 28px 32px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          position: relative;
          overflow: hidden;
        }
        .ld-welcome::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--ux-accent);
        }

        .ld-status-rail {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line-2);
          font-size: 11px;
          font-weight: 700;
          color: var(--ux-ink-2);
          margin-bottom: 8px;
        }
        .ld-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ux-mint);
          box-shadow: 0 0 6px var(--ux-mint);
        }

        .ld-welcome-text {
          flex: 1;
          min-width: 240px;
        }
        .ld-welcome h2 {
          font-size: 24px;
          font-weight: 850;
          letter-spacing: -0.025em;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .ld-welcome p {
          font-size: 13.5px;
          color: var(--ux-ink-2);
          margin: 0;
          line-height: 1.5;
        }

        .ld-welcome-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }
        .ld-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: transform var(--ux-motion-fast) var(--ux-ease), background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .ld-btn:hover {
          transform: translateY(-1px);
          box-shadow: var(--ux-shadow);
          border-color: var(--ux-accent);
          color: var(--ux-accent);
        }
        .ld-btn:active {
          transform: var(--ux-press);
        }
        .ld-btn.primary {
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
          border-color: var(--ux-accent);
          box-shadow: 0 4px 14px -3px color-mix(in srgb, var(--ux-accent) 45%, transparent);
        }
        .ld-btn.primary:hover {
          color: var(--ux-accent-ink);
          background: var(--ux-accent-hover);
          box-shadow: 0 6px 18px -3px color-mix(in srgb, var(--ux-accent) 55%, transparent);
        }

        /* Stat Cards with Left Focus Rail & Icons */
        .ld-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .ld-stat {
          padding: 18px 20px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          border-left: 3.5px solid var(--ux-accent);
          box-shadow: var(--ux-shadow);
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: transform var(--ux-motion-fast) var(--ux-ease), box-shadow 0.2s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .ld-stat:hover {
            transform: translateY(-1px);
            box-shadow: var(--ux-shadow-strong);
          }
        }
        .ld-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: var(--ux-accent-soft);
          color: var(--ux-accent-text);
          display: grid;
          place-items: center;
          flex: none;
        }
        .ld-stat-icon svg {
          width: 20px;
          height: 20px;
        }
        .ld-stat-val {
          font-size: 28px;
          font-weight: 850;
          color: var(--ux-ink);
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
        }
        .ld-stat-lbl {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ux-ink-3);
          margin-top: 3px;
        }

        /* Two-Column Section Grid */
        .ld-sections {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 900px) {
          .ld-sections {
            grid-template-columns: 1fr;
          }
        }

        .ld-section {
          padding: 22px;
          border-radius: 18px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: var(--ux-shadow);
        }
        .ld-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .ld-section-title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.015em;
          color: var(--ux-ink);
        }
        .ld-section-link {
          font-size: 12.5px;
          font-weight: 700;
          color: var(--ux-accent-text);
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .ld-section-link:hover {
          color: var(--ux-accent-hover);
        }

        .ld-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ld-row {
          position: relative;
          padding: 11px 14px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          border: 1px solid transparent;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-decoration: none;
          color: var(--ux-ink);
          transition: background-color 0.2s ease, border-color 0.2s ease, transform var(--ux-motion-fast) var(--ux-ease);
        }
        .ld-row:hover {
          background: color-mix(in srgb, var(--ux-accent) 6%, var(--ux-surface-2));
          border-color: color-mix(in srgb, var(--ux-accent) 18%, transparent);
        }
        .ld-row[data-selected="true"] {
          background: color-mix(in srgb, var(--ux-accent) 12%, var(--ux-surface-2));
          border-color: var(--ux-accent);
        }

        .ld-select-box {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 1.5px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-accent);
          display: grid;
          place-items: center;
          margin-right: 12px;
          flex: none;
          cursor: pointer;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        .ld-row[data-selected="true"] .ld-select-box {
          border-color: var(--ux-accent);
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
        }

        .ld-row-info {
          min-width: 0;
          flex: 1;
        }
        .ld-row-name {
          font-size: 13.5px;
          font-weight: 700;
          color: var(--ux-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ld-row-sub {
          font-size: 11.5px;
          color: var(--ux-ink-3);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ld-badge {
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          background: var(--ux-surface-3);
          color: var(--ux-ink-2);
          flex: none;
        }
        .ld-badge.ok {
          background: color-mix(in srgb, var(--ux-mint) 14%, transparent);
          color: var(--ux-mint);
        }
        .ld-badge.draft {
          background: color-mix(in srgb, var(--ux-warn) 14%, transparent);
          color: var(--ux-warn);
        }

        .ld-empty {
          padding: 36px 20px;
          text-align: center;
          color: var(--ux-ink-3);
          font-size: 13px;
          border-radius: 14px;
          background: var(--ux-surface-2);
          border: 1px dashed var(--ux-line-2);
        }
        .ld-empty b {
          color: var(--ux-ink);
        }

        /* ========================================================
           Lucian #178 Bulk Selection Dock
           ======================================================== */
        .u178-dock {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(0);
          z-index: 85;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          border-radius: 16px;
          background: var(--ux-ink);
          color: var(--ux-page);
          box-shadow: 0 16px 36px -10px var(--ux-shadow-strong), 0 0 0 1px var(--ux-line);
          font-size: 13px;
          font-weight: 700;
          transition: transform 0.35s var(--ux-ease-spring), opacity 0.25s ease;
        }
        .u178-dock[hidden] {
          display: none !important;
        }
        .u178-count {
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .u178-count span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ux-accent);
        }
        .u178-btn {
          border: 0;
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: var(--ux-page);
          color: var(--ux-ink);
          transition: transform var(--ux-motion-fast) ease, opacity 0.2s ease;
        }
        .u178-btn:hover {
          opacity: 0.92;
        }
        .u178-btn:active {
          transform: scale(0.96);
        }
        .u178-clear {
          border: 0;
          background: none;
          color: color-mix(in srgb, var(--ux-page) 75%, transparent);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 6px;
        }
        .u178-clear:hover {
          color: var(--ux-page);
        }

        @media (max-width: 768px) {
          .u178-dock {
            bottom: calc(78px + env(safe-area-inset-bottom));
            width: calc(100vw - 32px);
            justify-content: space-between;
          }
        }
      `}</style>

      {/* Study Command Center Welcome Card */}
      <div className="ld-welcome">
        <div className="ld-welcome-text">
          <div className="ld-status-rail">
            <span className="ld-status-dot" aria-hidden="true" />
            <span>Hệ thống hoạt động bình thường · Sẵn sàng tạo đề</span>
          </div>
          <h2>Bảng điều khiển học tập</h2>
          <p>Quản lý tài liệu và ngân hàng đề thi thông minh của bạn. Tải tài liệu bài học để AI trích xuất câu hỏi ngay lập tức.</p>
        </div>
        <div className="ld-welcome-actions">
          <Link href="/documents" className="ld-btn primary">
            <AppIcon name="documents" width="16" height="16" />
            Tải tài liệu
          </Link>
          <Link href="/quizzes/create" className="ld-btn">
            <AppIcon name="create" width="16" height="16" />
            Tạo đề AI
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="ld-stats">
        <div className="ld-stat">
          <div>
            <div className="ld-stat-val">{docs.length}</div>
            <div className="ld-stat-lbl">Tài liệu đã tải</div>
          </div>
          <div className="ld-stat-icon" aria-hidden="true">
            <AppIcon name="documents" />
          </div>
        </div>

        <div className="ld-stat">
          <div>
            <div className="ld-stat-val">{quizzes.length}</div>
            <div className="ld-stat-lbl">Đề thi trong ngân hàng</div>
          </div>
          <div className="ld-stat-icon" aria-hidden="true">
            <AppIcon name="quizzes" />
          </div>
        </div>

        <div className="ld-stat">
          <div>
            <div className="ld-stat-val">{readyDocs.length}</div>
            <div className="ld-stat-lbl">Tài liệu sẵn sàng</div>
          </div>
          <div className="ld-stat-icon" aria-hidden="true">
            <AppIcon name="check" />
          </div>
        </div>
      </div>

      {/* Content Lists */}
      <div className="ld-sections">
        {/* Documents Section */}
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
              docs.slice(0, 5).map((doc) => {
                const isSelected = selectedDocs.has(doc.id);
                return (
                  <Link
                    key={doc.id}
                    href={`/documents?id=${doc.id}`}
                    className="ld-row"
                    data-selected={isSelected}
                  >
                    <button
                      type="button"
                      className="ld-select-box"
                      aria-label={isSelected ? `Bỏ chọn ${doc.title}` : `Chọn ${doc.title}`}
                      onClick={(e) => toggleSelectDoc(doc.id, e)}
                    >
                      {isSelected ? '✓' : ''}
                    </button>
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
                );
              })
            )}
          </div>
        </div>

        {/* Quizzes Section */}
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
              quizzes.slice(0, 5).map((quiz) => (
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

      {/* Lucian #178 Bulk Selection Dock */}
      {selectedDocs.size > 0 && (
        <div className="u178-dock" role="status" aria-live="polite">
          <div className="u178-count">
            <span aria-hidden="true" />
            {selectedDocs.size} tài liệu đã chọn
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/quizzes/create?docIds=${Array.from(selectedDocs).join(',')}`} className="u178-btn">
              Tạo đề từ mục chọn ↗
            </Link>
            <button type="button" className="u178-clear" onClick={clearSelection}>
              Bỏ chọn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

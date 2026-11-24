'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useFeedback } from '@/components/ui/Feedback';

/** ISO → value for <input type="datetime-local"> in the viewer's local time. */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface QuizSettingsModalProps {
  quiz: any;
  onClose: () => void;
  onSaved: () => void;
}

export function QuizSettingsModal({ quiz, onClose, onSaved }: QuizSettingsModalProps) {
  const isPracticeInit = quiz.description?.includes('[mode:practice]');
  const cleanDescInit = (quiz.description || '').replace(/\[mode:(?:practice|exam)\]\s*/g, '');

  const [mode, setMode] = useState<'exam' | 'practice'>(isPracticeInit ? 'practice' : 'exam');
  const [title, setTitle] = useState(quiz.title || '');
  const [desc, setDesc] = useState(cleanDescInit);
  const duration = quiz.durationMinutes || 15;
  const [unlimited, setUnlimited] = useState(duration >= 1440);
  const [durationMinutes, setDurationMinutes] = useState(duration >= 1440 ? 15 : duration);
  const [allowReview, setAllowReview] = useState(quiz.allowReview !== undefined ? quiz.allowReview : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [opensAt, setOpensAt] = useState(toLocalInput(quiz.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(quiz.deadline));
  const [maxAttempts, setMaxAttempts] = useState<string>(quiz.maxAttempts ? String(quiz.maxAttempts) : '');
  const { confirm, toast } = useFeedback();

  // Escape closes the dialog (unless a save is in flight)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || quiz.title,
          description: desc.trim(),
          mode,
          durationMinutes: unlimited ? 1440 : Number(durationMinutes) || 15,
          allowReview,
          opensAt: opensAt ? new Date(opensAt).toISOString() : null,
          deadline: closesAt ? new Date(closesAt).toISOString() : null,
          maxAttempts: maxAttempts ? Math.max(1, Math.min(50, Number(maxAttempts) || 1)) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa lưu được tùy chỉnh.');
      toast('Đã lưu tuỳ chỉnh đề thi.', 'success');
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Lỗi lưu tùy chỉnh đề thi.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!(await confirm({ title: 'Chuyển đề về bản nháp?', message: 'Học sinh sẽ tạm thời không vào được phòng thi này cho đến khi bạn xuất bản lại.', confirmLabel: 'Chuyển về nháp', tone: 'danger' }))) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Chưa chuyển được về bản nháp.');
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Lỗi chuyển về bản nháp.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="qz-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="qz-modal" role="dialog" aria-modal="true" aria-labelledby="custom-modal-title">
        <div className="qz-modal-head">
          <div>
            <h2 id="custom-modal-title">Tùy chỉnh đề thi</h2>
            <span style={{ fontSize: '12px', color: 'var(--ux-ink-3)' }}>
              Mã thi: {quiz.shareCode || 'Chưa có'}
            </span>
          </div>
          <button
            type="button"
            className="qz-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="qz-modal-body">
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'color-mix(in srgb, var(--ux-danger) 12%, var(--ux-surface))',
                color: 'var(--ux-danger)',
                border: '1px solid var(--ux-danger)',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          {/* Chọn chế độ */}
          <div className="qz-form-group">
            <span className="qz-form-label">Chế độ bài thi</span>
            <div className="qz-mode-grid">
              <button
                type="button"
                className={`qz-mode-card${mode === 'exam' ? ' active' : ''}`}
                onClick={() => setMode('exam')}
              >
                <span className="qz-mode-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="13" y2="14" /></svg>Bài kiểm tra</span>
                <span className="qz-mode-desc">
                  Thi chính thức, tính giờ nghiêm ngặt, mỗi học sinh làm 1 lượt theo quy chế.
                </span>
              </button>

              <button
                type="button"
                className={`qz-mode-card${mode === 'practice' ? ' active' : ''}`}
                onClick={() => setMode('practice')}
              >
                <span className="qz-mode-title"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>Bài luyện tập</span>
                <span className="qz-mode-desc">
                  <strong>Được làm đi làm lại nhiều lần</strong>, xem ngay giải thích chi tiết và trích dẫn để ôn tập.
                </span>
              </button>
            </div>
          </div>

          {/* Tên đề thi */}
          <div className="qz-form-group">
            <label className="qz-form-label" htmlFor="custom-title">
              Tên bài kiểm tra / luyện tập
            </label>
            <input
              id="custom-title"
              className="qz-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên bài thi…"
            />
          </div>

          {/* Mô tả */}
          <div className="qz-form-group">
            <label className="qz-form-label" htmlFor="custom-desc">
              Mô tả hoặc hướng dẫn làm bài
            </label>
            <textarea
              id="custom-desc"
              className="qz-form-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Nhập mô tả đề thi…"
            />
          </div>
          {/* Thời gian làm bài */}
          <div className="qz-form-group">
            <label className="qz-form-label" htmlFor="custom-duration">
              Thời gian làm bài (phút)
            </label>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="custom-duration"
                type="number"
                min="1"
                max="1440"
                className="qz-form-input"
                style={{ width: '120px' }}
                disabled={unlimited}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 15))}
              />
              <label className="qz-checkbox-label">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                />
                <span>Không giới hạn thời gian (Tự do làm bài)</span>
              </label>
            </div>
          </div>

          {/* Tùy chọn xem đáp án */}
          <div className="qz-form-group">
            <label className="qz-checkbox-label">
              <input
                type="checkbox"
                checked={allowReview}
                onChange={(e) => setAllowReview(e.target.checked)}
              />
              <span>Cho phép học sinh xem lại đáp án và lời giải chi tiết sau khi nộp bài</span>
            </label>
          </div>

          {/* Lịch mở phòng & giới hạn lượt làm (kiểm tra ở máy chủ khi vào thi) */}
          <div className="qz-form-group">
            <span className="qz-form-label">Lịch mở phòng & số lượt làm</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ux-ink-2)' }}>
                Mở phòng lúc
                <input className="qz-form-input" type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ux-ink-2)' }}>
                Đóng phòng lúc
                <input className="qz-form-input" type="datetime-local" value={closesAt} min={opensAt || undefined} onChange={e => setClosesAt(e.target.value)} />
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--ux-ink-2)' }}>
                Số lượt tối đa
                <input className="qz-form-input" type="number" min={1} max={50} placeholder="Không giới hạn" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
              </label>
            </div>
            <small style={{ fontSize: 12, color: 'var(--ux-ink-3)' }}>Để trống nếu không giới hạn. Học sinh vào sớm hoặc dùng hết lượt sẽ nhận thông báo rõ ràng.</small>
          </div>

          {/* Chỉnh sửa câu hỏi trong Editor */}
          <div className="qz-form-group">
            <span className="qz-form-label">Nội dung câu hỏi</span>
            <Link
              href={`/quizzes/create?quizId=${quiz.id}`}
              className="qz-edit-link"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Chỉnh sửa các câu hỏi trong trình biên soạn →</span>
            </Link>
          </div>
        </div>

        <div className="qz-modal-foot">
          <button
            type="button"
            className="qz-btn-unpub"
            onClick={handleUnpublish}
            disabled={saving}
            title="Gỡ đề khỏi trạng thái phát hành để đưa về bản nháp"
          >
            Chuyển về bản nháp
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="qz-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </button>
            <button
              type="button"
              className="qz-btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu tùy chỉnh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
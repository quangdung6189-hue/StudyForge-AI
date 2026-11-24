'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { MathText } from '@/components/common/MathText';
import { useFeedback } from '@/components/ui/Feedback';
import { dateTime } from '@/lib/labels';
import '../../../pages.css';

type Item = {
  recordId: string; questionId: string; student: string; email: string; submittedAt: string; stem: string; acceptedAnswers: string[];
  rubric: string; points: number; answer: string; earnedPoints: number;
  suggestion: { points: number; feedback: string; origin: string; status: string } | null;
};

export default function GradingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useFeedback();
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { points: string; feedback: string }>>({});
  const [filter, setFilter] = useState<'todo' | 'all'>('todo');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quizzes/${id}/grading`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tải được danh sách chấm.');
      setItems(data.items); setTitle(data.quizTitle);
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setLoading(false); }
  }, [id, toast]);
  useEffect(() => { void load(); }, [load]);

  const key = (i: Item) => `${i.recordId}:${i.questionId}`;
  const valueOf = (i: Item) => draft[key(i)] ?? { points: String(i.suggestion?.points ?? i.earnedPoints), feedback: i.suggestion?.feedback ?? '' };
  const post = async (body: object) => {
    const res = await fetch(`/api/quizzes/${id}/grading`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Thao tác chưa thành công.');
    return data;
  };
  const suggest = async (i: Item) => {
    setBusy(key(i));
    try {
      const s = await post({ action: 'suggest', recordId: i.recordId, questionId: i.questionId });
      setItems(list => list.map(x => (key(x) === key(i) ? { ...x, suggestion: s } : x)));
      setDraft(d => ({ ...d, [key(i)]: { points: String(s.points), feedback: s.feedback } }));
      toast('AI đã gợi ý điểm — hãy kiểm tra rồi xác nhận.', 'info');
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setBusy(null); }
  };
  const confirm = async (i: Item) => {
    const v = valueOf(i);
    const points = Number(v.points.replace(',', '.'));
    if (!Number.isFinite(points) || points < 0 || points > i.points) { toast(`Điểm phải từ 0 đến ${i.points}.`, 'danger'); return; }
    setBusy(key(i));
    try {
      const r = await post({ action: 'confirm', recordId: i.recordId, questionId: i.questionId, points, feedback: v.feedback });
      setItems(list => list.map(x => (key(x) === key(i) ? { ...x, earnedPoints: r.points, suggestion: { points: r.points, feedback: v.feedback, origin: 'teacher', status: 'confirmed' } } : x)));
      toast(`Đã chấm: ${i.student} được ${r.points}/${i.points} điểm (tổng ${r.score}/${r.totalPoints}).`, 'success');
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setBusy(null); }
  };

  const visible = items.filter(i => filter === 'all' || i.suggestion?.status !== 'confirmed');
  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div>
          <span className="sf-page-eyebrow">CHẤM CÂU TRẢ LỜI NGẮN</span>
          <h1>{title || 'Đang tải…'}</h1>
          <p>Các câu trả lời không khớp nguyên văn đáp án. AI gợi ý điểm theo rubric, nhưng <b>chỉ điểm bạn xác nhận mới được tính</b>.</p>
        </div>
        <div className="sf-page-actions">
          <div className="sf-chipset" role="group" aria-label="Lọc">
            <button type="button" className="sf-chip" aria-pressed={filter === 'todo'} onClick={() => setFilter('todo')}>Chưa chấm ({items.filter(i => i.suggestion?.status !== 'confirmed').length})</button>
            <button type="button" className="sf-chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả ({items.length})</button>
          </div>
          <Link className="sf-pbtn" href={`/quizzes/${id}/analytics`}>← Thống kê</Link>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2].map(i => <div key={i} className="sf-skel" style={{ height: 150, borderRadius: 20 }} />)}</div>
      ) : !visible.length ? (
        <div className="sf-empty">
          <h2>{items.length ? 'Đã chấm xong tất cả' : 'Không có câu nào cần chấm'}</h2>
          <p>Câu trả lời ngắn khớp đáp án được chấm tự động. Câu khác cách diễn đạt sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="sf-stagger">
          {visible.map(i => {
            const v = valueOf(i);
            const confirmed = i.suggestion?.status === 'confirmed';
            return (
              <article key={key(i)} className="sf-panel">
                <div className="sf-panel-head">
                  <h2>{i.student} <small style={{ fontWeight: 600, color: 'var(--ux-ink-3)' }}>· {i.email}</small></h2>
                  <small>{dateTime(i.submittedAt)} {confirmed ? <span className="sf-badge" data-tone="good">Đã chấm</span> : i.suggestion ? <span className="sf-badge" data-tone="accent">AI đã gợi ý</span> : <span className="sf-badge" data-tone="warn">Chờ chấm</span>}</small>
                </div>
                <div style={{ fontSize: 14, color: 'var(--ux-ink)', marginBottom: 10 }}><MathText text={i.stem} /></div>
                <div className="sf-grid-2" style={{ gap: 12 }}>
                  <div className="sf-field">Câu trả lời của học sinh<div className="sf-input" style={{ height: 'auto', minHeight: 40, padding: '10px 12px', fontWeight: 650 }}>{i.answer || <em>(bỏ trống)</em>}</div></div>
                  <div className="sf-field">Đáp án chấp nhận{i.rubric ? ' · Rubric' : ''}<div className="sf-input" style={{ height: 'auto', minHeight: 40, padding: '10px 12px' }}>{i.acceptedAnswers.join(' / ')}{i.rubric && <><br /><small style={{ color: 'var(--ux-ink-3)' }}>{i.rubric}</small></>}</div></div>
                </div>
                <div className="sf-row" style={{ marginTop: 12 }}>
                  <label className="sf-field" style={{ maxWidth: 140, flex: 'none' }}>Điểm (tối đa {i.points})
                    <input className="sf-input" inputMode="decimal" value={v.points} onChange={e => setDraft(d => ({ ...d, [key(i)]: { ...v, points: e.target.value } }))} />
                  </label>
                  <label className="sf-field">Nhận xét gửi học sinh
                    <input className="sf-input" maxLength={600} value={v.feedback} onChange={e => setDraft(d => ({ ...d, [key(i)]: { ...v, feedback: e.target.value } }))} placeholder="Ví dụ: Đúng ý, thiếu đơn vị." />
                  </label>
                  <button type="button" className="sf-pbtn" disabled={busy === key(i) || !i.answer} onClick={() => void suggest(i)}>{busy === key(i) ? 'Đang xử lý…' : '✦ AI gợi ý điểm'}</button>
                  <button type="button" className="sf-pbtn primary" disabled={busy === key(i)} onClick={() => void confirm(i)}>{confirmed ? 'Cập nhật điểm' : 'Xác nhận điểm'}</button>
                </div>
                {i.suggestion?.origin === 'ai_suggested' && !confirmed && <p className="sf-muted" style={{ marginTop: 8 }}>Gợi ý của AI ({i.suggestion.points}/{i.points}) chưa được tính vào điểm.</p>}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ReducedMotionConfig, spring, transition, useShouldReduceMotion, useTempoTransition } from '@animate-ui/react/utils/motion';
import { MathText } from '@/components/common/MathText';
import { useFeedback } from '@/components/ui/Feedback';
import { DIFFICULTY_LABELS, ORIGIN_LABELS, TYPE_LABELS } from '@/lib/labels';
import '../pages.css';
import './bank.css';

type Q = {
  id: string; type: string; stem: string; difficulty: string; topic: string; tags: string[]; answerOrigin: string; reviewed: boolean; points: number;
  answer: string; options: string[]; documentId: string; documentTitle: string; quizId: string | null; quizTitle: string; isPublished: boolean;
};

export default function BankPage() {
  const router = useRouter();
  const { toast } = useFeedback();
  const reduce = useShouldReduceMotion();
  const dockIn = useTempoTransition(spring.toast);
  const dockOut = useTempoTransition(transition.dismiss);
  const [items, setItems] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [level, setLevel] = useState('all');
  const [doc, setDoc] = useState('all');
  const [tag, setTag] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [composer, setComposer] = useState<{ title: string; minutes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useDeferredValue(search.toLocaleLowerCase('vi').trim());

  useEffect(() => {
    fetch('/api/bank').then(r => r.json()).then(d => setItems(d.items ?? [])).catch(() => toast('Chưa tải được kho câu hỏi.', 'danger')).finally(() => setLoading(false));
  }, [toast]);

  const documents = useMemo(() => [...new Map(items.map(i => [i.documentId, i.documentTitle])).entries()], [items]);
  const tags = useMemo(() => [...new Set(items.flatMap(i => i.tags))].sort(), [items]);
  const visible = items.filter(i =>
    (type === 'all' || i.type === type) && (level === 'all' || i.difficulty === level) && (doc === 'all' || i.documentId === doc) && (tag === 'all' || i.tags.includes(tag)) &&
    (!q || i.stem.toLocaleLowerCase('vi').includes(q) || i.topic.toLocaleLowerCase('vi').includes(q) || i.tags.some(t => t.toLocaleLowerCase('vi').includes(q))));
  const chosen = items.filter(i => selected.includes(i.id));
  const mixedDocs = new Set(chosen.map(i => i.documentId)).size > 1;

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id].slice(0, 100)));
  const saveTags = async (item: Q, next: string[]) => {
    try {
      const res = await fetch(`/api/bank/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: next }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa lưu được thẻ.');
      setItems(list => list.map(x => (x.id === item.id ? { ...x, tags: data.tags ?? next } : x)));
    } catch (err) { toast((err as Error).message, 'danger'); }
  };
  const addTag = (item: Q) => {
    const value = (tagDraft[item.id] ?? '').trim();
    if (!value) return;
    setTagDraft(d => ({ ...d, [item.id]: '' }));
    if (!item.tags.includes(value)) void saveTags(item, [...item.tags, value]);
  };
  const createQuiz = async () => {
    if (!composer || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/bank/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionIds: selected, title: composer.title, durationMinutes: composer.minutes }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tạo được đề.');
      toast(`Đã tạo bản nháp "${composer.title}" với ${selected.length} câu.`, 'success');
      router.push(`/quizzes/create?quizId=${data.quiz.id}`);
    } catch (err) { toast((err as Error).message, 'danger'); setBusy(false); }
  };

  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div>
          <span className="sf-page-eyebrow">KHO CÂU HỎI</span>
          <h1>Mọi câu hỏi bạn đã soạn, ở một nơi</h1>
          <p>Gắn thẻ để tìm lại nhanh, rồi chọn câu để ghép đề mới. Câu ghép cùng một đề cần chung tài liệu nguồn để trích dẫn luôn kiểm chứng được.</p>
        </div>
      </header>

      <div className="sf-panel bank-filters">
        <label className="sf-field" style={{ flex: 2 }}>Tìm kiếm
          <input className="sf-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nội dung, chủ đề hoặc thẻ…  ( / )" data-hotkey="/" />
        </label>
        <label className="sf-field">Dạng câu
          <select className="sf-input" value={type} onChange={e => setType(e.target.value)}>
            <option value="all">Tất cả dạng</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="sf-field">Mức độ
          <select className="sf-input" value={level} onChange={e => setLevel(e.target.value)}>
            <option value="all">Tất cả mức độ</option>
            {Object.entries(DIFFICULTY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="sf-field">Tài liệu nguồn
          <select className="sf-input" value={doc} onChange={e => setDoc(e.target.value)}>
            <option value="all">Tất cả tài liệu</option>
            {documents.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label className="sf-field">Thẻ
          <select className="sf-input" value={tag} onChange={e => setTag(e.target.value)}>
            <option value="all">Tất cả thẻ</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="bank-summary">
        <span>{loading ? 'Đang tải…' : `${visible.length}/${items.length} câu`}</span>
        {visible.length > 0 && <button type="button" className="sf-chip" onClick={() => setSelected(s => [...new Set([...s, ...visible.map(i => i.id)])].slice(0, 100))}>Chọn tất cả đang lọc</button>}
        {selected.length > 0 && <button type="button" className="sf-chip" onClick={() => setSelected([])}>Bỏ chọn</button>}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} className="sf-skel" style={{ height: 120, borderRadius: 18 }} />)}</div>
      ) : !items.length ? (
        <div className="sf-empty"><h2>Kho câu hỏi đang trống</h2><p>Tạo đề bằng AI hoặc trình biên soạn — mọi câu hỏi sẽ tự động có mặt ở đây.</p><a className="sf-pbtn primary" href="/quizzes/create">Tạo đề đầu tiên</a></div>
      ) : (
        <div className="bank-list">
          {visible.slice(0, 200).map(item => {
            const isSelected = selected.includes(item.id);
            return (
              <article key={item.id} className="bank-item sf-reveal" data-selected={isSelected}>
                <label className="bank-check"><input type="checkbox" checked={isSelected} onChange={() => toggle(item.id)} aria-label={`Chọn câu: ${item.stem.slice(0, 60)}`} /></label>
                <div className="bank-body">
                  <div className="bank-meta">
                    <span className="sf-badge" data-tone="accent">{TYPE_LABELS[item.type] ?? item.type}</span>
                    <span className="sf-badge">{DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}</span>
                    <span className="sf-badge" data-tone={item.answerOrigin === 'ai_suggested' ? 'warn' : 'good'}>{ORIGIN_LABELS[item.answerOrigin] ?? item.answerOrigin}</span>
                    <span className="bank-src" title={item.documentTitle}>{item.quizTitle} · {item.documentTitle}</span>
                  </div>
                  <div className="bank-stem"><MathText text={item.stem} /></div>
                  <details className="bank-answer"><summary>Đáp án</summary><div style={{ whiteSpace: 'pre-line' }}><MathText text={item.answer || '—'} /></div></details>
                  <div className="bank-tags">
                    {item.tags.map(t => (
                      <span key={t} className="bank-tag">{t}<button type="button" aria-label={`Bỏ thẻ ${t}`} onClick={() => void saveTags(item, item.tags.filter(x => x !== t))}>×</button></span>
                    ))}
                    <input className="bank-tag-input" value={tagDraft[item.id] ?? ''} maxLength={40} placeholder="+ thêm thẻ" aria-label="Thêm thẻ"
                      onChange={e => setTagDraft(d => ({ ...d, [item.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(item); } }}
                      onBlur={() => addTag(item)} />
                  </div>
                </div>
              </article>
            );
          })}
          {visible.length > 200 && <p className="sf-muted">Đang hiện 200 câu đầu — hãy lọc thêm để thu hẹp.</p>}
        </div>
      )}

      <ReducedMotionConfig>
        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              key="bank-dock"
              className="bank-dock"
              role="status"
              initial={{ opacity: 0, transform: reduce ? 'none' : 'translate3d(0, 18px, 0) scale(0.96)' }}
              animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', transition: dockIn }}
              exit={{ opacity: 0, transform: reduce ? 'none' : 'translate3d(0, 18px, 0) scale(0.96)', transition: dockOut }}
            >
              <span><b>{selected.length}</b> câu đã chọn{mixedDocs && ' · khác tài liệu nguồn'}</span>
              <button type="button" disabled={mixedDocs} title={mixedDocs ? 'Chọn các câu cùng một tài liệu nguồn' : undefined} onClick={() => setComposer({ title: `Đề tổng hợp ${new Date().getDate()}/${new Date().getMonth() + 1}`, minutes: 30 })}>Tạo đề từ câu đã chọn</button>
            </motion.div>
          )}
        </AnimatePresence>
      </ReducedMotionConfig>

      {composer && (
        <div className="sf-dialog-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setComposer(null); }}>
          <form className="sf-dialog" role="dialog" aria-modal="true" aria-labelledby="bank-compose-title" onSubmit={e => { e.preventDefault(); void createQuiz(); }}>
            <h2 id="bank-compose-title" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 850 }}>Tạo đề nháp từ {selected.length} câu</h2>
            <p className="sf-muted" style={{ marginBottom: 14 }}>Câu hỏi được sao chép sang đề mới; đề cũ không thay đổi. Bạn duyệt lại rồi xuất bản như bình thường.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="sf-field">Tên đề<input className="sf-input" autoFocus required maxLength={200} value={composer.title} onChange={e => setComposer(c => c && { ...c, title: e.target.value })} /></label>
              <label className="sf-field">Thời gian (phút)<input className="sf-input" type="number" min={1} max={1440} value={composer.minutes} onChange={e => setComposer(c => c && { ...c, minutes: Number(e.target.value) || 30 })} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" className="sf-pbtn" onClick={() => setComposer(null)} disabled={busy}>Huỷ</button>
              <button type="submit" className="sf-pbtn primary" disabled={busy || !composer.title.trim()}>{busy ? 'Đang tạo…' : 'Tạo đề nháp'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

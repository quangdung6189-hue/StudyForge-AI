'use client';

import React, { useState } from 'react';
import type { FullQuestionDTO, QuestionType } from '@studyforge/contracts';
import { useFeedback } from '@/components/ui/Feedback';
import { TYPE_LABELS, DIFFICULTY_LABELS } from '@/lib/labels';
import './question-extras.css';

const LEVELS = ['recognition', 'comprehension', 'application'] as const;
export type Matrix = Record<string, number>;
export const matrixKey = (type: string, level: string) => `${type}:${level}`;
export const matrixTotal = (matrix: Matrix, types: string[]) => types.reduce((sum, t) => sum + LEVELS.reduce((s, l) => s + (matrix[matrixKey(t, l)] ?? 0), 0), 0);
export const matrixCells = (matrix: Matrix, types: QuestionType[]) =>
  types.flatMap(type => LEVELS.map(difficulty => ({ type, difficulty, count: matrix[matrixKey(type, difficulty)] ?? 0 }))).filter(cell => cell.count > 0);

/** Blueprint table: rows = selected question types, columns = cognitive levels. */
export function MatrixEditor({ types, matrix, onChange }: { types: QuestionType[]; matrix: Matrix; onChange: (m: Matrix) => void }) {
  const total = matrixTotal(matrix, types);
  const set = (key: string, value: number) => onChange({ ...matrix, [key]: Math.max(0, Math.min(40, Math.round(value) || 0)) });
  const col = (level: string) => types.reduce((s, t) => s + (matrix[matrixKey(t, level)] ?? 0), 0);
  return (
    <div className="qx-matrix">
      <table>
        <thead>
          <tr><th>Dạng câu</th>{LEVELS.map(l => <th key={l}>{DIFFICULTY_LABELS[l]}</th>)}<th>Cộng</th></tr>
        </thead>
        <tbody>
          {types.map(t => (
            <tr key={t}>
              <th scope="row">{TYPE_LABELS[t]}</th>
              {LEVELS.map(l => (
                <td key={l}>
                  <input type="number" min={0} max={40} inputMode="numeric" value={matrix[matrixKey(t, l)] ?? 0} onChange={e => set(matrixKey(t, l), Number(e.target.value))} aria-label={`${TYPE_LABELS[t]} · ${DIFFICULTY_LABELS[l]}`} />
                </td>
              ))}
              <td className="qx-sum">{LEVELS.reduce((s, l) => s + (matrix[matrixKey(t, l)] ?? 0), 0)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th>Cộng</th>{LEVELS.map(l => <td key={l} className="qx-sum">{col(l)}{total ? <small> · {Math.round((col(l) / total) * 100)}%</small> : null}</td>)}<td className="qx-sum qx-total">{total}</td></tr>
        </tfoot>
      </table>
      <p>AI sinh <b>đúng</b> số câu trong từng ô, chỉ từ kiến thức có trong tài liệu, kèm trích dẫn nguyên văn. Mọi câu đều là “AI đề xuất” cho tới khi bạn duyệt.</p>
    </div>
  );
}

type Chunk = { id: string; content: string };
const norm = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Teacher-authored ordering / matching question, grounded on a verbatim quote from the document. */
export function ManualQuestionComposer({ chunks, onAdd }: { chunks: Chunk[]; onAdd: (q: FullQuestionDTO) => void }) {
  const [type, setType] = useState<'ordering' | 'matching'>('ordering');
  const [stem, setStem] = useState('');
  const [items, setItems] = useState(['', '', '']);
  const [pairs, setPairs] = useState([{ l: '', r: '' }, { l: '', r: '' }]);
  const [quote, setQuote] = useState('');
  const [explanation, setExplanation] = useState('');
  const [points, setPoints] = useState(1);
  const [error, setError] = useState('');

  const add = () => {
    setError('');
    const cleanQuote = quote.normalize('NFC').trim();
    const chunk = chunks.find(c => c.content.normalize('NFC').includes(cleanQuote)) ?? (cleanQuote ? chunks.find(c => norm(c.content).includes(norm(cleanQuote))) : undefined);
    if (!stem.trim()) return setError('Nhập nội dung câu hỏi.');
    if (type === 'ordering' && items.filter(i => i.trim()).length < 3) return setError('Cần ít nhất 3 mục để sắp xếp.');
    if (type === 'matching' && pairs.filter(p => p.l.trim() && p.r.trim()).length < 2) return setError('Cần ít nhất 2 cặp ghép đầy đủ.');
    if (!cleanQuote) return setError('Dán một đoạn nguyên văn trong tài liệu làm căn cứ.');
    if (!chunk || !chunk.content.normalize('NFC').includes(cleanQuote)) return setError('Không tìm thấy đoạn trích này nguyên văn trong tài liệu. Hãy sao chép đúng từ tab Văn bản.');
    if (!explanation.trim()) return setError('Nhập lời giải ngắn để học sinh hiểu vì sao.');
    const base = {
      id: crypto.randomUUID(), stem: stem.trim(), explanation: explanation.trim(), points: Math.max(0.25, Math.min(100, points || 1)),
      difficulty: 'comprehension' as const, topic: '', answerOrigin: 'teacher' as const, reviewed: false, acceptedAnswers: [] as string[],
      sourceRefs: [{ chunkId: chunk.id, quote: cleanQuote }],
    };
    if (type === 'ordering') {
      const options = items.map(t => t.trim()).filter(Boolean).slice(0, 8).map(text => ({ id: crypto.randomUUID(), text }));
      onAdd({ ...base, type: 'ordering', options, correctOptionIds: options.map(o => o.id) });
    } else {
      const full = pairs.filter(p => p.l.trim() && p.r.trim()).slice(0, 6).map(p => ({ left: { id: crypto.randomUUID(), text: p.l.trim() }, right: { id: crypto.randomUUID(), text: p.r.trim() } }));
      onAdd({ ...base, type: 'matching', options: full.flatMap(p => [p.left, p.right]), correctOptionIds: [], pairs: full.map(p => ({ leftId: p.left.id, rightId: p.right.id })) });
    }
    setStem(''); setItems(['', '', '']); setPairs([{ l: '', r: '' }, { l: '', r: '' }]); setQuote(''); setExplanation('');
  };

  return (
    <details className="qx-composer">
      <summary>+ Thêm câu sắp xếp thứ tự / ghép nối</summary>
      <div className="qx-body">
        <div className="qx-seg" role="radiogroup" aria-label="Dạng câu">
          {(['ordering', 'matching'] as const).map(t => <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}>{TYPE_LABELS[t]}</button>)}
        </div>
        <label className="qx-field">Nội dung câu hỏi<textarea value={stem} onChange={e => setStem(e.target.value)} placeholder={type === 'ordering' ? 'VD: Sắp xếp các giai đoạn của quá trình nguyên phân theo thứ tự.' : 'VD: Nối mỗi nguyên tố với kí hiệu hoá học của nó.'} /></label>
        {type === 'ordering' ? (
          <div className="qx-field">Các mục theo <b>thứ tự đúng</b> (học sinh sẽ thấy bị xáo trộn)
            {items.map((v, i) => (
              <div key={i} className="qx-line"><span>{i + 1}</span><input value={v} onChange={e => setItems(list => list.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Mục ${i + 1}`} />{items.length > 3 && <button type="button" onClick={() => setItems(list => list.filter((_, j) => j !== i))} aria-label={`Xoá mục ${i + 1}`}>×</button>}</div>
            ))}
            {items.length < 8 && <button type="button" className="qx-add" onClick={() => setItems(list => [...list, ''])}>+ Thêm mục</button>}
          </div>
        ) : (
          <div className="qx-field">Các cặp ghép đúng (cột phải sẽ bị xáo trộn)
            {pairs.map((p, i) => (
              <div key={i} className="qx-line qx-pair"><span>{i + 1}</span><input value={p.l} onChange={e => setPairs(list => list.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)))} placeholder="Cột trái" /><b>→</b><input value={p.r} onChange={e => setPairs(list => list.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)))} placeholder="Cột phải" />{pairs.length > 2 && <button type="button" onClick={() => setPairs(list => list.filter((_, j) => j !== i))} aria-label={`Xoá cặp ${i + 1}`}>×</button>}</div>
            ))}
            {pairs.length < 6 && <button type="button" className="qx-add" onClick={() => setPairs(list => [...list, { l: '', r: '' }])}>+ Thêm cặp</button>}
          </div>
        )}
        <label className="qx-field">Căn cứ trong tài liệu (dán nguyên văn)<textarea value={quote} onChange={e => setQuote(e.target.value)} placeholder="Sao chép một câu/đoạn từ tab Văn bản của tài liệu" /></label>
        <label className="qx-field">Lời giải<textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Vì sao thứ tự / cách ghép này đúng" /></label>
        <div className="qx-row">
          <label className="qx-field qx-points">Điểm<input type="number" min={0.25} max={100} step={0.25} value={points} onChange={e => setPoints(Number(e.target.value))} /></label>
          <button type="button" className="qx-primary" onClick={add}>Thêm vào đề</button>
        </div>
        {error && <p className="qx-error" role="alert">{error}</p>}
      </div>
    </details>
  );
}

/** Rubric (text answers), tags and audio for one question. Tags/rubric don't reset the review; audio does. */
export function QuestionExtrasEditor({ question, onMeta, onEdit }: { question: FullQuestionDTO; onMeta: (u: Partial<FullQuestionDTO>) => void; onEdit: (u: Partial<FullQuestionDTO>) => void }) {
  const { toast } = useFeedback();
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState((question.tags ?? []).join(', '));
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': file.type || 'audio/mpeg' }, body: file });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tải được tệp âm thanh.');
      onEdit({ audioAssetId: data.id });
      toast('Đã gắn âm thanh vào câu hỏi.', 'success');
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setUploading(false); }
  };
  return (
    <div className="qx-extras">
      {(question.type === 'short' || question.type === 'fill') && (
        <label className="qx-field">Rubric chấm (cho AI gợi ý & giáo viên duyệt)
          <textarea value={question.rubric ?? ''} maxLength={2000} onChange={e => onMeta({ rubric: e.target.value })} placeholder="VD: Chấp nhận cách diễn đạt tương đương; thiếu đơn vị trừ nửa số điểm." />
        </label>
      )}
      <label className="qx-field">Thẻ (cách nhau bằng dấu phẩy)
        <input value={tags} onChange={e => setTags(e.target.value)} onBlur={() => onMeta({ tags: [...new Set(tags.split(',').map(t => t.trim().slice(0, 40)).filter(Boolean))].slice(0, 12) })} placeholder="VD: HK1, chương 2, hay sai" />
      </label>
      <div className="qx-field">Âm thanh nghe hiểu (MP3/M4A/WAV/OGG, tối đa 8 MB)
        {question.audioAssetId ? (
          <div className="qx-audio"><audio controls preload="none" src={`/api/media/${question.audioAssetId}`} /><button type="button" onClick={() => onEdit({ audioAssetId: null })}>Gỡ âm thanh</button></div>
        ) : (
          <input type="file" accept="audio/*" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        )}
        {uploading && <small>Đang tải lên…</small>}
      </div>
    </div>
  );
}

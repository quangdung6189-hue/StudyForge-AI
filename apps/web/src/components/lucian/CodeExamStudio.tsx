// Lucian UX/UI Prompt #039 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#039
// Lucian UX/UI Prompt #355 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#355
'use client';

import { useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { FullQuestionDTO, QuestionType } from '@studyforge/contracts';
import { allocateExamPoints, EXAM_SAMPLE, normalizeExamCode, parseExamCode, questionCode, readExamImport, QUESTION_LABELS, replaceExamQuestion, type ExamQuestion } from '@/lib/exam-code';
import './code-exam-studio.css';
export { parseExamCode, isSectionHeader, normalizeLine } from '@/lib/exam-code';

type Saved = { id: string; code: string; title: string; minutes: number; revision: number; sourceDocumentId: string | null; savedAt: string };
interface Props {
  initialCode?: string; documentText?: string; documentTitle?: string; sourceDocumentId?: string;
  title: string; setTitle: (value: string) => void; minutes: number; setMinutes: (value: number) => void;
  onApply: (questions: FullQuestionDTO[], documentId: string) => void; onBack?: () => void;
}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Chưa hoàn tất yêu cầu. Giữ nội dung và thử lại.');
  return data;
}
const cleanStatus = (q: ExamQuestion) => !q.issues.some(issue => issue.severity === 'error');
function ExamTextInput({ value, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onChange: (value: string) => void }) {
  const [local, setLocal] = useState(value); const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  return <input {...props} value={local} onFocus={() => { focused.current = true; }} onChange={event => { setLocal(event.target.value); onChange(event.target.value); }} onBlur={() => { focused.current = false; }}/>;
}
const guide = [
  { title: '1. Nhập nội dung', text: 'Chọn tài liệu đã tải, dán đề hoặc mở mẫu. Tiêu đề phần được giữ trong mục lục, không tính thành câu hỏi.' },
  { title: '2. Đối chiếu đáp án', text: 'Bấm phương án đúng hoặc chọn Đúng/Sai cho từng ý. Dấu màu, dấu * và bảng đáp án phải rõ ràng, thống nhất; câu chưa chắc nằm ở Cần xác minh.' },
  { title: '3. Lưu và duyệt', text: 'Lưu nháp cả khi chưa đủ đáp án. Chỉ chuyển duyệt sau khi sửa hết lỗi; kiểm tra lại từng câu trước khi xuất bản.' },
];

export function CodeExamStudio({ initialCode, documentText, documentTitle, sourceDocumentId, title, setTitle, minutes, setMinutes, onApply, onBack }: Props) {
  const [code, setCode] = useState(initialCode ?? documentText ?? '');
  const [selected, setSelected] = useState(''), [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [view, setView] = useState<'split' | 'visual' | 'code'>('split'), [full, setFull] = useState(false), [help, setHelp] = useState(false), [guideStep, setGuideStep] = useState(0);
  const [saveState, setSaveState] = useState<'dirty' | 'saving' | 'saved' | 'error' | 'loading'>('dirty');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [showImport, setShowImport] = useState(false), [importText, setImportText] = useState('');
  const importDialog = useRef<HTMLDialogElement>(null);
  const id = useRef(''), revision = useRef(0), source = useRef(sourceDocumentId ?? null), lastSaved = useRef('');
  const inFlight = useRef<Promise<Saved> | null>(null), alive = useRef(true), text = useRef<HTMLTextAreaElement>(null), gutter = useRef<HTMLDivElement>(null);
  const restoreFailure = useRef(false);
  const pendingVisualEdit = useRef(false);
  const history = useRef<string[]>([]), future = useRef<string[]>([]), skipDirty = useRef(false);
  const tabs = useRef<HTMLDivElement>(null), pill = useRef<HTMLSpanElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const uid = useId(), reduce = useReducedMotion();
  const parsed = useMemo(() => parseExamCode(code), [code]);
  const active = parsed.questions.find(question => question.id === selected) ?? parsed.questions[0];
  const errors = parsed.issues.filter(issue => issue.severity === 'error');
  const answered = parsed.questions.filter(cleanStatus).length;
  const scoring = parsed.questions.reduce((sum, question) => sum + (question.type === 'boolean' ? question.statements.length : 1), 0);
  const total = parsed.questions.reduce((sum, question) => sum + question.points, 0);
  const visible = parsed.questions.filter(q => (!query || `${q.stem} ${q.number} ${q.group}`.toLowerCase().includes(query.toLowerCase())) && (filter === 'all' || filter === 'missing' && q.issues.some(i => i.code === 'MISSING_ANSWER') || filter === 'verify' && q.issues.some(i => ['ANSWER_CONFLICT', 'REQUIRES_REVIEW'].includes(i.code)) || filter === 'error' && !cleanStatus(q)));
  const payload = () => ({ id: id.current, code, title, minutes, revision: revision.current, sourceDocumentId: source.current });
  const fingerprint = () => JSON.stringify({ code, title, minutes, sourceDocumentId: source.current });
  const latest = useRef(''); latest.current = fingerprint();
  const currentCode = useRef(code); currentCode.current = code;

  useEffect(() => {
    alive.current = true;
    const restore = async () => {
      const existing = new URL(window.location.href).searchParams.get('draftId');
      id.current = existing || crypto.randomUUID();
      if (existing) {
        setSaveState('loading');
        try {
          const saved = await request<Saved>(`/api/exam-drafts/${existing}`);
          if (!alive.current) return;
          skipDirty.current = true; setCode(saved.code); setTitle(saved.title); setMinutes(saved.minutes); revision.current = saved.revision; source.current = saved.sourceDocumentId;
          lastSaved.current = JSON.stringify({ code: saved.code, title: saved.title, minutes: saved.minutes, sourceDocumentId: saved.sourceDocumentId }); setSavedAt(saved.savedAt); setSaveState('saved');
        } catch (err) { restoreFailure.current = true; if (alive.current) { setError((err as Error).message); setSaveState('error'); } }
      }
      if (alive.current) setReady(true);
    };
    void restore();
    return () => { alive.current = false; };
  }, []);

  useEffect(() => { if (!ready || restoreFailure.current) return; if (skipDirty.current) { skipDirty.current = false; return; } if (fingerprint() !== lastSaved.current) setSaveState('dirty'); }, [code, title, minutes, ready]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (pendingVisualEdit.current || saveState === 'dirty' || saveState === 'saving' || saveState === 'error') { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [saveState]);
  useEffect(() => {
    const place = () => { const button = tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]'); if (button && pill.current) { pill.current.style.setProperty('--x', `${button.offsetLeft}px`); pill.current.style.setProperty('--w', `${button.offsetWidth}px`); } };
    const observer = new ResizeObserver(place); if (tabs.current) observer.observe(tabs.current); place(); return () => observer.disconnect();
  }, [view]);
  useEffect(() => { if (!full) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [full]);
  useEffect(() => { if (help) dialog.current?.showModal(); else dialog.current?.close(); }, [help]);
  useEffect(() => { if (showImport) importDialog.current?.showModal(); else importDialog.current?.close(); }, [showImport]);

  const change = (next: string) => { if (next === currentCode.current) return; history.current = [...history.current.slice(-49), currentCode.current]; future.current = []; currentCode.current = next; latest.current = JSON.stringify({ code: next, title, minutes, sourceDocumentId: source.current }); setCode(next); setNotice(''); };
  const undo = () => { const previous = history.current.pop(); if (previous === undefined) return; future.current.push(code); setCode(previous); };
  const redo = () => { const next = future.current.pop(); if (next === undefined) return; history.current.push(code); setCode(next); };
  const update = (q: ExamQuestion, patch: Partial<ExamQuestion>) => { const latestQuestion = parseExamCode(currentCode.current).questions.find(item => item.id === q.id); if (latestQuestion) change(replaceExamQuestion(currentCode.current, latestQuestion, patch)); };
  const jump = (q: ExamQuestion) => {
    setSelected(q.id);
    document.getElementById(`exam-card-${q.id}`)?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'nearest' });
    if (text.current) { const start = code.split('\n').slice(0, q.startLine - 1).join('\n').length; text.current.setSelectionRange(start ? start + 1 : 0, start + q.sourceText.length); text.current.scrollTop = Math.max(0, (q.startLine - 3) * 25); }
  };
  const save = async (): Promise<Saved> => {
    if (pendingVisualEdit.current && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (restoreFailure.current) throw new Error('Chưa mở được bản nháp. Tải lại trang trước khi lưu để tránh ghi đè nội dung.');
    if (inFlight.current) return inFlight.current;
    const sent = { ...payload(), code: currentCode.current }, signature = JSON.stringify({ code: currentCode.current, title, minutes, sourceDocumentId: source.current });
    setSaveState('saving');
    const operation = request<Saved>('/api/exam-drafts', sent).then(saved => {
      revision.current = saved.revision; lastSaved.current = signature;
      if (alive.current) { setSavedAt(saved.savedAt); setSaveState(!pendingVisualEdit.current && latest.current === signature ? 'saved' : 'dirty'); const url = new URL(window.location.href); url.searchParams.set('draftId', saved.id); window.history.replaceState(null, '', url); }
      return saved;
    }).catch(err => { if (alive.current) { setSaveState('error'); setError((err as Error).message); } throw err; }).finally(() => { inFlight.current = null; });
    inFlight.current = operation; return operation;
  };
  useEffect(() => {
    if (!ready || saveState !== 'dirty' || busy || !code.trim() || pendingVisualEdit.current) return;
    const timer = setTimeout(() => { if (!pendingVisualEdit.current) void save().catch(() => {}); }, 1400);
    return () => clearTimeout(timer);
  }, [code, title, minutes, ready, saveState, busy]);
  const prepare = async () => {
    const validation = parseExamCode(currentCode.current);
    if (validation.issues.some(issue => issue.severity === 'error') || !validation.questions.length) { setFilter('error'); setError('Sửa câu thiếu đáp án hoặc cần xác minh trước khi duyệt. Không có đáp án nào được tự đoán.'); return; }
    if (!title.trim()) { setError('Đặt tên đề trước khi duyệt.'); return; }
    setBusy(true);
    try { const saved = await save(); if (latest.current !== lastSaved.current) throw new Error('Nội dung vừa thay đổi trong lúc lưu. Hãy bấm kiểm tra lại để dùng bản mới nhất.'); const result = await request<{ documentId: string; questions: FullQuestionDTO[] }>(`/api/exam-drafts/${saved.id}/prepare`, { revision: saved.revision }); if (latest.current !== lastSaved.current) throw new Error('Nội dung đã thay đổi. Hãy lưu và kiểm tra lại.'); onApply(result.questions, result.documentId); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const addQuestion = (type: QuestionType) => {
    const q: ExamQuestion = { id: '', globalIndex: 0, number: Math.max(0, ...parsed.questions.map(q => q.number)) + 1, group: active?.group ?? '', type, stem: 'Nội dung câu hỏi mới', options: type === 'single' || type === 'multiple' ? ['A', 'B', 'C', 'D'].map(letter => ({ id: letter, letter, text: `Phương án ${letter}` })) : [], statements: type === 'boolean' ? ['a', 'b', 'c', 'd'].map(letter => ({ id: letter, letter, text: `Nhận định ${letter}`, verdict: null })) : [], correctOptionIds: [], acceptedAnswers: [], points: 1, explanation: '', startLine: 0, endLine: 0, sourceText: '', issues: [], answerEvidence: [] };
    change(code.trimEnd() + '\n\n' + questionCode(q));
  };
  const setType = (q: ExamQuestion, type: QuestionType) => {
    if (type === q.type) return;
    if (!window.confirm('Đổi dạng sẽ xóa đáp án cũ của câu này. Có thể Hoàn tác.')) return;
    update(q, { type, correctOptionIds: [], acceptedAnswers: [], statements: type === 'boolean' ? (q.options.length ? q.options : ['a', 'b', 'c', 'd'].map(letter => ({ id: letter, letter, text: `Nhận định ${letter}` }))).map(o => ({ ...o, letter: o.letter.toLowerCase(), verdict: null })) : [], options: type === 'single' || type === 'multiple' ? (q.options.length ? q.options : ['A', 'B', 'C', 'D'].map(letter => ({ id: letter, letter, text: `Phương án ${letter}` }))) : [] });
  };
  const confirmEvidence = (q: ExamQuestion) => {
    if (!window.confirm('Đã đối chiếu file gốc và tự kiểm tra đáp án của câu này? Thao tác ghi nhận xác minh của giáo viên, không phải AI xác nhận.')) return;
    const clean = (value: string) => value.replace(/\[Cần xác minh\]/giu, '').trim();
    change(replaceExamQuestion(code, q, { stem: clean(q.stem), options: q.options.map(option => ({ ...option, text: clean(option.text) })), statements: q.statements.map(statement => ({ ...statement, text: clean(statement.text) })), issues: q.issues.filter(issue => !['REQUIRES_REVIEW', 'ANSWER_CONFLICT'].includes(issue.code)) }));
  };
  const applyImport = () => {
    let imported: ReturnType<typeof readExamImport>;
    try { imported = readExamImport(importText); } catch (err) { setError((err as Error).message); return; }
    if (code.trim() && !window.confirm('Thay nội dung bằng bản vừa nhập? Có thể Hoàn tác.')) return;
    change(imported.code); if (imported.title !== undefined) setTitle(imported.title); if (imported.minutes !== undefined) setMinutes(imported.minutes);
    setShowImport(false); setImportText(''); setNotice('Đã nhập nội dung. Đối chiếu các câu cần xác minh trước khi dùng.');
  };

  return <section className={`ux exam-studio ${full ? 'exam-full' : ''} exam-view-${view}`} onInputCapture={event => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.closest('.exam-card')) { pendingVisualEdit.current = true; setSaveState('dirty'); }
  }} onBlurCapture={event => { if (event.target instanceof HTMLTextAreaElement && event.target.closest('.exam-card')) pendingVisualEdit.current = false; }} onKeyDown={event => {
    if (event.key === 'Escape') setFull(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save().catch(() => {}); }
  }} aria-label="Trình biên soạn đề thi">
    <header className="exam-heading"><div><span className="exam-eyebrow">STUDYFORGE / ASSESSMENT STUDIO</span><h3>Trình biên soạn đề thi</h3><p>Soạn chính xác. Rõ nguồn đáp án. Chủ động kiểm duyệt.</p></div><button className="exam-icon-button" type="button" onClick={() => { setGuideStep(0); setHelp(true); }}>? <span>Hướng dẫn</span></button></header>
    <div className="exam-settings"><label className="exam-title-label">Tên đề<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Ví dụ: Kiểm tra giữa kỳ · Tin học 10" maxLength={200}/></label><label>Thời gian<div className="exam-number"><input aria-label="Thời gian làm bài" type="number" min={1} max={1440} value={minutes} onChange={event => setMinutes(Number(event.target.value))}/><span>phút</span></div></label><div className="exam-score"><small>Tổng điểm</small><b>{Number(total.toFixed(4))}<span> / 10</span></b></div><div className="exam-save-state" data-state={saveState} role="status"><svg viewBox="0 0 24 20" aria-hidden="true"><path d="M7 16.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.4 7.6 4.5 4.5 0 0 0 7 16.5z"/>{saveState === 'saved' && <path className="exam-save-check" d="M9.3 12l2.2 2.1 4-4.2"/>}</svg><span>{saveState === 'saved' ? `Đã lưu ${savedAt ? new Date(savedAt).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' }) : ''}` : saveState === 'saving' ? 'Đang lưu nháp…' : saveState === 'loading' ? 'Đang mở nháp…' : saveState === 'error' ? 'Chưa lưu được' : 'Có thay đổi chưa lưu'}</span></div></div>
    <div className="exam-toolbar"><div className="exam-tool-group"><button type="button" onClick={undo} disabled={!history.current.length} title="Hoàn tác">↶ <span>Hoàn tác</span></button><button type="button" onClick={redo} disabled={!future.current.length} title="Làm lại">↷</button><span className="exam-divider"/><button type="button" onClick={() => setShowImport(true)}>Nhập đề</button><details className="exam-menu"><summary>＋ Thêm câu</summary><div>{Object.entries(QUESTION_LABELS).map(([value, label]) => <button key={value} type="button" onClick={event => { addQuestion(value as QuestionType); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{label}</button>)}</div></details><details className="exam-menu"><summary>Công cụ ⌄</summary><div><button type="button" onClick={() => { change(allocateExamPoints(code)); setNotice('Đã phân bổ điểm, tổng đúng 10. Các ý đúng–sai chia đều trong câu.'); }}>Chia đều thang điểm 10</button><button type="button" onClick={() => { if (!parsed.questions.length) return; change(normalizeExamCode(code)); setNotice('Đã chuẩn hóa cấu trúc. Kiểm tra cảnh báo trước khi áp dụng.'); }}>Chuẩn hóa văn bản</button><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(code); setNotice('Đã sao chép văn bản đề.'); } catch { setError('Trình duyệt không cho sao chép. Hãy chọn văn bản trong editor.'); } }}>Sao chép văn bản</button><button type="button" onClick={() => { const blob = new Blob([JSON.stringify({ format: 'studyforge.exam.v1', title, minutes, code }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'studyforge-exam.json'; a.click(); URL.revokeObjectURL(url); }}>Xuất bản soạn JSON</button><button type="button" onClick={() => { if (window.confirm('Thay nội dung đang soạn bằng đề mẫu? Có thể Hoàn tác.')) change(EXAM_SAMPLE); }}>Mở đề mẫu ba dạng</button>{documentText && <button type="button" onClick={() => { if (window.confirm('Nạp lại nội dung tài liệu gốc? Có thể Hoàn tác.')) { change(documentText); source.current = sourceDocumentId ?? null; } }}>Nạp lại tài liệu nguồn</button>}</div></details></div><div className="exam-view-tabs" ref={tabs} role="tablist" aria-label="Chế độ biên soạn"><span ref={pill} className="exam-view-pill" aria-hidden="true"/>{([['split', 'Song song'], ['visual', 'Trực quan'], ['code', 'Văn bản']] as const).map(([value, label], i) => <button type="button" role="tab" id={`${uid}-${value}`} aria-controls={`${uid}-workspace`} aria-selected={view === value} tabIndex={view === value ? 0 : -1} key={value} onClick={() => setView(value)} onKeyDown={event => { const modes = ['split', 'visual', 'code'] as const; if (['ArrowRight', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); const next = (i + (event.key === 'ArrowRight' ? 1 : -1) + 3) % 3; setView(modes[next]); tabs.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next].focus(); } }}>{label}</button>)}</div><button type="button" className="exam-full-button" onClick={() => setFull(!full)}>{full ? '↙ Thu nhỏ' : '⛶ Tập trung'}</button></div>
    {error && <div className="exam-alert" role="alert">{error}<button type="button" aria-label="Đóng thông báo lỗi" onClick={() => setError('')}>×</button></div>}
    <div className="exam-notice" role="status">{notice || (documentTitle ? `Nguồn: ${documentTitle} · Chỉ đánh dấu đáp án có căn cứ rõ.` : 'Có thể lưu nháp khi chưa đủ đáp án. Không tự chọn phương án mặc định.')}</div>
    <div className="exam-workspace" id={`${uid}-workspace`}><aside className="exam-outline"><div className="exam-outline-head"><b>CẤU TRÚC ĐỀ</b><span>{parsed.questions.length}</span></div><label className="exam-search"><span>Tìm câu hỏi</span><input placeholder="Nội dung, số câu…" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Lọc câu hỏi" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả câu</option><option value="missing">Thiếu đáp án</option><option value="verify">Cần xác minh</option><option value="error">Tất cả lỗi</option></select><nav aria-label="Danh mục câu hỏi">{visible.map((q, i) => <div key={q.id}>{q.group && (i === 0 || visible[i - 1].group !== q.group) && <h4>{q.group}</h4>}<button type="button" className={active?.id === q.id ? 'active' : ''} onClick={() => jump(q)}><span className={cleanStatus(q) ? 'exam-dot ready' : 'exam-dot'}/><b>Câu {q.number}</b><small>{`#${q.globalIndex}`} · {q.type === 'boolean' ? `${q.statements.length} ý` : QUESTION_LABELS[q.type].replace('Trắc nghiệm ', '')}</small></button></div>)}</nav><div className="exam-outline-footer"><b>{answered}/{parsed.questions.length}</b><small>câu đủ dữ liệu để duyệt</small><progress value={answered} max={Math.max(1, parsed.questions.length)} aria-label="Câu đủ dữ liệu"/></div></aside>
      <section className="exam-code-panel" aria-label="Văn bản cấu trúc"><header><div><b>Văn bản cấu trúc</b><small>Nhập đề · tự nhận diện cấu trúc và đáp án</small></div><span>{code.split('\n').length} dòng</span></header><div className="exam-code-area"><div ref={gutter} className="exam-gutter" aria-hidden="true">{code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div><textarea aria-label="Văn bản đề thi" ref={text} value={code} spellCheck={false} placeholder={'PHẦN I. TRẮC NGHIỆM\n\nCâu 1: Nội dung câu hỏi\nA. Phương án A\n*B. Phương án B'} onChange={event => change(event.target.value)} onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop; }} onClick={event => { const line = event.currentTarget.value.slice(0, event.currentTarget.selectionStart).split('\n').length; const q = parsed.questions.find(q => line >= q.startLine && line <= q.endLine); if (q) setSelected(q.id); }}/></div><footer><span>*B. đánh dấu phương án · Đáp án: a - Đ, b - S · Trả lời: Hà Nội | Ha Noi</span><button type="button" onClick={() => setHelp(true)}>Xem cú pháp</button></footer></section>
      <section className="exam-preview" aria-label="Xem trước và chỉnh câu hỏi"><header><div><b>Đề thi trực quan</b><small>Chỉnh trực tiếp · Nội dung đồng bộ với văn bản</small></div><span className="exam-count-badge">{visible.length} câu</span></header><div className="exam-cards">{!visible.length && <div className="exam-empty"><div>▤</div><h4>{parsed.questions.length ? 'Không có câu phù hợp bộ lọc' : 'Bắt đầu một đề thi rõ ràng'}</h4><p>Dán nội dung vào khung văn bản hoặc mở đề mẫu. Tiêu đề và hướng dẫn không được tính thành câu hỏi.</p><button type="button" onClick={() => code.trim() ? setFilter('all') : change(EXAM_SAMPLE)}>{code.trim() ? 'Xem tất cả câu' : 'Mở đề mẫu'}</button></div>}{visible.map(q => <article className={`exam-card ${active?.id === q.id ? 'selected' : ''}`} id={`exam-card-${q.id}`} key={q.id} onFocus={() => setSelected(q.id)}><div className="exam-card-top"><button className="exam-qindex" type="button" onClick={() => jump(q)}>CÂU {q.number}<small>#{q.globalIndex} · dòng {q.startLine}</small></button><select aria-label={`Dạng câu ${q.globalIndex}`} value={q.type} onChange={event => setType(q, event.target.value as QuestionType)}>{Object.entries(QUESTION_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><label className="exam-point-input">Điểm<input aria-label={`Điểm câu ${q.globalIndex}`} type="number" min={0.01} max={100} step={0.01} value={q.points} onChange={event => update(q, { points: Number(event.target.value) })}/></label><button type="button" aria-label={`Xóa câu ${q.globalIndex}`} className="exam-delete" onClick={() => { if (window.confirm(`Xóa câu ${q.number}? Có thể Hoàn tác.`)) change(replaceExamQuestion(code, q, null)); }}>×</button></div>{q.group && <div className="exam-card-section">{q.group}</div>}<textarea key={`${q.id}:${q.stem}`} className="exam-stem" aria-label={`Nội dung câu ${q.globalIndex}`} rows={Math.min(6, Math.max(2, q.stem.split('\n').length))} defaultValue={q.stem} onBlur={event => { if (event.target.value !== q.stem) update(q, { stem: event.target.value }); }}/>
        {q.type === 'boolean' ? <div className="exam-statements">{q.statements.map(statement => <div key={statement.id}><span>{statement.letter})</span><textarea aria-label={`Ý ${statement.letter} câu ${q.globalIndex}`} rows={2} defaultValue={statement.text} key={`${statement.id}:${statement.text}`} onBlur={event => { if (event.target.value !== statement.text) update(q, { statements: q.statements.map(s => s.id === statement.id ? { ...s, text: event.target.value } : s) }); }}/><select aria-label={`Đáp án ý ${statement.letter} câu ${q.globalIndex}`} value={statement.verdict === null ? '' : String(statement.verdict)} onChange={event => update(q, { statements: q.statements.map(s => s.id === statement.id ? { ...s, verdict: event.target.value === '' ? null : event.target.value === 'true' } : s) })}><option value="">Chưa chọn</option><option value="true">Đúng</option><option value="false">Sai</option></select></div>)}</div> : q.options.length ? <div className="exam-options">{q.options.map(option => <label key={option.id} className={q.correctOptionIds.includes(option.id) ? 'correct' : ''}><input aria-label={`Đáp án ${option.letter} câu ${q.globalIndex}`} type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`answer-${q.id}`} checked={q.correctOptionIds.includes(option.id)} onChange={() => update(q, { correctOptionIds: q.type === 'multiple' ? q.correctOptionIds.includes(option.id) ? q.correctOptionIds.filter(id => id !== option.id) : [...q.correctOptionIds, option.id] : [option.id] })}/><b>{option.letter}</b><textarea aria-label={`Phương án ${option.letter} câu ${q.globalIndex}`} rows={1} defaultValue={option.text} key={`${option.id}:${option.text}`} onBlur={event => { if (event.target.value !== option.text) update(q, { options: q.options.map(o => o.id === option.id ? { ...o, text: event.target.value } : o) }); }}/>{q.correctOptionIds.includes(option.id) && <span>Đáp án</span>}</label>)}</div> : <label className="exam-answer-text">Đáp án chấp nhận <small>Cách nhau bằng |, không dùng /</small><ExamTextInput aria-label={`Đáp án câu ${q.globalIndex}`} value={q.acceptedAnswers.join(' | ')} onChange={value => update(q, { acceptedAnswers: value.split('|').map(value => value.trim()).filter(Boolean) })}/></label>}
        {q.issues.length > 0 && <ul className="exam-issues">{q.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>}{q.issues.some(issue => ['REQUIRES_REVIEW', 'ANSWER_CONFLICT'].includes(issue.code)) && <button className="exam-confirm-evidence" type="button" onClick={() => confirmEvidence(q)}>Tôi đã đối chiếu, xác minh câu này</button>}<details className="exam-evidence"><summary>{q.answerEvidence.length ? 'Căn cứ nhận diện & lời giải' : 'Bổ sung lời giải / kiểm tra nguồn'}</summary>{q.answerEvidence.length > 0 && <blockquote>{q.answerEvidence.join('\n')}</blockquote>}<p>Đáp án mới sửa được ghi nhận là giáo viên biên soạn. Nội dung nhập từ tài liệu phải đối chiếu bản gốc; chưa tự đánh dấu đã duyệt.</p><textarea aria-label={`Lời giải câu ${q.globalIndex}`} rows={3} defaultValue={q.explanation} key={`${q.id}:${q.explanation}`} onBlur={event => { if (event.target.value !== q.explanation) update(q, { explanation: event.target.value }); }} placeholder="Lời giải đã kiểm tra…"/></details></article>)}</div></section></div>
    <footer className="exam-bottom"><div><b>{parsed.questions.length} câu gốc <span>· {scoring} mục chấm</span></b><small>{errors.length ? `${parsed.questions.filter(q => !cleanStatus(q)).length} câu cần hoàn thiện trước khi duyệt` : 'Không phát hiện lỗi cấu trúc · Giáo viên vẫn cần duyệt đáp án'}</small></div><div>{onBack && <button type="button" onClick={() => { if (saveState !== 'saved' && !window.confirm('Có nội dung chưa lưu. Quay lại và giữ bản đã lưu gần nhất?')) return; onBack(); }}>← Quay lại</button>}<button type="button" disabled={busy || !ready || saveState === 'saving'} onClick={() => void save().catch(() => {})}>Lưu nháp</button><button className="exam-primary" type="button" disabled={busy || !ready || !parsed.questions.length} onClick={() => void prepare()}>{busy ? 'Đang chuẩn bị…' : 'Kiểm tra & duyệt đề →'}</button></div></footer>
    <dialog ref={dialog} className="exam-help" onCancel={() => setHelp(false)} onClick={event => { if (event.target === event.currentTarget) setHelp(false); }}><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}><header><span>HƯỚNG DẪN BIÊN SOẠN</span><button type="button" aria-label="Đóng hướng dẫn" onClick={() => setHelp(false)}>×</button></header><h3>{guide[guideStep].title}</h3><p>{guide[guideStep].text}</p><nav aria-label="Bước hướng dẫn">{guide.map((step, index) => <button aria-current={index === guideStep ? 'step' : undefined} type="button" onClick={() => setGuideStep(index)} key={step.title}>{index + 1}</button>)}</nav><pre>{EXAM_SAMPLE}</pre><p><b>Quan trọng:</b> màu trong tiêu đề, dấu * phép nhân hoặc chú thích không phải đáp án. PDF/ảnh scan không rõ màu sẽ cần xác minh. Không tự suy luận câu thiếu đáp án.</p><footer><button type="button" onClick={() => { if (code.trim() && !window.confirm('Thay nội dung bằng mẫu? Có thể Hoàn tác.')) return; change(EXAM_SAMPLE); setHelp(false); }}>Dùng mẫu này</button><button type="button" className="exam-primary" onClick={() => guideStep < 2 ? setGuideStep(guideStep + 1) : setHelp(false)}>{guideStep < 2 ? 'Tiếp theo →' : 'Bắt đầu biên soạn'}</button></footer></motion.div></dialog>
    <dialog ref={importDialog} className="exam-help" onCancel={() => setShowImport(false)}><header><span>NHẬP BẢN SOẠN</span><button type="button" aria-label="Đóng nhập bản soạn" onClick={() => setShowImport(false)}>×</button></header><h3>Dán nội dung hoặc nhập JSON</h3><p>Chấp nhận văn bản cấu trúc và JSON đã xuất từ StudyForge. Màu/gạch chân chỉ được giữ khi tải file DOCX gốc; dán text không có định dạng màu.</p><textarea aria-label="Nội dung nhập bản soạn" rows={12} value={importText} onChange={event => setImportText(event.target.value)} maxLength={1500000}/><input aria-label="Chọn file bản soạn" type="file" accept=".json,.txt" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1500000) { setError('File bản soạn quá lớn.'); return; } setImportText(await file.text()); }}/><footer><button type="button" onClick={() => setShowImport(false)}>Hủy</button><button type="button" className="exam-primary" onClick={applyImport}>Nhập & nhận diện</button></footer></dialog>
  </section>;
}
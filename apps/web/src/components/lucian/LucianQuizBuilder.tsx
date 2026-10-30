// Lucian UX/UI Prompt #042 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#042
// Lucian UX/UI Prompt #015 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#015
'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { DocumentDTO, FullQuestionDTO, QuestionType } from '@studyforge/contracts';
import { CodeExamStudio } from './CodeExamStudio';
import './quiz-builder.css';
import './quiz-builder-app.css';

const typeInfo: { type: QuestionType; title: string; hint: string; icon: string }[] = [
  { type: 'single', title: 'Trắc nghiệm', hint: 'Một phương án đúng', icon: 'A' },
  { type: 'boolean', title: 'Đúng / Sai', hint: 'Mỗi nhận định là một câu', icon: '✓' },
  { type: 'short', title: 'Trả lời ngắn', hint: 'Đáp án chữ hoặc số', icon: 'Aa' },
  { type: 'multiple', title: 'Nhiều đáp án', hint: 'Chọn các phương án đúng', icon: 'AB' },
  { type: 'fill', title: 'Điền từ', hint: 'Hoàn thành chỗ trống', icon: '…' },
];
const label = (type: QuestionType) => typeInfo.find(item => item.type === type)!.title;
type Analysis = { counts: Record<QuestionType, number>; total: number; status: string };
type Published = { shareCode: string; shareUrl: string };
type Progress = { completed: number; total: number; cached: number; stage: string };

async function streamGeneration(body: unknown, signal: AbortSignal, progress: (value: Progress) => void) {
  const response = await fetch('/api/quizzes/generate?stream=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
    const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? 'Không thể tạo đề.'); return data as { questions: FullQuestionDTO[]; warnings: string[] };
  }
  const reader = response.body!.getReader(), decoder = new TextDecoder();
  let pending = '', result: { questions: FullQuestionDTO[]; warnings: string[] } | undefined;
  function consume(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.event === 'progress') progress(event);
    else if (event.event === 'error') throw new Error(event.error.message);
    else if (event.event === 'result') result = event;
  }
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n'); pending = lines.pop() ?? ''; for (const line of lines) consume(line);
    }
    consume(pending + decoder.decode());
  } finally { reader.releaseLock(); }
  if (!result) throw new Error('Kết nối bị ngắt trước khi hoàn tất. Bấm thử lại để tiếp tục từ nhóm đã xong.');
  return result;
}

async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal }); }
  catch(error) { if (signal?.aborted) throw error; throw new Error('Kết nối bị ngắt. Giữ nội dung trên trang và bấm thử lại; bản nháp đã lưu sẽ được nhận diện.'); }
  const data = await response.json().catch(() => ({ error: { message: 'Máy chủ đang gián đoạn. Giữ nội dung và thử lại.' } }));
  if (!response.ok) throw new Error(data.error?.message ?? 'Không thể hoàn tất yêu cầu. Hãy thử lại.');
  return data as T;
}

const modes = [
  ['ai_analyze', '1. AI phân tích & tự động giải', 'AI đọc tài liệu, phân tích dạng câu hỏi và tự động suy luận giải đáp án nếu tài liệu chưa có sẵn.', '🧠'],
  ['code_editor', '2. Soạn đề bằng mã · Trực quan (kiểu Azota)', 'Nhập hoặc dán mã đề text/code, xem trước 2 cột song song và click chuột gắn đáp án trực tiếp.', '⚡'],
] as const;

function ModeCards({ value, onChange }: { value: string; onChange: (value: 'ai_analyze' | 'code_editor') => void }) {
  const group = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ top: 0, height: 0 });
  useEffect(() => {
    const measure = () => {
      const option = group.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      if (option) setFrame({ top: option.offsetTop, height: option.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    if (group.current) observer.observe(group.current);
    measure();
    return () => observer.disconnect();
  }, [value]);
  return <div className="ux u015"><div ref={group} className="u015-grp" role="radiogroup" aria-label="Chế độ tạo câu hỏi">
    <span className="u015-frame" style={frame} aria-hidden="true" />
    {modes.map(([mode, title, hint, icon], index) => <button type="button" key={mode} className="u015-opt" role="radio" aria-checked={value === mode} tabIndex={value === mode ? 0 : -1} onClick={() => onChange(mode as any)} onKeyDown={event => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const next = (index + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + modes.length) % modes.length; onChange(modes[next][0] as any); group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next].focus(); }
    }}><span className="u015-dot" aria-hidden="true"/><span className="u015-ic" style={{ '--g': mode === 'ai_analyze' ? 'linear-gradient(140deg,#8B6CFF,#5B8CFF)' : 'linear-gradient(140deg,#22C3A6,#0EA5E9)' } as CSSProperties} aria-hidden="true">{icon}</span><span className="u015-txt"><b>{title}</b><small>{hint}</small></span></button>)}
  </div></div>;
}

export function LucianQuizBuilder() {
  const searchParams = useSearchParams(), initialId = searchParams.get('docId') ?? '', initialQuiz = searchParams.get('quizId') ?? '';
  const [step, setStep] = useState(0);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [documentId, setDocumentId] = useState(initialId);
  const [docRawText, setDocRawText] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'ai_analyze' | 'code_editor'>('ai_analyze');
  const [types, setTypes] = useState<QuestionType[]>(['single', 'boolean', 'short']);
  const [count, setCount] = useState(6);
  const [minutes, setMinutes] = useState(15);
  const [difficulty, setDifficulty] = useState('balanced');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [docsLoading, setDocsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const generationAbort = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [questions, setQuestions] = useState<FullQuestionDTO[]>([]);
  const [filter, setFilter] = useState<QuestionType | 'all'>('all');
  const [reviewPage, setReviewPage] = useState(0);
  const [saveNotice, setSaveNotice] = useState('');
  const requestId = useRef<string | null>(null);
  const loadedQuiz = useRef('');
  const lastSavedContent = useRef('');
  const [savedId, setSavedId] = useState('');
  const [published, setPublished] = useState<Published | null>(null);
  const [copied, setCopied] = useState(false);
  const pane = useRef<HTMLElement>(null);
  const previousStep = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => () => generationAbort.current?.abort(), []);

  useEffect(() => {
    if (!initialQuiz || initialQuiz === loadedQuiz.current) return;
    const abort = new AbortController(); setBusy(true);
    api<{ id: string; documentId: string; title: string; durationMinutes: number; questions: FullQuestionDTO[]; isPublished: boolean }>(`/api/quizzes/${initialQuiz}`, undefined, abort.signal).then(data => {
      if (data.isPublished) throw new Error('Đề này đã xuất bản. Hãy mở đề trong ngân hàng.');
      loadedQuiz.current = data.id; lastSavedContent.current = JSON.stringify({ title: data.title, durationMinutes: data.durationMinutes, questions: data.questions }); setDocumentId(data.documentId); setTitle(data.title); setMinutes(data.durationMinutes); setQuestions(data.questions); setSavedId(data.id); setStep(2);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [initialQuiz]);

  useEffect(() => setReviewPage(0), [filter]);

  useEffect(() => {
    if (!busy) return;
    const started = Date.now(); setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const abort = new AbortController();
    api<{ items: DocumentDTO[] }>('/api/documents?limit=100', undefined, abort.signal).then(data => {
      setDocuments(data.items);
      const selected = data.items.find(d => d.id === initialId) ?? data.items.find(d => d.status === 'ready');
      if (!initialQuiz) { setDocumentId(selected?.id ?? ''); setTitle(selected ? `Bài kiểm tra: ${selected.title}`.slice(0, 200) : ''); }
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setDocsLoading(false); });
    return () => abort.abort();
  }, [initialId, initialQuiz]);

  useEffect(() => {
    if (!documentId) return;
    const abort = new AbortController();
    setAnalysis(null); setAnalysisLoading(true);
    api<any>(`/api/documents/${documentId}`, undefined, abort.signal).then(data => {
      setDocRawText(data.rawText || '');
      setAnalysis(data.analysis || null);
    }).catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setAnalysisLoading(false); });
    return () => abort.abort();
  }, [documentId]);

  useEffect(() => {
    const dir = step >= previousStep.current ? 1 : -1;
    previousStep.current = step;
    const animations: Animation[] = [];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (pane.current) animations.push(
        pane.current.animate([{ transform: `translateX(${dir * 40}%)` }, { transform: 'none' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' }),
        pane.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' }),
      );
    }
    if (!firstRender.current) heading.current?.focus({ preventScroll: true });
    firstRender.current = false;
    return () => animations.forEach(animation => animation.cancel());
  }, [step]);

  const found = types.reduce((total, type) => total + (analysis?.counts[type] ?? 0), 0);
  const ready = documents.find(d => d.id === documentId)?.status === 'ready';
  const valid = title.trim().length > 0 && Number.isInteger(count) && count >= 1 && count <= 100 && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && types.length > 0;
  const reviewed = questions.filter(q => q.reviewed).length;
  const move = (next: number) => { setError(''); setStep(next); };
  const edit = (id: string, update: Partial<FullQuestionDTO>) => { setSaveNotice(''); setQuestions(current => current.map(q => q.id === id ? { ...q, ...update, reviewed: false } : q)); };

  async function generate() {
    if (!valid || busy) return;
    setBusy(true); setError(''); setWarnings([]);
    setProgress({ completed: 0, total: count, cached: 0, stage: 'preparing' });
    const abort = new AbortController(); generationAbort.current = abort;
    try {
      const distribution = difficulty === 'foundation' ? { recognition: 60, comprehension: 30, application: 10 } : difficulty === 'challenge' ? { recognition: 20, comprehension: 30, application: 50 } : { recognition: 40, comprehension: 40, application: 20 };
      const result = await streamGeneration({ documentId, mode: 'ai_analyze', questionCount: count, types, difficultyDistribution: distribution }, abort.signal, setProgress);
      setQuestions(result.questions); setWarnings(result.warnings ?? []); setSavedId(''); requestId.current = crypto.randomUUID(); setSaveNotice(''); setReviewPage(0); setFilter('all'); move(2);
    } catch (err) { setError(abort.signal.aborted ? 'Đã dừng. Các nhóm đã hoàn tất được giữ lại; bấm thử lại để tiếp tục.' : (err as Error).message); } finally { generationAbort.current = null; setBusy(false); }
  }

  async function saveDraft() {
    const content = JSON.stringify({ title, durationMinutes: minutes, questions });
    if (savedId) {
      if (content === lastSavedContent.current) return savedId;
      const response = await fetch(`/api/quizzes/${savedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, durationMinutes: minutes, questions }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? 'Chưa lưu được bản nháp.');
      lastSavedContent.current = content; return savedId;
    }
    requestId.current ??= crypto.randomUUID();
    const result = await api<{ quiz: { id: string } }>('/api/quizzes', { requestId: requestId.current, documentId, title, durationMinutes: minutes, questions });
    setSavedId(result.quiz.id);
    lastSavedContent.current = content;
    loadedQuiz.current = result.quiz.id;
    window.history.replaceState(null, '', `/quizzes/create?quizId=${result.quiz.id}`);
    return result.quiz.id;
  }

  async function persist(publishNow: boolean) {
    if (busy || !questions.length || (publishNow && reviewed !== questions.length)) return;
    setBusy(true); setError('');
    try {
      const id = await saveDraft(); setSaveNotice('Đã lưu bản nháp. Bạn có thể tải lại trang và tiếp tục duyệt.');
      if (!publishNow) return;
      const result = await api<Published>(`/api/quizzes/${id}/publish`, { durationMinutes: minutes, allowReview: true });
      setPublished(result); move(3);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return <div className={`ux quiz-studio ${mode === 'code_editor' && step === 1 ? 'wide-studio' : ''}`}>
    <div className="studio-heading"><div><span className="studio-eyebrow">STUDYFORGE AI · TẠO ĐỀ</span><h1>Từ tài liệu đến bài kiểm tra</h1><p>Đúng dạng câu. Rõ lời giải. Có căn cứ để kiểm chứng.</p></div><span className="studio-mark" aria-hidden="true">✦</span></div>
    <div className={`u042${step === 3 ? ' is-last' : ''}`}>
      <ol className="u042-steps" aria-label="Các bước tạo bài kiểm tra">
        <li className="u042-line" aria-hidden="true" style={{ '--p': step / 3 } as CSSProperties}><i/></li>
        {['Tài liệu', 'Cấu hình', 'Duyệt đề', 'Hoàn tất'].map((name, i) => <li key={name} className={`u042-st${i === step ? ' cur' : i < step ? ' done' : ''}`}><button type="button" className="u042-dot" disabled={busy || step === 3 || i >= step || !!savedId} tabIndex={i < step ? 0 : -1} aria-current={i === step ? 'step' : undefined} aria-label={`Bước ${i + 1}: ${name}${i < step ? ', quay lại' : ''}`} onClick={() => move(i)}><span>{i + 1}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.4"/></svg></button><small>{name}</small></li>)}
      </ol>
      {error && <div className="studio-error" role="alert">{error}{step === 0 && <div><button type="button" className="studio-back" onClick={() => window.location.reload()}>Thử tải lại tài liệu</button></div>}{savedId && <p>Đề nháp đã được lưu. Bạn có thể thử xuất bản lại.</p>}</div>}
      <div className="u042-view"><section className="u042-pane on" ref={pane}>
        <h2 ref={heading} tabIndex={-1}>{['Chọn tài liệu gốc', 'Thiết kế bài kiểm tra của bạn', 'Kiểm tra trước khi xuất bản', 'Bài kiểm tra đã sẵn sàng'][step]}</h2>

        {/* BƯỚC 0: CHỌN TÀI LIỆU GỐC HOẶC SOẠN TRỰC TIẾP */}
        {step === 0 && <>
          <p>Chọn tài liệu từ thư viện hoặc chuyển ngay sang chế độ soạn đề trực tiếp bằng mã.</p>
          {docsLoading ? <p role="status">Đang tải thư viện…</p> : documents.length === 0 ? !error && <div className="studio-empty"><b>Thư viện của bạn chưa có tài liệu</b><p>Bạn có thể tải tài liệu lên hoặc soạn trực tiếp bằng mã đề.</p><div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}><Link href="/documents" className="sf-btn sf-btn-primary sf-btn-sm">Tải tài liệu lên →</Link><button type="button" className="code-studio-btn code-studio-btn-primary" onClick={() => { setMode('code_editor'); move(1); }}>⚡ Soạn đề trực tiếp bằng mã</button></div></div> : <>
            <label className="studio-label" htmlFor="source-document">Tài liệu trong thư viện</label>
            <select id="source-document" className="studio-input" value={documentId} onChange={event => { const id = event.target.value; setDocumentId(id); setTitle(`Bài kiểm tra: ${documents.find(d => d.id === id)?.title ?? ''}`.slice(0, 200)); setError(''); }}>
              <option value="" disabled>Chọn tài liệu</option>
              {documents.map(d => <option key={d.id} value={d.id} disabled={d.status !== 'ready'}>{d.title} · {d.fileType.toUpperCase()}{d.status !== 'ready' ? ' · Chưa sẵn sàng' : ''}</option>)}
            </select>
            <div className="studio-analysis" aria-live="polite">
              <b>{analysisLoading ? 'Đang nhận diện cấu trúc…' : analysis?.total ? `Nhận diện ${analysis.total} câu / nhận định trong tài liệu` : 'Tài liệu kiến thức hoặc chưa nhận diện được câu có sẵn'}</b>
              <p>Hệ thống hỗ trợ đọc đề, tách phần trắc nghiệm, đúng/sai, điền từ và trả lời ngắn.</p>
              {analysis && <div className="studio-tags">{typeInfo.filter(item => analysis.counts[item.type] > 0).map(item => <span key={item.type}>{item.title}: {analysis.counts[item.type]}</span>)}</div>}
            </div>
          </>}
          <div className="u042-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="code-studio-btn" onClick={() => { setMode('code_editor'); move(1); }}>
              ⚡ Soạn đề bằng mã (không cần tài liệu) →
            </button>
            <button className="u042-b u042-next" disabled={!ready || analysisLoading || docsLoading} onClick={() => move(1)}>Tiếp tục cấu hình →</button>
          </div>
        </>}

        {/* BƯỚC 1: THIẾT KẾ BÀI KIỂM TRA (2 CHẾ ĐỘ) */}
        {step === 1 && <div>
          <p>Lựa chọn 1 trong 2 chế độ thiết kế bài kiểm tra phù hợp với nhu cầu của bạn:</p>

          <div style={{ marginBottom: 20 }}>
            <span className="studio-label" style={{ marginTop: 0 }}>Chế độ tạo bài kiểm tra</span>
            <ModeCards value={mode} onChange={setMode}/>
          </div>

          {/* DẠNG 1: DÙNG AI PHÂN TÍCH ĐÁNH GIÁ VÀ TỰ ĐỘNG GIẢI ĐÁP ÁN */}
          {mode === 'ai_analyze' && (
            <form onSubmit={event => { event.preventDefault(); void generate(); }}>
              <fieldset disabled={busy} className="studio-fieldset">
                <label className="studio-label" htmlFor="quiz-title">Tiêu đề bài kiểm tra</label>
                <input id="quiz-title" className="studio-input" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/>

                <fieldset className="studio-types">
                  <legend className="studio-label">Các dạng câu hỏi cần phân tích</legend>
                  <div className="studio-type-grid">
                    {typeInfo.map(item => (
                      <label key={item.type} className={`studio-type${types.includes(item.type) ? ' selected' : ''}`}>
                        <input type="checkbox" checked={types.includes(item.type)} onChange={() => setTypes(current => current.includes(item.type) ? current.filter(type => type !== item.type) : typeInfo.filter(info => [...current, item.type].includes(info.type)).map(info => info.type))}/>
                        <span className="studio-type-icon" aria-hidden="true">{item.icon}</span>
                        <b>{item.title}</b>
                        <small>{item.hint}</small>
                        {analysis?.counts[item.type] !== undefined && <em>{analysis.counts[item.type]} câu phát hiện</em>}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="studio-grid">
                  <label className="studio-label">
                    Số câu hỏi cần tạo
                    <input className="studio-input" type="number" min={1} max={100} required value={count || ''} onChange={event => setCount(Number(event.target.value))}/>
                  </label>
                  <label className="studio-label">
                    Thời gian làm bài (phút)
                    <input className="studio-input" type="number" min={1} max={1440} required value={minutes || ''} onChange={event => setMinutes(Number(event.target.value))}/>
                  </label>
                </div>

                <label className="studio-label" htmlFor="difficulty">Mức độ phân bố đề</label>
                <select id="difficulty" className="studio-input" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
                  <option value="balanced">Cân bằng · 40% nhận biết / 40% thông hiểu / 20% vận dụng</option>
                  <option value="foundation">Củng cố · 60% nhận biết / 30% thông hiểu / 10% vận dụng</option>
                  <option value="challenge">Thử thách · 20% nhận biết / 30% thông hiểu / 50% vận dụng</option>
                </select>

                <div className="studio-analysis">
                  <b>🧠 Cơ chế tự động giải thông minh</b>
                  <p>Hệ thống sẽ rà soát toàn bộ tài liệu đã chọn. Nếu câu hỏi đã có sẵn đáp án thì giữ nguyên căn cứ; nếu <b>chưa có đáp án</b>, AI sẽ tự động giải đáp án, nêu rõ bước giải chi tiết và trích dẫn trang tài liệu liên quan.</p>
                </div>
              </fieldset>

              {busy && (
                <div className="studio-working" role="status">
                  <span aria-hidden="true"/>
                  <div>
                    <b>{progress?.completed ?? 0}/{progress?.total ?? count} câu đã phân tích xong · {elapsed}s</b>
                    <div>AI đang đánh giá dạng câu và tự động giải các đáp án còn thiếu...</div>
                    <progress aria-label="Tiến độ tạo đề" value={progress?.completed ?? 0} max={progress?.total || count}/>
                    <button type="button" className="studio-back" onClick={() => generationAbort.current?.abort()}>Dừng và giữ tiến độ</button>
                  </div>
                </div>
              )}

              <div className="u042-foot">
                <button type="button" className="u042-b u042-prev" disabled={busy} onClick={() => move(0)}>Quay lại</button>
                <button className="u042-b u042-next" type="submit" disabled={!valid || busy}>
                  {busy ? 'Đang phân tích & giải…' : error ? 'Thử tạo lại →' : '✦ Bắt đầu phân tích & tạo đề'}
                </button>
              </div>
            </form>
          )}

          {/* DẠNG 2: SOẠN ĐỀ BẰNG MÃ VÀ GẮN ĐÁP ÁN TRỰC QUAN (ẢNH 2 - KIỂU AZOTA) */}
          {mode === 'code_editor' && (
            <div style={{ marginTop: 12 }}>
              <CodeExamStudio
                documentText={docRawText}
                documentTitle={documents.find(d => d.id === documentId)?.title}
                title={title}
                setTitle={setTitle}
                minutes={minutes}
                setMinutes={setMinutes}
                onApply={(appliedQuestions) => {
                  setQuestions(appliedQuestions);
                  setSavedId('');
                  requestId.current = crypto.randomUUID();
                  setSaveNotice('');
                  setReviewPage(0);
                  setFilter('all');
                  move(2);
                }}
                onBack={() => move(0)}
              />
            </div>
          )}
        </div>}

        {/* BƯỚC 2: DUYỆT ĐỀ VÀ KIỂM TRA LẦN CUỐI */}
        {step === 2 && <>
          <p>{questions.length} câu · {minutes} phút · Đã duyệt {reviewed}/{questions.length}. Kiểm tra cả đáp án và lời giải của từng câu.</p>
          {warnings.map(warning => <div className="studio-analysis" role="status" key={warning}>{warning}</div>)}
          <div className="studio-filters" role="group" aria-label="Lọc dạng câu"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả ({questions.length})</button>{typeInfo.filter(item => questions.some(q => q.type === item.type)).map(item => <button key={item.type} aria-pressed={filter === item.type} onClick={() => setFilter(item.type)}>{item.title} ({questions.filter(q => q.type === item.type).length})</button>)}</div>
          {saveNotice && <p role="status">{saveNotice}</p>}
          {questions.filter(q => filter === 'all' || q.type === filter).slice(reviewPage * 10, reviewPage * 10 + 10).map((q, i) => <article className="studio-question studio-review-card" key={q.id}>
            <div className="studio-question-top"><b>Câu {reviewPage * 10 + i + 1} · {label(q.type)}</b><span>{q.answerOrigin === 'document' ? q.explanation.includes('Lời giải trong tài liệu:') ? 'Đáp án và lời giải gốc' : 'Đáp án gốc · Lời giải do AI đề xuất' : q.answerOrigin === 'teacher' ? 'Đáp án biên soạn trực tiếp' : 'AI đề xuất · Cần kiểm tra'}</span></div>
            <h3>{q.stem}</h3><div className="studio-options">{q.options.map((option, i) => <div className={q.correctOptionIds.includes(option.id) ? 'correct' : ''} key={option.id}><b>{q.type === 'boolean' ? '' : `${String.fromCharCode(65 + i)}. `}</b>{option.text}{q.correctOptionIds.includes(option.id) && <strong> ✓</strong>}</div>)}</div>
            {q.acceptedAnswers.length > 0 && <div className="studio-text-answer"><b>Đáp án chấp nhận: </b>{q.acceptedAnswers.join(' / ')}</div>}
            <details className="studio-solution" open><summary>Lời giải chi tiết</summary><p>{q.explanation}</p>{q.sourceRefs.length > 0 && <><b>Căn cứ trong tài liệu</b>{q.sourceRefs.map((ref, i) => <blockquote key={`${ref.chunkId}-${i}`}>{ref.quote}</blockquote>)}</>}</details>
            <details className="studio-editor"><summary>Chỉnh câu hỏi, đáp án và lời giải</summary><fieldset disabled={busy} className="studio-fieldset"><label className="studio-label">Nội dung câu hỏi<textarea className="studio-input" value={q.stem} onChange={event => edit(q.id, { stem: event.target.value })}/></label>
              {q.options.length > 0 ? q.options.map(option => <div className="studio-edit-option" key={option.id}><label><input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`answer-${q.id}`} checked={q.correctOptionIds.includes(option.id)} aria-label={`Đáp án đúng: ${option.text}`} onChange={() => edit(q.id, { answerOrigin: 'teacher', correctOptionIds: q.type === 'multiple' ? q.correctOptionIds.includes(option.id) ? q.correctOptionIds.filter(id => id !== option.id) : [...q.correctOptionIds, option.id] : [option.id] })}/></label><input className="studio-input" aria-label={`Phương án ${option.text}`} value={option.text} readOnly={q.type === 'boolean'} onChange={event => edit(q.id, { answerOrigin: 'teacher', options: q.options.map(o => o.id === option.id ? { ...o, text: event.target.value } : o) })}/></div>) : <label className="studio-label">Đáp án chấp nhận (mỗi dòng một cách trả lời)<textarea className="studio-input" value={q.acceptedAnswers.join('\n')} onChange={event => edit(q.id, { answerOrigin: 'teacher', acceptedAnswers: event.target.value.split('\n') })}/></label>}
              <label className="studio-label">Lời giải<textarea className="studio-input studio-explanation-input" value={q.explanation} onChange={event => edit(q.id, { explanation: event.target.value })}/></label></fieldset></details>
            <label className="studio-review"><input type="checkbox" checked={q.reviewed} disabled={busy} onChange={event => { setSaveNotice(''); setQuestions(current => current.map(item => item.id === q.id ? { ...item, reviewed: event.target.checked } : item)); }}/>Tôi đã kiểm tra câu hỏi, đáp án và lời giải</label>
          </article>)}
          {questions.filter(q => filter === 'all' || q.type === filter).length > 10 && <nav className="studio-filters" aria-label="Trang duyệt câu hỏi"><button disabled={!reviewPage} onClick={() => setReviewPage(value => value - 1)}>← Trang trước</button><span>Trang {reviewPage + 1}/{Math.ceil(questions.filter(q => filter === 'all' || q.type === filter).length / 10)}</span><button disabled={(reviewPage + 1) * 10 >= questions.filter(q => filter === 'all' || q.type === filter).length} onClick={() => setReviewPage(value => value + 1)}>Trang sau →</button></nav>}
          <div className="studio-publish"><div><b>{reviewed}/{questions.length} câu đã duyệt</b><small>Người làm bài xem lời giải sau khi nộp bài.</small></div><button className="studio-back" disabled={busy || !questions.length} onClick={() => void persist(false)}>Lưu bản nháp</button><button className="u042-b u042-next" disabled={busy || reviewed !== questions.length || !questions.length} onClick={() => void persist(true)}>{busy ? 'Đang lưu và xuất bản…' : savedId ? 'Xuất bản đề →' : 'Lưu & xuất bản →'}</button></div>
          {!savedId && <button className="studio-back" disabled={busy} onClick={() => move(1)}>← Điều chỉnh cấu hình</button>}
        </>}

        {/* BƯỚC 3: HOÀN TẤT VÀ CHIA SẺ */}
        {step === 3 && published && <div className="u042-done"><span className="u042-big" aria-hidden="true"><svg viewBox="0 0 34 34"><path d="M9 17.5l5.5 5.5L25.5 12"/></svg></span><p>Chia sẻ mã hoặc đường dẫn cho người làm bài.</p><div className="studio-share"><small>MÃ THAM GIA</small><b>{published.shareCode}</b><button onClick={async () => { try { await navigator.clipboard.writeText(published.shareUrl); setCopied(true); } catch { setError('Không sao chép được. Hãy chọn đường dẫn bên dưới.'); } }}>{copied ? 'Đã sao chép đường dẫn ✓' : 'Sao chép đường dẫn'}</button><a href={published.shareUrl}>{published.shareUrl}</a></div><div className="studio-links"><Link href={`/quizzes/take?code=${published.shareCode}`}>Làm thử bài kiểm tra →</Link><Link href="/quizzes">Về ngân hàng đề</Link></div></div>}
      </section></div>
    </div>
  </div>;
}

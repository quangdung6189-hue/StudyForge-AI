'use client';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { DocumentDTO, QuestionType } from '@studyforge/contracts';
import type { analyzeDocument } from '@/server/question-sections';
import { LucianUpload } from '@/components/lucian/LucianUpload';
import { LucianDocumentTabs } from '@/components/lucian/LucianDocumentTabs';
import './documents.css';

type Analysis = ReturnType<typeof analyzeDocument>;
type Detail = DocumentDTO & { rawText: string | null; revision: number; tools?: { layoutReader: boolean }; chunks: { id: string; chunkIndex: number; content: string; pageNumber: number | null }[]; analysis: Analysis; extraction: { warnings: string[]; method: string; pages: { number: number; characters: number }[] } | null };
const typeLabels: Record<QuestionType, string> = { single: 'Trắc nghiệm', multiple: 'Nhiều đáp án', boolean: 'Đúng / Sai', short: 'Trả lời ngắn', fill: 'Điền từ' };
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init), data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? 'Không thể đọc dữ liệu. Hãy thử lại.');
  return data;
}
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentDTO[]>([]), [doc, setDoc] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true), [reading, setReading] = useState(false), [saving, setSaving] = useState(false);
  const [rawText, setRawText] = useState(''), [active, setActive] = useState('questions'), [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [libSearch, setLibSearch] = useState('');
  const [questionPage, setQuestionPage] = useState(0);
  const deferredSearch = useDeferredValue(search);
  const detailAbort = useRef<AbortController | null>(null), docRef = useRef<Detail | null>(null);
  const dirty = Boolean(doc && rawText !== (doc.rawText ?? ''));
  async function open(id: string) {
    detailAbort.current?.abort(); const abort = new AbortController(); detailAbort.current = abort; setError(''); setNotice(''); setReading(true);
    try { const data = await request<Detail>(`/api/documents/${id}`, { signal: abort.signal }); setDoc(data); docRef.current = data; setRawText(data.rawText ?? ''); setFilter('all'); setSearch(''); }
    catch (err) { if (!abort.signal.aborted) setError((err as Error).message); }
    finally { if (!abort.signal.aborted) setReading(false); }
  }
  async function refresh(preferred?: string) {
    setLoading(true); setError('');
    try { const data = await request<{ items: DocumentDTO[] }>('/api/documents?limit=100'); setDocuments(data.items); const id = preferred ?? docRef.current?.id ?? data.items[0]?.id; if (id) await open(id); }
    catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); return () => detailAbort.current?.abort(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  async function save() {
    if (!doc) return; setSaving(true); setError('');
    try { await request(`/api/documents/${doc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawText, revision: doc.revision }) }); await open(doc.id); setNotice('Đã lưu và phân loại lại câu hỏi từ văn bản mới.'); }
    catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  }
  async function importPasted() {
    if (!doc || dirty) return; setReading(true); setError('');
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setNotice('Clipboard trống — hãy copy đề kiểu Azota rồi bấm lại.'); return; }
      const seed = text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
      const tail = seed.split('\n').map((line) => (/^(?:Câu\s+\d+|[A-Da-d][.)]|\[lb:[^\]]+\])/u.test(line.trim()) ? line : null)).filter(Boolean).length;
      const merged = tail >= 3 ? `${rawText.trim()}\n\n${seed}`.trim() : seed;
      setRawText(merged);
      setNotice(`Đã dán nhanh ${seed.length} ký tự kiểu Azota vào Văn bản — bấm “Lưu & phân loại lại”.`);
      setActive('text');
    } catch { setNotice('Không đọc được clipboard — hãy paste thủ công vào tab Văn bản.'); }
    finally { setReading(false); }
  }
  async function reprocess(vision: boolean, engine: 'native' | 'docling' = 'native') {
    if (!doc || dirty) return; setReading(true); setError(''); setNotice(vision ? 'Đang đọc nâng cao/OCR bằng Flash High…' : 'Đang đọc lại cấu trúc file gốc…');
    try {
      const result = await request<{ applied: boolean; candidateText?: string; warnings: string[] }>(`/api/documents/${doc.id}/reprocess`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vision, engine }) });
      if (result.applied) { await refresh(doc.id); setNotice(['Đã đọc lại và phân loại lại tài liệu.', ...result.warnings].join(' ')); }
      else { if (result.candidateText) { setRawText(result.candidateText); setActive('text'); } setNotice(result.warnings.join(' ')); }
    } catch (err) { setError((err as Error).message); } finally { setReading(false); }
  }
  const analysis = doc?.analysis;
  const normalizedSearch = deferredSearch.toLocaleLowerCase('vi');
  const libQuery = libSearch.toLocaleLowerCase('vi');
  const visibleDocs = documents.filter((d) => !libQuery || d.title.toLocaleLowerCase('vi').includes(libQuery));
  const questions = analysis?.questions.filter(q => (filter === 'all' || filter === q.type) && q.stem.toLocaleLowerCase('vi').includes(normalizedSearch)) ?? [];
  const unsupported = (filter === 'all' || filter === 'unsupported') ? analysis?.unsupported.filter(q => q.stem.toLocaleLowerCase('vi').includes(normalizedSearch)) ?? [] : [];
  const rows = [...questions, ...unsupported], visibleKeys = new Set(rows.slice(questionPage * 20, questionPage * 20 + 20).map(q => q.key));
  useEffect(() => setQuestionPage(0), [filter, deferredSearch, doc?.id]);
  return <div className="ux documents-studio">
    <div className="documents-heading"><span>TÀI LIỆU HỌC TẬP</span><h1>Đọc rõ tài liệu, học đúng trọng tâm</h1><p>Đối chiếu bản gốc, xem từng dạng câu hỏi và kiểm tra đáp án trước khi tạo đề.</p></div>
    <LucianUpload onUploadSuccess={docs => void refresh(docs[0]?.id)}/>
    {error && <div className="documents-error" role="alert">{error}<button onClick={() => void refresh()}>Thử tải lại</button></div>}
    {notice && <div className="documents-notice" role="status">{notice}</div>}
    <div className="documents-layout"><aside className="documents-list" aria-label="Thư viện tài liệu"><div className="documents-list-head"><p className="documents-list-title">Thư viện <span className="documents-count">{visibleDocs.length}</span></p></div><div className="documents-search"><input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Tìm tài liệu…" aria-label="Tìm tài liệu" /></div>{loading && <p role="status">Đang tải tài liệu…</p>}{!loading && !documents.length && !error && <p>Thêm tài liệu đầu tiên ở phía trên.</p>}{visibleDocs.map(item => <button className={`documents-file${doc?.id === item.id ? ' selected' : ''}`} key={item.id} disabled={reading || saving} onClick={() => { if (!dirty || window.confirm('Bỏ thay đổi văn bản chưa lưu để mở tài liệu khác?')) { setActive('questions'); void open(item.id); } }}><span className="documents-file-ic" style={{ background: item.fileType.includes('pdf') ? '#E5484D' : item.fileType.includes('word') ? '#2B579A' : item.fileType.includes('image') ? '#10B981' : '#3D8BFF' }} aria-hidden="true">{item.fileType.includes('pdf') ? 'PDF' : item.fileType.includes('word') ? 'DOCX' : item.fileType.includes('image') ? 'IMG' : 'TXT'}</span><span><b>{item.title}</b><small><span className="documents-dot" style={{ background: item.status === 'ready' ? '#10B981' : item.status === 'extracting' ? '#F59E0B' : '#E5484D' }} />{item.status === 'ready' ? 'Đã đọc' : item.status === 'extracting' ? 'Đang đọc' : 'Cần kiểm tra / OCR'}</small></span></button>)}</aside>
    <section className="documents-reader" aria-busy={reading}>{doc ? <>
      <div className="documents-reader-heading"><div><h2>{doc.title}</h2><p>{analysis?.pages ?? 1} trang · {analysis?.sourceGroups ?? 0} câu gốc · {analysis?.total ?? 0} câu / nhận định có thể chấm</p></div><Link className="documents-primary" aria-disabled={doc.status !== 'ready' || dirty} href={doc.status === 'ready' && !dirty ? `/quizzes/create?docId=${doc.id}` : '#'} onClick={event => { if (doc.status !== 'ready' || dirty) event.preventDefault(); }}>Tạo đề AI →</Link></div>
      <div className="documents-stats" role="list">{Object.entries(typeLabels).map(([type, title]) => <div className="documents-stat" role="listitem" key={type}><b>{analysis?.counts[type as QuestionType] ?? 0}</b><span>{title}</span></div>)}</div>
      <p className="documents-hint">Đọc lại sẽ cập nhật phần chữ từ file gốc. Với ảnh hoặc bố cục khó, dùng OCR và đối chiếu chỗ chưa rõ. {dirty && <b>Có thay đổi chưa lưu — hãy lưu trước khi tạo đề.</b>}</p>
      {(() => {
        const seen = new Set<string>();
        const shortCount = new Map<string, number>();
        for (const w of [...(doc.extraction?.warnings ?? []), ...(analysis?.warnings ?? [])]) {
          const m = w.match(/^Câu (\d+): chưa đọc đủ phương án/);
          if (m) shortCount.set(m[1], (shortCount.get(m[1]) ?? 0) + 1);
        }
        const rows: string[] = [];
        for (const w of [...(doc.extraction?.warnings ?? []), ...(analysis?.warnings ?? []), ...(doc.status !== 'ready' ? ['Tài liệu còn chỗ cần kiểm tra/OCR; chưa cho tạo đề từ nội dung chưa hoàn tất.'] : [])]) {
          const m = w.match(/^Câu (\d+): chưa đọc đủ phương án/);
          const key = m ? `short-${m[1]}` : w;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push(m ? `Câu ${m[1]}: chưa đọc đủ phương án (${shortCount.get(m[1]) ?? 1} cảnh báo) — kiểm tra bố cục cột A/B/C/D.` : w);
        }
        if (!rows.length) return null;
        return <div className="documents-alerts" role="status" aria-label="Cảnh báo đối chiếu"><div className="documents-alerts-head"><b>{rows.length} điểm cần đối chiếu</b><span>DOCX/scan giữ nguyên cảnh báo, không tự đoán</span></div><ul>{rows.map((w) => <li className="documents-warning" key={w}><span>{w}</span></li>)}</ul></div>;
      })()}
      <p className="documents-tools"><a href={`/api/documents/${doc.id}/export?format=json`}>Xuất cấu trúc JSON</a><a href={`/api/documents/${doc.id}/export?format=csv`}>CSV câu hỏi</a><a href={`/api/documents/${doc.id}/export?format=md`}>Văn bản Markdown</a></p>
      <div className="documents-toolbar"><span className="t-label">ĐỌC FILE</span><button className="documents-toolbtn" disabled={reading || saving || dirty} onClick={() => void reprocess(false, 'native')}>Đọc lại file gốc</button><button className="documents-toolbtn primary" disabled={reading || saving || dirty} onClick={() => void reprocess(true, 'native')}>Đọc nâng cao / OCR</button><button className="documents-toolbtn" disabled={reading || saving} onClick={() => void importPasted()}>Dán nhanh kiểu Azota</button>{doc.tools?.layoutReader && <button className="documents-toolbtn" disabled={reading || saving || dirty} onClick={() => void reprocess(false, 'docling')}>Đọc bố cục phức tạp</button>}<a className="documents-toolbtn" href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">Mở bản gốc ↗</a></div>
      <LucianDocumentTabs active={active} onChange={setActive}>
        {active === 'questions' && <><div className="documents-filter"><label>Tìm câu hỏi<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo nội dung…"/></label><label>Dạng câu<select aria-label="Dạng câu" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả ({analysis?.total ?? 0})</option>{Object.entries(typeLabels).map(([type, title]) => <option key={type} value={type}>{title} ({analysis?.counts[type as QuestionType] ?? 0})</option>)}<option value="unsupported">Cần duyệt dạng ({analysis?.unsupported.length ?? 0})</option></select></label></div>
          {filter !== 'unsupported' && questions.filter(q => visibleKeys.has(q.key)).map(q => <article className="u039-row documents-question" key={q.key}><div className="documents-question-meta"><span className="documents-qpill">{typeLabels[q.type]}</span><span>Trang {q.pageNumber} · Câu gốc {q.number}</span></div><h3>{q.stem}</h3>{q.options.map((option, i) => <div key={i} className={`documents-option${q.documentAnswer?.indices.includes(i) ? ' correct' : ''}`}>{q.type !== 'boolean' && <b>{String.fromCharCode(65 + i)}. </b>}{option}{q.documentAnswer?.indices.includes(i) && <strong> ✓ Đáp án gốc</strong>}</div>)}{q.documentAnswer?.acceptedAnswers.length ? <p><b>Đáp án gốc: </b>{q.documentAnswer.acceptedAnswers.join(' / ')}</p> : null}{!q.documentAnswer && <p className="documents-hint">Tài liệu chưa chỉ rõ đáp án. Khi tạo đề, câu trả lời của AI sẽ được đánh dấu cần duyệt.</p>}{q.warnings?.map(warning => <div className="documents-warning" key={warning}>{warning}</div>)}{q.sourceExplanation && <details><summary>Lời giải / ghi chú trong tài liệu</summary><p className="documents-preserve">{q.sourceExplanation}</p></details>}</article>)}
          {(filter === 'all' || filter === 'unsupported') && unsupported.filter(q => visibleKeys.has(q.key)).map(q => <article className="u039-row documents-question" key={q.key}><b>Cần duyệt dạng · Trang {q.pageNumber}</b><h3>{q.stem}</h3><p>{q.reason}</p></article>)}
          {filter !== 'unsupported' && !questions.length && <div className="documents-empty">Chưa có câu phù hợp. Xem văn bản hoặc bản gốc để kiểm tra bố cục; bạn vẫn có thể dùng AI tạo câu mới từ kiến thức đã đọc.</div>}
        </>}
        {active === 'text' && <div className="u039-row documents-text"><div className="documents-text-top"><label htmlFor="document-text">Văn bản theo thứ tự trang</label><button disabled={!dirty || reading || saving} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu & phân loại lại'}</button></div><textarea id="document-text" value={rawText} onChange={event => setRawText(event.target.value)} spellCheck={false}/><p className="documents-hint">Giữ tiêu đề PHẦN I/II/III, số Câu, nhãn A/B/C/D và dấu đáp án. Không thêm đáp án nếu bản gốc chưa ghi.</p></div>}
        {active === 'original' && <div className="u039-row documents-original"><p>File được lưu riêng tư và chỉ mở bằng phiên đăng nhập của chủ tài liệu.</p>{doc.fileType === 'application/pdf' ? <iframe title="Bản PDF gốc" src={`/api/documents/${doc.id}/file`}/> : doc.fileType.startsWith('image/') ? <img alt="Tài liệu gốc để đối chiếu" src={`/api/documents/${doc.id}/file`}/> : <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer">Mở hoặc tải file gốc để đối chiếu ↗</a>}</div>}
        {active === 'questions' && rows.length > 20 && <nav className="documents-tools" aria-label="Trang câu hỏi tài liệu"><button disabled={!questionPage} onClick={() => setQuestionPage(value => value - 1)}>← Trang trước</button><span>Trang {questionPage + 1}/{Math.ceil(rows.length / 20)}</span><button disabled={(questionPage + 1) * 20 >= rows.length} onClick={() => setQuestionPage(value => value + 1)}>Trang sau →</button></nav>}
      </LucianDocumentTabs>
    </> : <div className="documents-empty">Chọn tài liệu từ thư viện hoặc tải file mới để bắt đầu.</div>}</section></div>
  </div>;
}

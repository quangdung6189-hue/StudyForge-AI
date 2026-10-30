// Lucian UX/UI Prompt #215 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#215
'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import type { AssistantSource } from '@/server/assistant';
import './assistant.css';
import { prepareChatImage, type ChatImage } from './assistant-image';
type Message = { id: string; role: 'user' | 'assistant'; content: string; images?: ChatImage[]; sources?: AssistantSource[]; warnings?: string[] };
function Content({ text }: { text: string }) {
  return text.split(/(```[\s\S]*?```)/g).map((part, index) => part.startsWith('```') ? <pre key={index}><code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre> : <span key={index}>{part}</span>);
}
export function LucianAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [input, setInput] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [messages, setMessages] = useState<Message[]>([]), [documents, setDocuments] = useState<{ id: string; title: string }[]>([]), [documentId, setDocumentId] = useState(''), [lookup, setLookup] = useState(false);
  const [attached, setAttached] = useState<ChatImage[]>([]), [preparing, setPreparing] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null), preparingImages = useRef(false);
  const control = useRef<AbortController | null>(null), launcher = useRef<HTMLButtonElement>(null), field = useRef<HTMLTextAreaElement>(null), list = useRef<HTMLDivElement>(null), fetched = useRef(false), pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { control.current?.abort(); if (pending.current) clearTimeout(pending.current); }, []);
  useEffect(() => { if (pathname.startsWith('/quizzes/take')) { control.current?.abort(); setOpen(false); } }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => field.current?.focus({ preventScroll: true }), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { setOpen(false); launcher.current?.focus(); } };
    document.addEventListener('keydown', escape);
    if (!fetched.current) {
      fetched.current = true;
      fetch('/api/documents?limit=100').then(r => r.ok ? r.json() : Promise.reject()).then(data => setDocuments(data.items)).catch(() => { fetched.current = false; });
    }
    return () => { clearTimeout(timer); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    const node = list.current; if (node && node.scrollHeight - node.scrollTop - node.clientHeight < 200) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);
  function close() { setOpen(false); launcher.current?.focus(); }
  async function attach(files: File[]) {
    if (busy || preparingImages.current || !files.length) return;
    if (attached.length + files.length > 3) { setError('Mỗi lượt tối đa 3 ảnh. Hãy bỏ bớt ảnh đã chọn.'); return; }
    preparingImages.current = true; setPreparing(true); setError('');
    try {
      // Sequential preparation limits peak memory on phones with large camera photos.
      const ready: ChatImage[] = []; for (const file of files) ready.push(await prepareChatImage(file));
      setAttached(current => [...current, ...ready]);
    } catch(error) { setError((error as Error).message); }
    finally { preparingImages.current = false; setPreparing(false); }
  }
  async function send(text: string) {
    text = text.trim(); if ((!text && !attached.length) || busy || preparingImages.current) return;
    if (!text) text = 'Đọc và giải thích nội dung trong ảnh này.';
    const id = crypto.randomUUID(), abort = new AbortController(); control.current = abort;
    const history = [...messages.filter(m => m.content), { id: crypto.randomUUID(), role: 'user' as const, content: text, ...(attached.length ? { images: attached } : {}) }].slice(-12);
    let imageBudget = 3;
    const wireMessages = [...history].reverse().map(message => { const images = message.images?.slice(-imageBudget); const kept = imageBudget > 0 ? images ?? [] : []; imageBudget -= kept.length; return { role: message.role, content: message.content.slice(0,4000), ...(kept.length ? { images: kept.map(image => image.dataUrl) } : {}) }; }).reverse();
    setMessages([...history, { id, role: 'assistant', content: '' }]); setAttached([]); setInput(''); setError(''); setBusy(true); setStatus('Đang kết nối AI…');
    let content = '', sources: AssistantSource[] = [], warnings: string[] = [], finished = false;
    const commit = () => { pending.current = null; setMessages(current => current.map(m => m.id === id ? { ...m, content, sources, warnings } : m)); };
    const schedule = () => { if (!pending.current) pending.current = setTimeout(commit, 40); };
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal, body: JSON.stringify({ messages: wireMessages, ...(documentId ? { documentId } : {}), lookup }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message ?? 'Chưa kết nối được trợ lý.'); }
      const reader = response.body!.getReader(), decoder = new TextDecoder(); let buffer = '';
      const consume = (line: string) => {
        if (!line.trim()) return; const event = JSON.parse(line);
        if (event.event === 'status') setStatus(event.message);
        if (event.event === 'sources') { sources = event.sources; warnings = event.warnings; schedule(); }
        if (event.event === 'delta') { content += event.text; schedule(); }
        if (event.event === 'error') throw new Error(event.message);
        if (event.event === 'done') finished = true;
      };
      try { while (true) { const { value, done } = await reader.read(); buffer += done ? decoder.decode() : decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() ?? ''; lines.forEach(consume); if (done) break; } if (buffer.trim()) consume(buffer); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (!finished) throw new Error('Câu trả lời bị ngắt. Bạn có thể gửi lại câu hỏi.');
    } catch(err) { setError(abort.signal.aborted ? 'Đã dừng trả lời.' : (err as Error).message); }
    finally { if (pending.current) clearTimeout(pending.current); commit(); control.current = null; setBusy(false); setStatus(''); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  if (pathname.startsWith('/quizzes/take')) return null;
  return <div className={`ux u215 studyforge-assistant${process.env.NODE_ENV === 'development' ? ' assistant-dev' : ''}${open ? ' is-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); close(); } }}>
    <section className="u215-wg" id="studyforge-assistant" role="dialog" aria-label="Trợ lý StudyForge AI" aria-hidden={!open} inert={!open} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); void attach(Array.from(event.dataTransfer.files)); } }}>
      <header className="u215-wh"><div className="u215-fs" aria-hidden="true"><i>SF</i></div><b>Trợ lý StudyForge AI</b><small>9Router · Flash High</small><button className="assistant-clear" disabled={busy || preparing || (!messages.length && !attached.length)} onClick={() => { setMessages([]); setAttached([]); setError(''); field.current?.focus(); }}>Cuộc trò chuyện mới</button></header>
      <div className="assistant-context"><label>Tài liệu tham khảo<select aria-label="Tài liệu cho trợ lý" value={documentId} disabled={busy} onChange={event => setDocumentId(event.target.value)}><option value="">Hướng dẫn & kiến thức chung</option>{documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></label><label className="assistant-lookup"><input type="checkbox" checked={lookup} disabled={busy} onChange={event => setLookup(event.target.checked)}/>Tra cứu Wikipedia kèm nguồn</label></div>
      <div className="u215-ms" ref={list} role="log" aria-label="Lịch sử trò chuyện" aria-live="off" tabIndex={0}>
        {!messages.length && <div className="u215-b bt">Bạn có thể hỏi cách đọc tài liệu, tạo và duyệt đề, nhờ giải thích kiến thức hoặc viết mã mẫu. Chọn tài liệu ở trên để hỏi theo nội dung của bạn.</div>}
        {messages.map(message => message.content || message.warnings?.length ? <article key={message.id} className={`u215-b ${message.role === 'user' ? 'me' : 'bt'}`} aria-label={message.role === 'user' ? 'Bạn' : 'Trợ lý'}><div className="assistant-message-images">{message.images?.map((image, index) => <img key={index} src={image.dataUrl} alt={image.name}/>)}</div><Content text={message.content}/>{message.warnings?.map(warning => <small className="assistant-warning" key={warning}>{warning}</small>)}{message.sources?.length ? <details className="assistant-sources"><summary>Nguồn tham khảo ({message.sources.length})</summary>{message.sources.map(source => <div key={source.id}><b>[{source.id}] {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</b><p>{source.quote}</p></div>)}</details> : null}{message.role === 'assistant' && message.content && <button className="assistant-copy" onClick={() => navigator.clipboard.writeText(message.content).catch(() => setError('Không sao chép được. Hãy chọn nội dung để chép.'))}>Sao chép</button>}</article> : null)}
        {busy && <div className="u215-ty" aria-hidden="true"><i/><i/><i/></div>}
      </div>
      <div className="assistant-status" role="status" aria-live="polite">{busy ? status || 'Đang trả lời…' : messages.length ? 'AI có thể sai. Hãy kiểm chứng nội dung quan trọng.' : 'Không tự lưu hội thoại khi tải lại trang.'}</div>
      {error && <div className="assistant-error" role="alert">{error}</div>}
      {!messages.length && <div className="u215-qs">{['Hướng dẫn tạo đề', 'Cách lưu và duyệt đề', 'Ví dụ code tạo câu hỏi'].map(question => <button type="button" className="u215-qk" key={question} disabled={busy} onClick={() => void send(question)}>{question}</button>)}</div>}
      {(attached.length > 0 || preparing) && <div className="assistant-attachments" aria-label="Ảnh đính kèm">{attached.map((image,index) => <div key={index}><img src={image.dataUrl} alt={image.name}/><button type="button" disabled={busy || preparing} aria-label={`Bỏ ảnh ${image.name}`} onClick={() => setAttached(current => current.filter((_,i) => i !== index))}>×</button></div>)}{preparing && <span role="status">Đang chuẩn bị ảnh…</span>}</div>}
      <div className="assistant-image-hint">Chọn, kéo thả hoặc Ctrl+V ảnh · PNG/JPG/WebP · tối đa 3 ảnh, 8MB/ảnh</div>
      <form className="u215-ip" onSubmit={submit}>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden aria-label="Chọn ảnh cho trợ lý" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void attach(files); }}/>
        <button type="button" className="assistant-attach" disabled={busy || preparing || attached.length >= 3} aria-label="Đính kèm ảnh" title="Chọn ảnh hoặc dán ảnh bằng Ctrl+V" onClick={() => imageInput.current?.click()}>＋</button>
        <textarea ref={field} aria-label="Tin nhắn cho trợ lý" placeholder="Hỏi hoặc dán ảnh vào đây…" rows={2} maxLength={4000} value={input} onChange={event => setInput(event.target.value)} onPaste={event => { const files = Array.from(event.clipboardData?.files ?? []); if (files.length) { event.preventDefault(); void attach(files); } }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void send(input); } }}/>
        {busy ? <button type="button" onClick={() => control.current?.abort()}>Dừng</button> : <button type="submit" disabled={preparing || (!input.trim() && !attached.length)}>Gửi</button>}
      </form>
    </section>
    <button type="button" className="u215-ln" ref={launcher} aria-controls="studyforge-assistant" aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'} aria-expanded={open} onClick={() => open ? close() : setOpen(true)}><svg className="c" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5H10l-5 3.5V16H4z" fill="currentColor"/></svg><svg className="x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg></button>
  </div>;
}

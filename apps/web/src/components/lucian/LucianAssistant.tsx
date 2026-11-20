// Lucian UX/UI Prompt #215 · UI/UX Pro Max Optimized
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import type { AssistantSource } from '@/server/assistant';
import './assistant.css';
import { prepareChatImage, type ChatImage } from './assistant-image';
import { motion, useReducedMotion } from 'motion/react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
  sources?: AssistantSource[];
  warnings?: string[];
};

function Content({ text }: { text: string }) {
  return text.split(/(```[\s\S]*?```)/g).map((part, index) =>
    part.startsWith('```') ? (
      <pre key={index}>
        <code>{part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code>
      </pre>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export function LucianAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [lookup, setLookup] = useState(false);
  const [attached, setAttached] = useState<ChatImage[]>([]);
  const [preparing, setPreparing] = useState(false);

  const reducedMotion = useReducedMotion();
  const imageInput = useRef<HTMLInputElement>(null);
  const preparingImages = useRef(false);
  const control = useRef<AbortController | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const fetched = useRef(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    control.current?.abort();
    if (pending.current) clearTimeout(pending.current);
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/quizzes/take')) {
      control.current?.abort();
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(
      () => field.current?.focus({ preventScroll: true }),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
    );
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setOpen(false);
        launcher.current?.focus();
      }
    };
    document.addEventListener('keydown', escape);
    if (!fetched.current) {
      fetched.current = true;
      fetch('/api/documents?limit=100')
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(data => setDocuments(data.items))
        .catch(() => {
          fetched.current = false;
        });
    }
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  useEffect(() => {
    const node = list.current;
    if (node && node.scrollHeight - node.scrollTop - node.clientHeight < 200) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, busy]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  async function attach(files: File[]) {
    if (busy || preparingImages.current || !files.length) return;
    if (attached.length + files.length > 3) {
      setError('Mỗi lượt tối đa 3 ảnh. Hãy bỏ bớt ảnh đã chọn.');
      return;
    }
    preparingImages.current = true;
    setPreparing(true);
    setError('');
    try {
      const ready: ChatImage[] = [];
      for (const file of files) {
        ready.push(await prepareChatImage(file));
      }
      setAttached(current => [...current, ...ready]);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      preparingImages.current = false;
      setPreparing(false);
    }
  }

  async function send(text: string) {
    text = text.trim();
    if ((!text && !attached.length) || busy || preparingImages.current) return;
    if (!text) text = 'Đọc và giải thích nội dung trong ảnh này.';
    const id = crypto.randomUUID();
    const abort = new AbortController();
    control.current = abort;

    const history = [
      ...messages.filter(m => m.content),
      {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: text,
        ...(attached.length ? { images: attached } : {}),
      },
    ].slice(-12);

    let imageBudget = 3;
    const wireMessages = [...history]
      .reverse()
      .map(message => {
        const images = message.images?.slice(-imageBudget);
        const kept = imageBudget > 0 ? images ?? [] : [];
        imageBudget -= kept.length;
        return {
          role: message.role,
          content: message.content.slice(0, 4000),
          ...(kept.length ? { images: kept.map(image => image.dataUrl) } : {}),
        };
      })
      .reverse();

    setMessages([...history, { id, role: 'assistant', content: '' }]);
    setAttached([]);
    setInput('');
    setError('');
    setBusy(true);
    setStatus('Đang kết nối AI…');

    let content = '',
      sources: AssistantSource[] = [],
      warnings: string[] = [],
      finished = false;

    const commit = () => {
      pending.current = null;
      setMessages(current =>
        current.map(m =>
          m.id === id ? { ...m, content, sources, warnings } : m
        )
      );
    };

    const schedule = () => {
      if (!pending.current) pending.current = setTimeout(commit, 40);
    };

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          messages: wireMessages,
          ...(documentId ? { documentId } : {}),
          lookup,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message ?? 'Chưa kết nối được trợ lý.');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.event === 'status') setStatus(event.message);
        if (event.event === 'sources') {
          sources = event.sources;
          warnings = event.warnings;
          schedule();
        }
        if (event.event === 'delta') {
          content += event.text;
          schedule();
        }
        if (event.event === 'error') throw new Error(event.message);
        if (event.event === 'done') finished = true;
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          lines.forEach(consume);
          if (done) break;
        }
        if (buffer.trim()) consume(buffer);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }

      if (!finished) throw new Error('Câu trả lời bị ngắt. Bạn có thể gửi lại câu hỏi.');
    } catch (err) {
      setError(abort.signal.aborted ? 'Đã dừng trả lời.' : (err as Error).message);
    } finally {
      if (pending.current) clearTimeout(pending.current);
      commit();
      control.current = null;
      setBusy(false);
      setStatus('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => {
        setError('Không sao chép được. Hãy chọn nội dung để chép.');
      });
  }

  if (pathname.startsWith('/quizzes/take')) return null;

  return (
    <div
      className={`ux studyforge-assistant${process.env.NODE_ENV === 'development' ? ' assistant-dev' : ''}${
        open ? ' is-open' : ''
      }`}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        className="assistant-scrim"
        type="button"
        aria-label="Đóng trợ lý"
        tabIndex={open ? 0 : -1}
        onClick={close}
      />

      <motion.section
        className="u215-wg"
        id="studyforge-assistant"
        role="dialog"
        aria-label="Trợ lý StudyForge AI"
        aria-hidden={!open}
        inert={!open}
        drag={!reducedMotion && open ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 420 }}
        dragElastic={{ top: 0.08, bottom: 0.22 }}
        dragMomentum={false}
        onDrag={(_, info) => {
          const progress = Math.max(0, Math.min(1, info.offset.y / 420));
          document.documentElement.style.setProperty('--assistant-drag-progress', String(progress));
        }}
        onDragEnd={(_, info) => {
          document.documentElement.style.removeProperty('--assistant-drag-progress');
          if (info.offset.y > 110 || info.velocity.y > 700) close();
        }}
        onDragOver={event => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={event => {
          if (event.dataTransfer.files.length) {
            event.preventDefault();
            void attach(Array.from(event.dataTransfer.files));
          }
        }}
      >
        {/* Header */}
        <header className="u215-wh">
          <div className="assistant-drag-handle" aria-hidden="true" />
          <div className="u215-avatar" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
              <rect x="4" y="8" width="16" height="12" rx="4" />
              <circle cx="9" cy="14" r="1.5" fill="currentColor" />
              <circle cx="15" cy="14" r="1.5" fill="currentColor" />
              <path d="M9 18h6" />
            </svg>
            <span className="u215-avatar-pulse" />
          </div>
          <div className="u215-info">
            <b>Trợ lý StudyForge AI</b>
            <small>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
              </svg>
              Google Gemini · Sẵn sàng
            </small>
          </div>
          <div className="u215-header-actions">
            <button
              type="button"
              className="assistant-clear"
              disabled={busy || preparing || (!messages.length && !attached.length)}
              onPointerDown={event => event.stopPropagation()}
              onClick={() => {
                setMessages([]);
                setAttached([]);
                setError('');
                field.current?.focus();
              }}
              title="Xóa ngữ cảnh hội thoại hiện tại"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Làm mới
            </button>
            <button
              type="button"
              className="assistant-close-btn"
              onClick={close}
              aria-label="Đóng trợ lý"
              title="Đóng (Esc)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Context toolbar */}
        <div className="assistant-context">
          <div className="assistant-select-row">
            <span className="assistant-select-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
            </span>
            <select
              aria-label="Tài liệu tham khảo cho trợ lý"
              value={documentId}
              disabled={busy}
              onChange={event => setDocumentId(event.target.value)}
            >
              <option value="">Hướng dẫn chung & Toàn bộ tài liệu</option>
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.title}
                </option>
              ))}
            </select>
          </div>
          <label className="assistant-lookup-pill">
            <input
              type="checkbox"
              checked={lookup}
              disabled={busy}
              onChange={event => setLookup(event.target.checked)}
            />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Tra cứu Wikipedia kèm nguồn
          </label>
        </div>

        {/* Conversation list */}
        <div className="u215-ms" ref={list} role="log" aria-label="Lịch sử trò chuyện" aria-live="off" tabIndex={0}>
          {!messages.length && (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                </svg>
              </div>
              <h3>Xin chào! Tôi có thể giúp gì cho bạn?</h3>
              <p>
                Hỏi đáp kiến thức, hướng dẫn tạo và duyệt đề, giải thích công thức toán hoặc phân tích tài liệu học tập của bạn.
              </p>
            </div>
          )}

          {messages.map(message =>
            message.content || message.warnings?.length ? (
              <article
                key={message.id}
                className={`u215-b ${message.role === 'user' ? 'me' : 'bt'}`}
                aria-label={message.role === 'user' ? 'Bạn' : 'Trợ lý'}
              >
                {message.images && message.images.length > 0 && (
                  <div className="assistant-message-images">
                    {message.images.map((image, index) => (
                      <img key={index} src={image.dataUrl} alt={image.name} />
                    ))}
                  </div>
                )}
                <Content text={message.content} />
                {message.warnings?.map(warning => (
                  <small className="assistant-warning" key={warning}>
                    ⚠️ {warning}
                  </small>
                ))}
                {message.sources?.length ? (
                  <details className="assistant-sources">
                    <summary>📚 Nguồn tham khảo ({message.sources.length})</summary>
                    {message.sources.map(source => (
                      <div key={source.id}>
                        <b>
                          [{source.id}]{' '}
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.title} ↗
                            </a>
                          ) : (
                            source.title
                          )}
                        </b>
                        <p>{source.quote}</p>
                      </div>
                    ))}
                  </details>
                ) : null}
                {message.role === 'assistant' && message.content && (
                  <button
                    className="assistant-copy"
                    type="button"
                    onClick={() => handleCopy(message.id, message.content)}
                  >
                    {copiedId === message.id ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Đã sao chép!
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        Sao chép
                      </>
                    )}
                  </button>
                )}
              </article>
            ) : null
          )}

          {busy && (
            <div className="u215-ty" aria-label="Đang trả lời">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>

        {/* Suggested Quick Questions when conversation is empty */}
        {!messages.length && (
          <div className="u215-qs">
            {[
              { text: 'Hướng dẫn tạo đề thi từ file', icon: '📝' },
              { text: 'Cách lưu và duyệt câu hỏi', icon: '✅' },
              { text: 'Ví dụ code tạo câu hỏi chuẩn', icon: '💻' },
              { text: 'Giải thích công thức toán trong đề', icon: '📐' },
            ].map(q => (
              <button
                type="button"
                className="u215-qk"
                key={q.text}
                disabled={busy}
                onClick={() => void send(q.text)}
              >
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Status & Error */}
        <div className="assistant-status" role="status" aria-live="polite">
          {busy
            ? status || 'Đang soạn câu trả lời…'
            : messages.length
            ? '💡 Trợ lý AI hỗ trợ giải đáp học tập. Hãy kiểm chứng nội dung quan trọng.'
            : '🔒 Hội thoại được bảo vệ trong phiên hiện tại.'}
        </div>
        {error && (
          <div className="assistant-error" role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Image Attachment Preview */}
        {(attached.length > 0 || preparing) && (
          <div className="assistant-attachments" aria-label="Ảnh đính kèm">
            {attached.map((image, index) => (
              <div key={index}>
                <img src={image.dataUrl} alt={image.name} />
                <button
                  type="button"
                  disabled={busy || preparing}
                  aria-label={`Bỏ ảnh ${image.name}`}
                  onClick={() => setAttached(current => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
            {preparing && <span role="status">Đang nén ảnh…</span>}
          </div>
        )}

        {/* Bottom Input Composer */}
        <form className="u215-ip" onSubmit={submit}>
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            aria-label="Chọn ảnh đính kèm"
            onChange={event => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              void attach(files);
            }}
          />
          <button
            type="button"
            className="assistant-attach"
            disabled={busy || preparing || attached.length >= 3}
            aria-label="Đính kèm ảnh"
            title="Đính kèm ảnh hoặc Ctrl+V dán ảnh"
            onClick={() => imageInput.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            ref={field}
            aria-label="Tin nhắn cho trợ lý"
            placeholder="Hỏi trợ lý hoặc dán ảnh vào đây..."
            rows={2}
            maxLength={4000}
            value={input}
            onChange={event => setInput(event.target.value)}
            onPaste={event => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length) {
                event.preventDefault();
                void attach(files);
              }
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!busy) void send(input);
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              className="assistant-stop-btn"
              onClick={() => control.current?.abort()}
              title="Dừng sinh câu trả lời"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Dừng
            </button>
          ) : (
            <button
              type="submit"
              className="assistant-send-btn"
              disabled={preparing || (!input.trim() && !attached.length)}
              title="Gửi câu hỏi"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              Gửi
            </button>
          )}
        </form>
      </motion.section>

      {/* Floating launcher button */}
      <button
        type="button"
        className="u215-ln"
        ref={launcher}
        aria-controls="studyforge-assistant"
        aria-label={open ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
          <rect x="4" y="8" width="16" height="12" rx="4" />
          <circle cx="9" cy="14" r="1.5" fill="currentColor" />
          <circle cx="15" cy="14" r="1.5" fill="currentColor" />
          <path d="M9 18h6" />
        </svg>
      </button>
    </div>
  );
}

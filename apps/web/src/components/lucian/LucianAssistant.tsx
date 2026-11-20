// Lucian UX/UI Prompt #215 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#215
// Ported to React / Next.js with Lucian #086 (Streaming AI Answer) and #224 (Traceable Sources)
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
      className={`ux u215 studyforge-assistant${busy ? ' is-gen' : ''}${
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
        {/* Lucian #215 Header with Avatar Stack */}
        <header className="u215-wh">
          <div className="assistant-drag-handle" aria-hidden="true" />
          <div className="u215-wh-top">
            <div className="u215-fs" aria-hidden="true">
              <i style={{ background: '#818CF8' }}>AI</i>
              <i style={{ background: '#38BDF8' }}>SF</i>
              <i style={{ background: '#34D399' }}>✨</i>
            </div>
            <div className="u215-wh-actions">
              <button
                type="button"
                className="u215-wh-btn"
                disabled={busy || preparing || (!messages.length && !attached.length)}
                onPointerDown={event => event.stopPropagation()}
                onClick={() => {
                  setMessages([]);
                  setAttached([]);
                  setError('');
                  field.current?.focus();
                }}
                title="Làm mới cuộc trò chuyện"
              >
                Làm mới
              </button>
            </div>
          </div>
          <b>Trợ lý StudyForge AI</b>
          <small>Google Gemini 2.5 · Luôn sẵn sàng hỗ trợ</small>
        </header>

        {/* Context Filters */}
        <div className="u215-ctx">
          <select
            aria-label="Tài liệu cho trợ lý"
            value={documentId}
            disabled={busy}
            onChange={event => setDocumentId(event.target.value)}
          >
            <option value="">Hướng dẫn chung & Kiến thức mở rộng</option>
            {documents.map(doc => (
              <option key={doc.id} value={doc.id}>
                📄 {doc.title}
              </option>
            ))}
          </select>
          <label className="u215-lookup">
            <input
              type="checkbox"
              checked={lookup}
              disabled={busy}
              onChange={event => setLookup(event.target.checked)}
            />
            Tra cứu Wikipedia kèm nguồn dẫn
          </label>
        </div>

        {/* Messages Feed */}
        <div className="u215-ms" ref={list} role="log" aria-label="Lịch sử trò chuyện" aria-live="off" tabIndex={0}>
          {!messages.length && (
            <div className="u215-msg-row">
              <span className="u086-av" aria-hidden="true" />
              <div className="u215-b bt">
                Xin chào! Bạn có thể hỏi cách đọc tài liệu, tạo và duyệt đề thi, nhờ giải thích kiến thức hoặc viết mã mẫu câu hỏi.
              </div>
            </div>
          )}

          {messages.map(message =>
            message.content || message.warnings?.length ? (
              <div
                key={message.id}
                className={`u215-msg-row ${message.role === 'user' ? 'me' : ''}`}
              >
                {message.role === 'assistant' && (
                  <span className="u086-av" aria-hidden="true" />
                )}
                <article
                  className={`u215-b ${message.role === 'user' ? 'me' : 'bt'}`}
                  aria-label={message.role === 'user' ? 'Bạn' : 'Trợ lý'}
                >
                  {message.images && message.images.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {message.images.map((image, index) => (
                        <img
                          key={index}
                          src={image.dataUrl}
                          alt={image.name}
                          style={{ maxWidth: 160, maxHeight: 120, borderRadius: 8, objectFit: 'contain' }}
                        />
                      ))}
                    </div>
                  )}
                  <Content text={message.content} />
                  {busy && message.role === 'assistant' && !message.content && (
                    <span className="u086-caret" aria-hidden="true" />
                  )}
                  {message.warnings?.map(warning => (
                    <small key={warning} style={{ display: 'block', marginTop: 6, color: 'var(--ux-warn)' }}>
                      ⚠️ {warning}
                    </small>
                  ))}
                  {message.sources?.length ? (
                    <details className="u224-sources">
                      <summary>Nguồn tham khảo ({message.sources.length})</summary>
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
                          <p style={{ margin: '4px 0 0', fontWeight: 400 }}>{source.quote}</p>
                        </div>
                      ))}
                    </details>
                  ) : null}
                  {message.role === 'assistant' && message.content && (
                    <button
                      className="u215-copy-btn"
                      type="button"
                      onClick={() => handleCopy(message.id, message.content)}
                    >
                      {copiedId === message.id ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  )}
                </article>
              </div>
            ) : null
          )}

          {busy && (
            <div className="u215-msg-row">
              <span className="u086-av" aria-hidden="true" />
              <div className="u215-ty" aria-label="Đang suy nghĩ">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        {/* Lucian #215 Quick Questions */}
        {!messages.length && (
          <div className="u215-qs" role="group" aria-label="Câu hỏi gợi ý">
            {['Hướng dẫn tạo đề', 'Cách lưu và duyệt đề', 'Ví dụ code tạo câu hỏi'].map(q => (
              <button
                type="button"
                className="u215-qk"
                key={q}
                disabled={busy}
                onClick={() => void send(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Status / Error */}
        <div className="u215-status" role="status" aria-live="polite">
          {busy
            ? status || 'Đang soạn câu trả lời…'
            : messages.length
            ? 'AI có thể nhầm lẫn. Hãy kiểm chứng nội dung quan trọng.'
            : 'Không tự lưu hội thoại khi tải lại trang.'}
        </div>
        {error && (
          <div className="u215-error" role="alert">
            {error}
          </div>
        )}

        {/* Attachments */}
        {(attached.length > 0 || preparing) && (
          <div className="u215-attachments" aria-label="Ảnh đính kèm">
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
            {preparing && <span style={{ fontSize: 11, color: 'var(--ux-ink-3)' }}>Đang chuẩn bị ảnh…</span>}
          </div>
        )}

        {/* Lucian #086 Composer Input Bar */}
        <form className="u215-ip" onSubmit={submit}>
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            aria-label="Chọn ảnh"
            onChange={event => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              void attach(files);
            }}
          />
          <button
            type="button"
            className="u215-attach-btn"
            disabled={busy || preparing || attached.length >= 3}
            aria-label="Đính kèm ảnh"
            title="Đính kèm ảnh (tối đa 3 ảnh) hoặc dán Ctrl+V"
            onClick={() => imageInput.current?.click()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <textarea
            ref={field}
            aria-label="Tin nhắn cho trợ lý"
            placeholder="Hỏi hoặc dán ảnh vào đây…"
            rows={1}
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
              className="u086-ctl is-stop"
              onClick={() => control.current?.abort()}
              title="Dừng câu trả lời"
            >
              <i aria-hidden="true" />
              Dừng
            </button>
          ) : (
            <button
              type="submit"
              className="u086-ctl"
              disabled={preparing || (!input.trim() && !attached.length)}
              title="Gửi câu hỏi"
            >
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <path d="M7 11.5V2.5M3 6.5l4-4 4 4" />
              </svg>
              Gửi
            </button>
          )}
        </form>
      </motion.section>

      {/* Lucian #215 Signature Rotating Launcher Button */}
      <button
        type="button"
        className="u215-ln"
        ref={launcher}
        aria-controls="studyforge-assistant"
        aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý'}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg className="c" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5h16v10.5H10l-5 3.5V16H4z" fill="currentColor" />
        </svg>
        <svg className="x" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

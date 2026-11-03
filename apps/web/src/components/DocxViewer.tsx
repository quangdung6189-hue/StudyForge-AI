'use client';

import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';

interface DocxViewerProps {
  url: string;
  zoom?: number;
  className?: string;
  onError?: (err: Error) => void;
  onSuccess?: () => void;
}

export function DocxViewer({ url, zoom = 100, className, onError, onSuccess }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadDocx() {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Máy chủ phản hồi mã ${response.status} khi tải file`);
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          await renderAsync(buffer, containerRef.current, undefined, {
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            useBase64URL: true,
            className: 'docx',
          });
        }

        if (!cancelled) {
          setLoading(false);
          onSuccess?.();
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('[DocxViewer] Rendering error:', err);
          const message = err instanceof Error ? err.message : 'Không thể giải mã file Word này';
          setError(message);
          setLoading(false);
          onError?.(err instanceof Error ? err : new Error(message));
        }
      }
    }

    void loadDocx();

    return () => {
      cancelled = true;
    };
  }, [url, onError, onSuccess]);

  return (
    <div className={`docx-viewer-shell ${className ?? ''}`}>
      {loading && (
        <div className="docx-viewer-loading">
          <div className="docx-spinner" />
          <span>Đang nạp file Word gốc (.docx)…</span>
        </div>
      )}

      {error ? (
        <div className="docx-viewer-error">
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
            Không thể giải mã trực tiếp file Word này trên trình duyệt
          </div>
          <p style={{ color: 'var(--ux-ink-3)', fontSize: '13px', maxWidth: '480px', margin: '0 0 16px', lineHeight: 1.6 }}>
            {error}. Bạn có thể tải file về máy để mở trực tiếp bằng Microsoft Word, Google Docs hoặc WPS Office.
          </p>
          <a
            href={`${url}?download=1`}
            className="documents-download-btn"
            style={{ background: 'var(--ux-accent)', color: 'white', padding: '9px 18px', borderRadius: '10px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Tải file Word gốc (.docx) về máy
          </a>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="docx-viewer-content"
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease',
          }}
        />
      )}
    </div>
  );
}


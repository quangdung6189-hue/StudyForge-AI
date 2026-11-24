'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { encode } from 'uqr';
import { useFeedback } from './Feedback';

/** QR modules as one SVG path; always dark-on-white so every phone camera can read it. */
export function QrCode({ value, size = 196, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 });
    let d = '';
    qr.data.forEach((row: boolean[], y: number) => row.forEach((on: boolean, x: number) => { if (on) d += `M${x},${y}h1v1h-1z`; }));
    return { path: d, count: qr.size };
  }, [value]);
  return (
    <svg className="sf-qr" width={size} height={size} viewBox={`0 0 ${count} ${count}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={count} height={count} fill="#FFFFFF" />
      <path d={path} fill="#0F172A" />
    </svg>
  );
}

export function ShareDialog({ code, title, onClose }: { code: string; title: string; onClose: () => void }) {
  const { toast } = useFeedback();
  const [origin, setOrigin] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const qrWrap = useRef<HTMLDivElement>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);
  const link = origin ? `${origin}/quizzes/take?code=${encodeURIComponent(code)}` : '';
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast(`Đã sao chép ${what}.`, 'success'); }
    catch { toast('Trình duyệt chặn sao chép — hãy chọn và sao chép thủ công.', 'danger'); }
  };
  const download = () => {
    const svg = qrWrap.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(svg)}`], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `ma-de-${code}.svg` });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="sf-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sf-dialog sf-share" role="dialog" aria-modal="true" aria-labelledby="sf-share-title">
        <div className="sf-share-head">
          <div>
            <span className="sf-share-kicker">CHIA SẺ PHÒNG THI</span>
            <h2 id="sf-share-title">{title}</h2>
          </div>
          <button ref={closeRef} type="button" className="sf-share-close" onClick={onClose} aria-label="Đóng">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="sf-share-body">
          <div className="sf-share-qr" ref={qrWrap}>{link ? <QrCode value={link} label={`Mã QR vào phòng thi ${code}`} /> : <div className="sf-skel" style={{ width: 196, height: 196 }} />}</div>
          <div className="sf-share-info">
            <span className="sf-share-label">Mã tham gia</span>
            <button type="button" className="sf-share-code" onClick={() => void copy(code, 'mã đề')} title="Sao chép mã">{code}</button>
            <span className="sf-share-label">Đường dẫn</span>
            <div className="sf-share-link"><input readOnly value={link} aria-label="Đường dẫn vào phòng thi" onFocus={e => e.currentTarget.select()} /><button type="button" onClick={() => void copy(link, 'đường dẫn')}>Sao chép</button></div>
            <p>Học sinh quét QR bằng camera điện thoại, đăng nhập rồi vào thẳng phòng thi.</p>
            <div className="sf-share-actions">
              <button type="button" onClick={download}>Tải ảnh QR</button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button type="button" onClick={() => void navigator.share({ title, text: `Vào phòng thi "${title}" — mã ${code}`, url: link }).catch(() => {})}>Chia sẻ…</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

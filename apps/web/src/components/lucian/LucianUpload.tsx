'use client';

// Lucian UX/UI Prompt #032 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#032
// Ported to React / Next.js with real StudyForge AI document processing

import React, { useState, useRef } from 'react';

export type UploadedDoc = {
  id: string;
  title: string;
  fileType: string;
  size: number;
  status: string;
  chunkCount: number;
};

interface LucianUploadProps {
  onUploadSuccess?: (docs: UploadedDoc[]) => void;
}

export function LucianUpload({ onUploadSuccess }: LucianUploadProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ name: string; size: number; progress: number; status: 'uploading' | 'done' | 'fail' }>>([]);

  const formatSize = (bytes: number) => {
    return bytes > 1048576
      ? (bytes / 1048576).toFixed(1) + ' MB'
      : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  };

  const getExtensionColor = (ext: string) => {
    switch (ext) {
      case 'pdf': return '#E5484D';
      case 'docx':
      case 'doc': return '#2B579A';
      case 'txt': return '#3D8BFF';
      case 'png':
      case 'jpg':
      case 'jpeg': return '#10B981';
      default: return '#6A57F2';
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;

    const fileList = Array.from(files);
    const newItems = fileList.map(f => ({
      name: f.name,
      size: f.size,
      progress: 20,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...newItems, ...prev]);

    const formData = new FormData();
    fileList.forEach(f => formData.append('files', f));

    try {
      // Simulate progressive visual feedback
      const timer = setInterval(() => {
        setUploadingFiles(prev =>
          prev.map(item =>
            item.status === 'uploading'
              ? { ...item, progress: Math.min(90, item.progress + 25) }
              : item
          )
        );
      }, 300);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(timer);
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadingFiles(prev =>
          prev.map(item => ({ ...item, progress: 100, status: 'done' }))
        );
        if (onUploadSuccess) {
          onUploadSuccess(data.documents);
        }
      } else {
        setUploadingFiles(prev =>
          prev.map(item => ({ ...item, status: 'fail' }))
        );
      }
    } catch {
      setUploadingFiles(prev =>
        prev.map(item => ({ ...item, status: 'fail' }))
      );
    }
  };

  return (
    <>
      <style>{`
        .u032 {
          position: relative;
          width: 100%;
          font-family: inherit;
        }
        .u032-zone {
          position: relative;
          width: 100%;
          height: 190px;
          border: 0;
          padding: 24px;
          border-radius: 26px;
          background: var(--ux-surface);
          box-shadow: 0 4px 20px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: var(--ux-ink);
          cursor: pointer;
          transition: transform .4s var(--ux-spring), background-color .3s var(--ux-ease);
        }
        .u032-zone:hover {
          transform: translateY(-2px);
        }
        .u032.is-over .u032-zone {
          transform: scale(1.02);
          background: var(--ux-accent-soft);
        }
        .u032-zone svg.u032-dash {
          position: absolute;
          left: 1px;
          top: 1px;
          width: calc(100% - 2px);
          height: calc(100% - 2px);
          overflow: visible;
          pointer-events: none;
        }
        .u032-dash rect {
          fill: none;
          stroke: var(--ux-line-2);
          stroke-width: 2;
          stroke-dasharray: 8 7;
          transition: stroke .3s var(--ux-ease);
        }
        .u032-zone:hover .u032-dash rect, .u032.is-over .u032-dash rect {
          stroke: var(--ux-accent);
          animation: u032-march .9s linear infinite;
        }
        @keyframes u032-march {
          to { stroke-dashoffset: -30; }
        }
        .u032-orb {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #fff;
          background: var(--ux-grad);
          box-shadow: 0 10px 20px -8px var(--ux-accent);
          transition: transform .4s var(--ux-spring);
        }
        .u032-orb svg {
          width: 26px;
          height: 26px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .u032-zone b {
          margin-top: 12px;
          font-size: 15px;
          font-weight: 700;
        }
        .u032-zone b em {
          font-style: normal;
          color: var(--ux-accent);
        }
        .u032-zone small {
          margin-top: 4px;
          font-size: 12px;
          color: var(--ux-ink-3);
        }
        .u032-file {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
        .u032-list {
          margin: 14px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .u032-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          height: 58px;
          padding: 0 14px;
          border-radius: 16px;
          background: var(--ux-surface);
          box-shadow: 0 0 0 1px var(--ux-line);
          overflow: hidden;
          animation: u032-in .4s var(--ux-spring);
        }
        @keyframes u032-in {
          from { transform: translateY(-8px); opacity: 0; }
        }
        .u032-ic {
          width: 36px;
          height: 38px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          font-size: 9px;
          font-weight: 800;
          color: #fff;
        }
        .u032-meta {
          flex: 1;
          min-width: 0;
        }
        .u032-meta b {
          display: block;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .u032-meta small {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          color: var(--ux-ink-3);
        }
        .u032-bar {
          position: absolute;
          left: 0;
          bottom: 0;
          height: 3px;
          background: var(--ux-accent);
          transition: width .3s ease;
        }
        .u032-row.done .u032-bar {
          background: var(--ux-mint);
        }
        .u032-row.fail .u032-bar {
          background: var(--ux-danger);
        }
        .u032-st {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
        }
        .u032-st.ok {
          background: var(--ux-mint);
          color: white;
          font-size: 13px;
          font-weight: 800;
        }
        .u032-spin {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--ux-line-2);
          border-top-color: var(--ux-accent);
          animation: u032-rot .8s linear infinite;
        }
        @keyframes u032-rot { to { transform: rotate(360deg); } }
      `}</style>

      <div ref={rootRef} className={`ux u032 ${isOver ? 'is-over' : ''}`}>
        <button
          className="u032-zone"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={e => { e.preventDefault(); setIsOver(true); }}
          onDragOver={e => { e.preventDefault(); setIsOver(true); }}
          onDragLeave={() => setIsOver(false)}
          onDrop={e => {
            e.preventDefault();
            setIsOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <svg className="u032-dash" aria-hidden="true"><rect width="100%" height="100%" rx="24" /></svg>
          <span className="u032-orb" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <path d="M8.5 20.5H7a5 5 0 0 1-.6-10 7 7 0 0 1 13.4-1.6A5.5 5.5 0 0 1 21 20.5h-1.5M14 13v10M10.5 16.5L14 13l3.5 3.5" />
            </svg>
          </span>
          <b>Kéo thả tài liệu vào đây hoặc <em>chọn file</em></b>
          <small>Hỗ trợ PDF (văn bản & scan), Word (DOCX), TXT · dung lượng tối đa 50MB</small>
        </button>

        <input
          ref={fileInputRef}
          className="u032-file"
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,image/*"
          onChange={e => handleFiles(e.target.files)}
        />

        {uploadingFiles.length > 0 && (
          <ul className="u032-list" aria-live="polite">
            {uploadingFiles.map((file, idx) => {
              const ext = (file.name.split('.').pop() || '').toLowerCase();
              return (
                <li key={idx} className={`u032-row ${file.status}`}>
                  <span className="u032-ic" style={{ background: getExtensionColor(ext) }}>
                    {ext.slice(0, 4).toUpperCase()}
                  </span>
                  <div className="u032-meta">
                    <b>{file.name}</b>
                    <small>
                      {file.status === 'done'
                        ? `${formatSize(file.size)} · Đã trích xuất xong`
                        : file.status === 'fail'
                        ? 'Lỗi xử lý file'
                        : `${formatSize(file.size)} · Đang tải lên & phân tích...`}
                    </small>
                  </div>
                  <div className="u032-st">
                    {file.status === 'done' ? (
                      <span className="u032-st ok">✓</span>
                    ) : file.status === 'fail' ? (
                      <span style={{ color: 'var(--ux-danger)', fontWeight: 800 }}>✕</span>
                    ) : (
                      <div className="u032-spin" />
                    )}
                  </div>
                  <div
                    className="u032-bar"
                    style={{ width: `${file.progress}%` }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LucianUpload, type UploadedDoc } from '@/components/lucian/LucianUpload';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.items || []);
        if (data.items?.length && !selectedDoc) {
          loadDocDetail(data.items[0].id);
        }
      }
    } catch {}
  };

  const loadDocDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const doc = await res.json();
        setSelectedDoc(doc);
        setRawText(doc.rawText || '');
        setSaveSuccess(false);
      }
    } catch {}
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleSaveText = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="ux">
      <style>{`
        .docs-header {
          margin-bottom: 24px;
        }
        .docs-title {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
          margin: 0 0 6px;
        }
        .docs-desc {
          font-size: 14px;
          color: var(--ux-ink-2);
          margin: 0;
        }
        .docs-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        @media (max-width: 860px) {
          .docs-layout { grid-template-columns: 1fr; }
        }
        .docs-sidebar {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .doc-card {
          padding: 16px;
          border-radius: 16px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          cursor: pointer;
          transition: border-color .2s, box-shadow .2s;
        }
        .doc-card:hover {
          border-color: var(--ux-line-2);
        }
        .doc-card.selected {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 2px var(--ux-accent-soft);
        }
        .doc-card-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--ux-ink);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-card-meta {
          font-size: 12px;
          color: var(--ux-ink-3);
        }
        .editor-box {
          padding: 24px;
          border-radius: 20px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 4px 20px var(--ux-shadow);
        }
        .editor-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .editor-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--ux-ink);
        }
        .editor-textarea {
          width: 100%;
          height: 320px;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid var(--ux-line);
          background: var(--ux-surface-2);
          color: var(--ux-ink);
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          outline: none;
        }
        .editor-textarea:focus {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
        }
        .chunk-pill {
          padding: 12px 16px;
          border-radius: 12px;
          background: var(--ux-surface-2);
          margin-bottom: 8px;
          font-size: 13px;
          line-height: 1.5;
          border-left: 3px solid var(--ux-accent);
        }
        .btn-gen {
          padding: 10px 20px;
          border-radius: 12px;
          background: var(--ux-grad);
          color: white;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 14px var(--ux-shadow);
        }
      `}</style>

      <div className="docs-header">
        <h1 className="docs-title">Quản lý & Trích xuất tài liệu</h1>
        <p className="docs-desc">
          Tải lên các tài liệu học tập, xem và chỉnh sửa văn bản được phân tích trước khi AI tạo bài thi.
        </p>
      </div>

      <LucianUpload
        onUploadSuccess={() => {
          fetchDocs();
        }}
      />

      <div className="docs-layout">
        <div className="docs-sidebar">
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ux-ink-3)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Danh sách tài liệu ({documents.length})
          </div>
          {documents.map(d => (
            <div
              key={d.id}
              className={`doc-card ${selectedDoc?.id === d.id ? 'selected' : ''}`}
              onClick={() => loadDocDetail(d.id)}
            >
              <div className="doc-card-title">{d.title}</div>
              <div className="doc-card-meta">
                {new Date(d.createdAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          ))}
        </div>

        <div>
          {selectedDoc ? (
            <div className="editor-box">
              <div className="editor-top">
                <div>
                  <div className="editor-title">{selectedDoc.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--ux-ink-3)', marginTop: '2px' }}>
                    Phân tích thành {selectedDoc.chunks?.length || 0} đoạn trích ngữ cảnh (chunks)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleSaveText}
                    disabled={saving}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: '1px solid var(--ux-line)',
                      background: 'var(--ux-surface)',
                      color: 'var(--ux-ink)',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {saving ? 'Đang lưu...' : saveSuccess ? '✓ Đã lưu' : 'Lưu chỉnh sửa'}
                  </button>

                  <Link href={`/quizzes/create?docId=${selectedDoc.id}`} className="btn-gen">
                    ✨ Tạo đề thi từ tài liệu này
                  </Link>
                </div>
              </div>

              <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--ux-ink-2)' }}>
                Nội dung trích xuất (có thể sửa trước khi sinh đề):
              </div>
              <textarea
                className="editor-textarea"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
              />

              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ux-ink)', marginBottom: '12px' }}>
                  Các đoạn trích dẫn dùng cho câu hỏi (Chunks):
                </div>
                {selectedDoc.chunks?.map((chunk: any) => (
                  <div key={chunk.id} className="chunk-pill">
                    <span style={{ fontWeight: 800, color: 'var(--ux-accent)', marginRight: '6px' }}>
                      [Đoạn {chunk.chunkIndex + 1}]
                    </span>
                    {chunk.content}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', background: 'var(--ux-surface)', borderRadius: '20px' }}>
              Chọn một tài liệu bên trái hoặc tải file mới ở trên.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

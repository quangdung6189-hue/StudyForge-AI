// StudyForge playground — "Every primitive, alive. Go ahead, play with them."
// Animate UI catalog only: Effect swap + CountingNumber + Tilt + Click ripple.
'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Effect } from '@animate-ui/react/primitives/effects/effect';
import { Tilt, TiltContent } from '@animate-ui/react/primitives/effects/tilt';
import { Click } from '@animate-ui/react/primitives/effects/click';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { ReducedMotionConfig } from '@animate-ui/react/utils/motion';

export type DocumentItem = {
  id: string;
  title: string;
  fileType: string;
  size: number;
  status: string;
  createdAt: string;
};

export type QuizItem = {
  id: string;
  title: string;
  description: string;
  isPublished: boolean;
  durationMinutes: number;
  createdAt: string;
};

type TabId = 'extract' | 'source' | 'room';
const TABS: { id: TabId; label: string }[] = [
  { id: 'extract', label: 'Trích xuất' },
  { id: 'source', label: 'Dẫn nguồn' },
  { id: 'room', label: 'Phòng thi' },
];

async function fetchJson(path: string): Promise<any> {
  const res = await fetch(path, { headers: { 'Cache-Control': 'no-store' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface DashboardData {
  documents: DocumentItem[];
  quizzes: QuizItem[];
  error: string | null;
  loading: boolean;
}

function useDashboard(): DashboardData {
  const [data, setData] = React.useState<DashboardData>({
    documents: [],
    quizzes: [],
    error: null,
    loading: true,
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [docsRes, quizzesRes] = await Promise.all([
          fetchJson('/api/documents?page=1&limit=50'),
          fetchJson('/api/quizzes'),
        ]);
        if (cancelled) return;
        setData({
          documents: Array.isArray(docsRes.items) ? docsRes.items : [],
          quizzes: Array.isArray(quizzesRes.items) ? quizzesRes.items : [],
          error: null,
          loading: false,
        });
      } catch (error: any) {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          error: error?.message ?? 'Không thể tải dữ liệu thực từ khách hàng/sản phẩm.',
          loading: false,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return data;
}

function fileIcon(fileType: string): string {
  const ext = (fileType || '').toLowerCase().replace('.', '');
  switch (ext) {
    case 'pdf': return '📄';
    case 'docx':
    case 'doc': return '📝';
    case 'txt': return '📃';
    case 'png':
    case 'jpg':
    case 'jpeg': return '🖼️';
    default: return '📎';
  }
}

function StatusBadge({ status }: { status: string }) {
  const ready = status === 'ready';
  return (
    <span
      className={`sf-source-chip ${ready ? 'trend-ok' : 'trend-wait'}`}
      style={{
        background: ready ? 'rgba(52,211,153,.12)' : 'rgba(214,115,30,.12)',
        borderColor: ready ? 'rgba(52,211,153,.35)' : 'rgba(214,115,30,.35)',
        color: ready ? 'var(--ux-mint)' : 'var(--ux-warn)',
      }}
    >
      {ready ? '✓ Sẵn sàng' : '⏳ Đang xử lý'}
    </span>
  );
}

function Stage({ tab, documents, quizzes }: { tab: TabId; documents: DocumentItem[]; quizzes: QuizItem[] }) {
  if (tab === 'extract') {
    return (
      <div>
        <div className="sf-doc-row" role="list" aria-label="Danh sách tài liệu của khách hàng">
          {documents.map((d) => (
            <span key={d.id} className="sf-doc-chip" role="listitem">
              <span className="sf-doc-ext" aria-hidden="true">{fileIcon(d.fileType)}</span>
              {d.title}
              <StatusBadge status={d.status} />
            </span>
          ))}
          {documents.length === 0 && <span className="sf-doc-chip">Chưa có tài liệu nào</span>}
        </div>
        <p style={{ margin: '6px 0 0', color: 'var(--ux-ink-2)', fontSize: 13.5 }}>
          Tài liệu thực của khách hàng đã upload — công thức, bảng biểu và dấu tiếng Việt được giữ nguyên.
        </p>
        <div className="sf-bar" aria-hidden="true"><i /></div>
        <div style={{ display: 'flex', gap: 22 }}>
          {[
            { v: documents.length, l: 'Tài liệu đã xử lý' },
            { v: quizzes.length, l: 'Đề thi đã tạo' },
            { v: documents.filter((d) => d.status === 'ready').length, l: 'Sẵn sàng làm bài' },
          ].map((s) => (
            <div key={s.l}>
              <div style={{ fontSize: 26, fontWeight: 800 }}><CountingNumber number={s.v} fromNumber={0} /></div>
              <div style={{ fontSize: 12, color: 'var(--sf-ink-3)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (tab === 'source') {
    return (
      <div>
        <p className="sf-quote">Câu hỏi mẫu từ tài liệu khách hàng: Tế bào nhân sơ <b>không có [1]</b> màng nhân — đáp án gốc trong tài liệu <b>được giữ nguyên [2]</b>, AI chỉ gợi ý thêm.</p>
        <div className="sf-doc-row">
          <span className="sf-source-chip">[1] <b>Tài liệu khách hàng</b> · tr.42</span>
          <span className="sf-source-chip">[2] <b>answerOrigin: document</b></span>
          <span className="sf-source-chip">sourceRefs ↔ đoạn trích gốc</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p style={{ margin: '0 0 10px', color: 'var(--ux-ink-2)', fontSize: 13.5 }}>Mỗi thí sinh một thứ tự đáp án (seed riêng) — đáp án thật không bao giờ lộ trước giờ nộp.</p>
      <div className="sf-seed">{['A', 'C', 'B', 'D'].map((o) => (<span key={o} className="sf-seat">{o}</span>))}</div>
      {quizzes.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {quizzes.map((q) => (
            <div key={q.id} className="sf-doc-chip" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div>
                <b>{q.title}</b>
                <br />
                <span style={{ fontSize: 12, color: 'var(--ux-ink-3)' }}>{q.description || 'Không có mô tả'} · {q.durationMinutes} phút</span>
              </div>
              <StatusBadge status={q.isPublished ? 'ready' : 'draft'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LandingPlayground() {
  const [tab, setTab] = React.useState<TabId>('extract');
  const { documents, quizzes, error, loading } = useDashboard();
  return (
    <ReducedMotionConfig>
      <section className="sf-play" aria-label="Trải nghiệm thử các tính năng">
        <div className="sf-play-head">
          <h2>Mọi tính năng, đều sống động. Cứ chạm thử.</h2>
          <p>Bấm qua từng tab để xem pipeline trích xuất → dẫn nguồn → phòng thi vận hành.</p>
        </div>
        {error && (
          <div className="sf-review-empty" style={{ gridColumn: '1 / -1' }}>
            <span className="sf-empty-icon">⚠️</span>
            <h3>Không tải được dữ liệu thực</h3>
            <p>{error}</p>
            {error.includes('401') || error.includes('UNAUTHORIZED') ? (
              <a href="/sign-in" className="sf-btn sf-btn-primary sf-btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Đăng nhập để xem dữ liệu khách hàng/sản phẩm
              </a>
            ) : null}
          </div>
        )}
        {!error && loading && (
          <div className="sf-review-empty" style={{ gridColumn: '1 / -1' }}>
            <span className="sf-empty-icon">⏳</span>
            <h3>Đang tải dữ liệu thực...</h3>
            <p>Vui lòng chờ trong khi hệ thống lấy thông tin khách hàng và sản phẩm.</p>
          </div>
        )}
        {!error && !loading && (<>
        <div className="sf-tabs" role="tablist" aria-label="Tính năng nổi bật">
          {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className="sf-review-tab" onClick={() => setTab(t.id)} data-id={t.id}>
              <Click variant="ripple" />
              {t.label}
              <span className="sf-review-badge">
                {t.id === 'extract' ? documents.length : t.id === 'room' ? quizzes.length : documents.filter((d) => d.status === 'ready').length}
              </span>
            </button>
          ))}
        </div>
        <Tilt maxTilt={4} perspective={1200}>
          <TiltContent className="sf-stage" style={{ display: 'grid' }}>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.28 }} style={{ display: 'grid', gap: 16 }}>
                <Stage tab={tab} documents={documents} quizzes={quizzes} />
              </motion.div>
            </AnimatePresence>
          </TiltContent>
        </Tilt>
        <Effect fade blur slide={{ direction: 'up', offset: 12 }}>
          <p style={{ textAlign: 'center', color: 'var(--sf-ink-3)', fontSize: 12.5, margin: '14px 0 0' }}>Mẹo: di chuột lên thẻ để nghiêng 3D · bấm tab để đổi nội dung mượt</p>
        </Effect>
        </>)}
      </section>
    </ReducedMotionConfig>
  );
}

'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DocumentDTO } from '@studyforge/contracts';
import { AnimatePresence, motion } from 'motion/react';
import {
  blur,
  ReducedMotionConfig,
  shift,
  spring,
  transition as motionTokens,
  useShouldReduceMotion,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { MathText } from '@/components/common/MathText';
import { useFeedback } from '@/components/ui/Feedback';
import './study.css';

type Card = {
  id: string; deck: string; front: string; back: string; explanation: string; citation: string;
  dueAt: string; repetitions: number; lapses: number; intervalDays: number; nextIntervals: [number, number, number, number];
  demo?: boolean;
};
type Stats = { total: number; due: number; streak: number; reviewedToday: number; decks: { id: string; title: string; cards: number; due: number }[] };

const RATINGS = [
  { r: 0 as const, label: 'Quên' },
  { r: 1 as const, label: 'Khó' },
  { r: 2 as const, label: 'Nhớ' },
  { r: 3 as const, label: 'Dễ' },
];

const DEMO: Card[] = [
  { id: 'demo-1', deck: 'demo', front: 'Nguyên lý chính của phương pháp Lặp lại ngắt quãng (Spaced Repetition) là gì?', back: 'Gia tăng dần khoảng cách giữa các lần ôn để củng cố trí nhớ dài hạn trước khi kiến thức bị quên.', explanation: 'Dựa trên đường cong lãng quên Ebbinghaus: gợi nhớ chủ động đúng lúc giúp ghi nhớ bền hơn.', citation: 'Bộ thẻ mẫu · Phương pháp học tập', dueAt: '', repetitions: 0, lapses: 0, intervalDays: 0, nextIntervals: [0, 1, 1, 3], demo: true },
  { id: 'demo-2', deck: 'demo', front: 'Chiến thuật làm bài trắc nghiệm 2 lượt mang lại lợi ích gì?', back: 'Lượt 1 làm ngay câu chắc chắn; lượt 2 dồn thời gian cho câu vận dụng khó.', explanation: 'Giúp không mất điểm câu dễ và quản lý thời gian chặt chẽ.', citation: 'Bộ thẻ mẫu · Kỹ năng làm bài', dueAt: '', repetitions: 0, lapses: 0, intervalDays: 0, nextIntervals: [0, 1, 1, 3], demo: true },
  { id: 'demo-3', deck: 'demo', front: 'Khi gặp câu Đúng/Sai nhiều ý, nên đối chiếu thế nào?', back: 'Đọc độc lập từng ý, gạch chân từ khoá tuyệt đối hoá (không, chỉ, luôn luôn) và đối chiếu dẫn chứng.', explanation: 'Đề thường bẫy bằng trạng từ tuyệt đối hoặc đảo quan hệ nhân – quả.', citation: 'Bộ thẻ mẫu · Đọc hiểu', dueAt: '', repetitions: 0, lapses: 0, intervalDays: 0, nextIntervals: [0, 1, 1, 3], demo: true },
];

function intervalLabel(days: number) {
  if (days <= 0) return '< 10 phút';
  if (days === 1) return '1 ngày';
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `~${Math.round(days / 30)} tháng`;
  return '~1 năm';
}

function StudyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useFeedback();
  const deckParam = params.get('deck') ?? '';
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [done, setDone] = useState(0);
  const [startSize, setStartSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<DocumentDTO[]>([]);
  const [docId, setDocId] = useState('');
  const [importing, setImporting] = useState(false);
  const [demo, setDemo] = useState(false);
  const reduceMotion = useShouldReduceMotion();
  const pressSpring = useTempoTransition(spring.press);
  const panelIn = useTempoTransition(motionTokens.panelIn);
  const panelOut = useTempoTransition(motionTokens.panelOut);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (deck: string) => {
    setLoading(true);
    try {
      const query = deck ? `deck=${encodeURIComponent(deck)}` : 'due=1';
      const res = await fetch(`/api/study?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tải được thẻ ôn tập.');
      setStats(data.stats);
      // A deck view still studies due cards first, then the rest of the deck.
      const now = Date.now();
      const cards: Card[] = deck ? [...data.cards].sort((a: Card, b: Card) => Number(new Date(a.dueAt).getTime() > now) - Number(new Date(b.dueAt).getTime() > now)) : data.cards;
      setQueue(cards); setStartSize(cards.length); setDone(0); setFlipped(false); setDemo(false);
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { void load(deckParam); }, [deckParam, load]);
  useEffect(() => {
    fetch('/api/documents?limit=100').then(r => r.json()).then(d => setDocuments((d.items ?? []).filter((x: DocumentDTO) => x.status === 'ready'))).catch(() => {});
  }, []);

  const current = queue[0];
  const openDeck = (deck: string) => router.push(deck ? `/study?deck=${encodeURIComponent(deck)}` : '/study');

  const rate = async (rating: 0 | 1 | 2 | 3) => {
    if (!current || busy) return;
    if (current.demo) {
      setQueue(q => (rating === 0 ? [...q.slice(1), q[0]] : q.slice(1)));
      if (rating !== 0) setDone(n => n + 1);
      setFlipped(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/study/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: current.id, rating }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa lưu được đánh giá.');
      setFlipped(false);
      // "Quên" comes back in ~10 minutes: keep it at the end of this session.
      setQueue(q => (rating === 0 ? [...q.slice(1), { ...q[0], ...data }] : q.slice(1)));
      if (rating !== 0) setDone(n => n + 1);
      setStats(s => s && { ...s, reviewedToday: s.reviewedToday + 1, due: Math.max(0, s.due - (rating === 0 ? 0 : 1)), streak: Math.max(1, s.streak) });
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setBusy(false); }
  };

  const importDocument = async () => {
    if (!docId || importing) return;
    setImporting(true);
    try {
      const res = await fetch('/api/study/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'document', documentId: docId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Chưa tạo được bộ thẻ.');
      if (!data.total) toast('Tài liệu chưa có câu hỏi nhận diện được để tạo thẻ.', 'info');
      else toast(`Đã tạo ${data.created} thẻ mới (${data.total} thẻ trong bộ).`, 'success');
      if (data.total) openDeck(data.deck); else void load(deckParam);
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setImporting(false); }
  };

  // Keyboard: Space flips, 1–4 rate once the answer is shown
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (!current) return;
      if (event.key === ' ' && el?.tagName !== 'BUTTON') { event.preventDefault(); setFlipped(f => !f); }
      else if (flipped && /^[1-4]$/.test(event.key)) { event.preventDefault(); void rate((Number(event.key) - 1) as 0 | 1 | 2 | 3); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress = startSize ? Math.min(1, done / startSize) : 0;
  const activeDeckTitle = deckParam ? stats?.decks.find(d => d.id === deckParam)?.title ?? 'Bộ thẻ' : 'Đến hạn hôm nay';

  return (
    <div className="ux study-studio">
      <div className="study-header">
        <div className="study-title-group">
          <h1>
            <span className="study-icon-wrap" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" /><path d="M6 6h10" /><path d="M6 10h10" /></svg>
            </span>
            Ôn luyện lặp lại ngắt quãng
          </h1>
          <p>Mỗi thẻ quay lại đúng lúc bạn sắp quên. Đánh giá thật lòng để lịch ôn chính xác.</p>
        </div>
      </div>

      <div className="study-stats sf-stagger">
        <div className="study-stat" data-tone="due"><b>{stats ? <CountingNumber number={stats.due} /> : '–'}</b><span>Thẻ đến hạn</span></div>
        <div className="study-stat" data-tone="streak">
          <b>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5-1.5 5-1.5 7.5A2.5 2.5 0 0 0 13 12c1.7 0 2.5-1.6 2-3.5C17.4 10 19 12.4 19 15a7 7 0 1 1-14 0c0-4.5 4-7 7-13Z" /></svg>
            {stats ? <CountingNumber number={stats.streak} /> : '–'}
          </b>
          <span>Ngày liên tiếp</span>
        </div>
        <div className="study-stat"><b>{stats ? <CountingNumber number={stats.reviewedToday} /> : '–'}</b><span>Đã ôn hôm nay</span></div>
        <div className="study-stat"><b>{stats ? <CountingNumber number={stats.total} /> : '–'}</b><span>Tổng số thẻ</span></div>
      </div>

      {stats && stats.decks.length > 0 && (
        <div className="study-decks" role="group" aria-label="Chọn bộ thẻ">
          <button type="button" className="study-deck" aria-pressed={!deckParam} onClick={() => openDeck('')}>
            <span className="study-deck-name">Đến hạn hôm nay</span><span className="study-deck-count">{stats.due}</span>
          </button>
          {stats.decks.map(d => (
            <button key={d.id} type="button" className="study-deck" aria-pressed={deckParam === d.id} onClick={() => openDeck(d.id)} title={d.title}>
              <span className="study-deck-name">{d.title}</span><span className="study-deck-count">{d.due ? `${d.due}/${d.cards}` : d.cards}</span>
            </button>
          ))}
        </div>
      )}

      <div className="study-import">
        <label htmlFor="deck-doc">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Tạo bộ thẻ từ tài liệu
        </label>
        <select id="deck-doc" value={docId} onChange={e => setDocId(e.target.value)}>
          <option value="">{documents.length ? 'Chọn tài liệu đã đọc xong…' : 'Chưa có tài liệu sẵn sàng'}</option>
          {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <button type="button" className="study-btn primary" disabled={!docId || importing} onClick={() => void importDocument()}>{importing ? 'Đang tạo…' : 'Tạo bộ thẻ'}</button>
      </div>

      {loading ? (
        <div className="sf-skel" style={{ height: 360, borderRadius: 24 }} role="status" aria-label="Đang tải thẻ ôn tập" />
      ) : !current ? (
        <div className="study-empty">
          <div className="study-empty-ic" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          {startSize > 0 || (stats?.total ?? 0) > 0 ? (
            <>
              <h2>{startSize > 0 ? 'Hoàn thành phiên ôn tập!' : 'Hôm nay không có thẻ đến hạn'}</h2>
              <p>{startSize > 0 ? `Bạn đã ôn ${done} thẻ. Các thẻ sẽ quay lại theo lịch đã tính.` : 'Quay lại vào ngày mai, hoặc chọn một bộ thẻ để ôn thêm.'}</p>
              {deckParam ? <button type="button" className="study-btn" onClick={() => openDeck('')}>Về thẻ đến hạn</button> : <Link className="study-btn" href="/quizzes/take">Làm một bài kiểm tra</Link>}
            </>
          ) : (
            <>
              <h2>Chưa có thẻ ôn tập</h2>
              <p>Tạo bộ thẻ từ tài liệu ở phía trên, hoặc sau khi làm bài bấm “Ôn lại câu sai”. Có thể thử bộ thẻ mẫu trước.</p>
              <button type="button" className="study-btn primary" onClick={() => { setQueue(DEMO); setStartSize(DEMO.length); setDone(0); setDemo(true); }}>Thử bộ thẻ mẫu</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="study-progress">
            <span>{demo ? 'Bộ thẻ mẫu' : activeDeckTitle}</span>
            <div className="study-progress-track" role="progressbar" aria-label="Tiến độ phiên ôn tập" aria-valuemin={0} aria-valuemax={startSize} aria-valuenow={done}>
              <i style={{ '--p': progress } as React.CSSProperties} />
            </div>
            <span className="tabular">{done}/{startSize}</span>
          </div>
          <ReducedMotionConfig>
            <div className="study-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${current.id}-${current.repetitions}-${current.lapses}`}
                  initial={{ opacity: 0, filter: blur.panel, transform: reduceMotion ? 'none' : `translate3d(${shift.step}px, 0, 0)` }}
                  animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0, 0, 0)', transition: panelIn }}
                  exit={{ opacity: 0, filter: blur.panel, transform: reduceMotion ? 'none' : `translate3d(${-shift.step}px, 0, 0)`, transition: panelOut }}
                >
                  <motion.div
                    ref={cardRef}
                    className="study-card"
                    initial={{ transform: 'scale(1)' }}
                    whileTap={reduceMotion ? undefined : { transform: 'scale(0.985)' }}
                    transition={pressSpring}
                    onClick={() => setFlipped(f => !f)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f); } }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={flipped}
                    aria-label={flipped ? 'Mặt đáp án. Nhấn để quay lại câu hỏi' : 'Mặt câu hỏi. Nhấn hoặc bấm phím cách để xem đáp án'}
                  >
                    <div className="study-flip" data-flipped={flipped}>
                      <div className="study-face front" aria-hidden={flipped} inert={flipped || undefined}>
                        <div className="study-card-head">
                          <span className="study-card-topic">{demo ? 'Bộ mẫu' : activeDeckTitle}</span>
                          <span className="study-card-type">{current.repetitions ? `Đã nhớ ${current.repetitions} lần` : current.lapses ? `Quên ${current.lapses} lần` : 'Thẻ mới'}</span>
                        </div>
                        <div className="study-card-content"><MathText text={current.front} /></div>
                        <div className="study-card-hint">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>
                          Nhớ lại đáp án, rồi nhấn để kiểm tra
                        </div>
                      </div>
                      <div className="study-face back" aria-hidden={!flipped} inert={!flipped || undefined}>
                        <div className="study-card-head">
                          <span className="study-card-topic">Đáp án</span>
                          <span className="study-card-type">{current.citation}</span>
                        </div>
                        <div className="study-card-content study-card-answer"><MathText text={current.back} /></div>
                        {current.explanation && <div className="study-card-exp"><b>Giải thích: </b><MathText text={current.explanation} inline /></div>}
                        {current.citation && <div className="study-cite">Nguồn: {current.citation}</div>}
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </ReducedMotionConfig>

          {flipped ? (
            <div className="study-rate" role="group" aria-label="Bạn nhớ thẻ này thế nào?">
              {RATINGS.map(({ r, label }) => (
                <button key={r} type="button" data-r={r} disabled={busy} onClick={() => void rate(r)}>
                  <b>{label}</b>
                  <small>{intervalLabel(current.nextIntervals[r])}</small>
                  <kbd className="sf-kbd" aria-hidden="true">{r + 1}</kbd>
                </button>
              ))}
            </div>
          ) : (
            <div className="study-actions">
              <button type="button" className="study-btn primary" onClick={() => setFlipped(true)}>Hiện đáp án</button>
            </div>
          )}
          <div className="study-keys" aria-hidden="true">
            <kbd className="sf-kbd">Space</kbd> lật thẻ
            <span style={{ opacity: 0.5 }}>·</span>
            <kbd className="sf-kbd">1</kbd>–<kbd className="sf-kbd">4</kbd> đánh giá sau khi xem đáp án
          </div>
        </>
      )}
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="ux study-studio"><div className="sf-skel" style={{ height: 420, borderRadius: 24 }} /></div>}>
      <StudyInner />
    </Suspense>
  );
}

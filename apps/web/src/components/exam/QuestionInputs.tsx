'use client';

import React from 'react';
import { Reorder } from 'motion/react';
import { ReducedMotionConfig, spring, useTempoTransition } from '@animate-ui/react/utils/motion';
import { MathText } from '@/components/common/MathText';
import './question-inputs.css';

type Option = { id: string; text: string };

/** Ordering: drag to reorder (pointer) or use the arrow buttons (keyboard/touch). */
export function OrderingInput({ options, value, onChange, locked, correctOrder }: {
  options: Option[]; value: string[] | undefined; onChange: (ids: string[]) => void; locked?: boolean; correctOrder?: string[];
}) {
  const reflow = useTempoTransition(spring.reflow);
  const order = value && value.length === options.length && value.every(id => options.some(o => o.id === id)) ? value : options.map(o => o.id);
  const byId = new Map(options.map(o => [o.id, o]));
  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <ReducedMotionConfig>
      <p className="qi-help">{locked ? 'Thứ tự bạn đã chọn:' : 'Kéo thả hoặc dùng mũi tên để sắp xếp theo thứ tự đúng (trên cùng là thứ nhất).'}</p>
      <Reorder.Group axis="y" values={order} onReorder={ids => !locked && onChange(ids)} className="qi-order" as="ol">
        {order.map((id, index) => {
          const state = correctOrder ? (correctOrder[index] === id ? 'right' : 'wrong') : undefined;
          return (
            <Reorder.Item key={id} value={id} className="qi-order-item" data-state={state} dragListener={!locked} transition={reflow} whileDrag={{ scale: 1.02, boxShadow: 'var(--ux-elev-3)' }} as="li">
              <span className="qi-order-num" aria-hidden="true">{index + 1}</span>
              <span className="qi-order-text"><MathText text={byId.get(id)?.text ?? ''} inline /></span>
              {!locked && (
                <span className="qi-order-moves">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Đưa "${byId.get(id)?.text}" lên vị trí ${index}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label={`Đưa "${byId.get(id)?.text}" xuống vị trí ${index + 2}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                </span>
              )}
              {!locked && <span className="qi-grip" aria-hidden="true"><i /><i /><i /></span>}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {correctOrder && correctOrder.some((id, i) => order[i] !== id) && (
        <p className="qi-help" style={{ marginTop: 10, color: 'var(--ux-mint)' }}>
          Thứ tự đúng: {correctOrder.map(id => byId.get(id)?.text).filter(Boolean).join(' → ')}
        </p>
      )}
    </ReducedMotionConfig>
  );
}

/** Matching: each left item picks one right item; values are "leftId:rightId". */
export function MatchingInput({ options, leftIds, value, onChange, locked, correctPairs }: {
  options: Option[]; leftIds: string[]; value: string[] | undefined; onChange: (pairs: string[]) => void; locked?: boolean; correctPairs?: { leftId: string; rightId: string }[];
}) {
  const left = leftIds.map(id => options.find(o => o.id === id)).filter(Boolean) as Option[];
  const right = options.filter(o => !leftIds.includes(o.id));
  const chosen = new Map((value ?? []).map(v => v.split(':') as [string, string]));
  const correct = new Map((correctPairs ?? []).map(p => [p.leftId, p.rightId]));
  const set = (leftId: string, rightId: string) => {
    const next = new Map(chosen);
    if (!rightId) next.delete(leftId); else {
      for (const [l, r] of next) if (r === rightId && l !== leftId) next.delete(l); // one partner each
      next.set(leftId, rightId);
    }
    onChange([...next].map(([l, r]) => `${l}:${r}`));
  };
  return (
    <div className="qi-match">
      <p className="qi-help">Chọn mục ở cột phải tương ứng với từng mục ở cột trái.</p>
      {left.map((item, i) => {
        const pick = chosen.get(item.id) ?? '';
        const state = correctPairs ? (correct.get(item.id) === pick ? 'right' : 'wrong') : undefined;
        return (
          <div key={item.id} className="qi-match-row" data-state={state}>
            <span className="qi-match-left"><b>{i + 1}</b><MathText text={item.text} inline /></span>
            <svg className="qi-match-link" width="22" height="12" viewBox="0 0 22 12" aria-hidden="true"><path d="M1 6h18M15 1.5 20 6l-5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <select value={pick} disabled={locked} onChange={e => set(item.id, e.target.value)} aria-label={`Ghép với mục ${i + 1}: ${item.text}`}>
              <option value="">— Chọn —</option>
              {right.map((r, j) => <option key={r.id} value={r.id}>{String.fromCharCode(97 + j)}. {r.text}</option>)}
            </select>
            {state === 'wrong' && correct.get(item.id) && (
              <small className="qi-match-fix">Đúng: {right.find(r => r.id === correct.get(item.id))?.text}</small>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QuestionAudio({ src }: { src: string }) {
  return (
    <div className="qi-audio">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" /></svg>
      <span>Nghe đoạn âm thanh</span>
      <audio controls preload="metadata" src={src}>Trình duyệt chưa hỗ trợ phát âm thanh.</audio>
    </div>
  );
}

export type CheckFeedback = {
  correct: boolean; credit: number; earnedPoints: number; points: number; correctOptionIds: string[]; acceptedAnswers: string[];
  pairs?: { leftId: string; rightId: string }[]; explanation: string; sourceRefs: { quote: string }[];
};

export function PracticeFeedback({ feedback }: { feedback: CheckFeedback }) {
  const tone = feedback.correct ? 'right' : feedback.credit > 0 ? 'partial' : 'wrong';
  return (
    <div className="qi-feedback" data-state={tone} role="status">
      <div className="qi-feedback-head">
        <span className="qi-feedback-badge" aria-hidden="true">
          {tone === 'right' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
        </span>
        <b>{tone === 'right' ? 'Chính xác!' : tone === 'partial' ? 'Đúng một phần' : 'Chưa đúng'}</b>
        <span className="qi-feedback-pts">+{feedback.earnedPoints}/{feedback.points} điểm</span>
      </div>
      {feedback.acceptedAnswers.length > 0 && <p><b>Đáp án chấp nhận:</b> {feedback.acceptedAnswers.join(' / ')}</p>}
      <div className="qi-feedback-exp"><b>Giải thích:</b> <MathText text={feedback.explanation} inline /></div>
      {feedback.sourceRefs[0] && <blockquote>“{feedback.sourceRefs[0].quote}”</blockquote>}
    </div>
  );
}

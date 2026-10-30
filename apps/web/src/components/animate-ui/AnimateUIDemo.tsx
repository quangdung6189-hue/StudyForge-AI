'use client';

// Animate UI demo · subtle level · tokens from @animate-ui/react/utils/motion
// Docs: .agents/skills/animate-ui/SKILL.md + references/catalog.md
import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Effect, Effects } from '@animate-ui/react/primitives/effects/effect';
import { Magnetic } from '@animate-ui/react/primitives/effects/magnetic';
import { Tilt, TiltContent } from '@animate-ui/react/primitives/effects/tilt';
import { Click } from '@animate-ui/react/primitives/effects/click';
import { SplittingText } from '@animate-ui/react/primitives/texts/splitting';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { TypingText } from '@animate-ui/react/primitives/texts/typing';
import {
  ReducedMotionConfig,
  blur,
  scale,
  spring,
  transition,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { AnimateUIProvider } from '@animate-ui/react/provider';

type Status = 'idle' | 'loading' | 'success';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Tạo đề thi thử',
  loading: 'Đang tạo đề…',
  success: 'Đã tạo xong ✓',
};

function StatusButton() {
  const [status, setStatus] = React.useState<Status>('idle');
  return (
    <ReducedMotionConfig>
      <StatusMotion status={status} onClick={() => {
        if (status === 'loading') return;
        setStatus('loading');
        window.setTimeout(() => setStatus('success'), 1400);
        window.setTimeout(() => setStatus('idle'), 3200);
      }} />
    </ReducedMotionConfig>
  );
}

function StatusMotion({ status, onClick }: { status: Status; onClick: () => void }) {
  const press = useTempoTransition(spring.press);
  const resize = useTempoTransition(spring.reflow);
  const swap = useTempoTransition(transition.swap);
  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      disabled={status === 'loading'}
      aria-live="polite"
      whileTap={{ transform: `scale(${scale.press})` }}
      transition={{ ...press, layout: resize }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 44, padding: '0 22px', borderRadius: 999,
        border: 'none', background: 'var(--ux-accent)', color: 'var(--ux-accent-ink)',
        fontWeight: 700, fontSize: 15, cursor: status === 'loading' ? 'wait' : 'pointer',
        overflow: 'hidden',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            layout="position"
            initial={{ opacity: 0, filter: blur.icon }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: blur.icon, transition: swap }}
            transition={{ ...swap, layout: resize }}
          >
            {STATUS_LABEL[status]}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

type Todo = { id: string; label: string };

function TodoList() {
  const [items, setItems] = React.useState<Todo[]>([
    { id: 't1', label: 'Ôn Sinh học 8: cấu tạo tế bào' },
    { id: 't2', label: 'Luyện 20 câu trắc nghiệm Vật lí' },
  ]);
  const [draft, setDraft] = React.useState('');
  const move = useTempoTransition(spring.reflow);
  const fade = useTempoTransition(transition.fade);
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    setItems((prev) => [...prev, { id: `t${Date.now()}`, label }]);
    setDraft('');
  };
  return (
    <ReducedMotionConfig>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Thêm nhiệm vụ ôn tập rồi Enter…"
          aria-label="Thêm nhiệm vụ ôn tập"
          style={{
            flex: 1, height: 40, borderRadius: 12, padding: '0 14px',
            border: '1px solid var(--ux-line-2)', background: 'var(--ux-surface)', color: 'var(--ux-ink)',
          }}
        />
        <button
          type="button"
          onClick={add}
          style={{
            height: 40, padding: '0 18px', borderRadius: 12, border: 'none',
            background: 'var(--ux-grad)', color: '#fff', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Thêm
        </button>
      </div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { ...move, opacity: fade } }}
              exit={{ opacity: 0, scale: 0.96, transition: fade }}
              transition={move}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '10px 14px', borderRadius: 12,
                border: '1px solid var(--ux-line)', background: 'var(--ux-surface)',
              }}
            >
              <span style={{ fontSize: 14 }}>{item.label}</span>
              <button
                type="button"
                aria-label={`Xóa ${item.label}`}
                onClick={(e) => {
                  const li = (e.currentTarget.closest('li') as HTMLElement | null);
                  if (li && li.contains(document.activeElement)) li.inert = true;
                  setItems((prev) => prev.filter((t) => t.id !== item.id));
                }}
                style={{
                  border: '1px solid var(--ux-line-2)', background: 'var(--ux-surface-2)',
                  color: 'var(--ux-ink-2)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                }}
              >
                Xóa
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </ReducedMotionConfig>
  );
}

export default function AnimateUIDemo() {
  const [tempo, setTempo] = React.useState(1);
  return (
    <AnimateUIProvider tempo={tempo}>
      <div className="ux" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Effects
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          // stagger entrance of hero children, subtle level
          holdDelay={90}
        >
          <Effect fade slide={{ direction: 'up', offset: 16 }} blur>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
                padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                color: 'var(--ux-accent)', background: 'var(--ux-surface)',
                border: '1px solid var(--ux-line)',
              }}
            >
              ✨ Animate UI · subtle level · tempo {tempo.toFixed(2)}x
            </div>
          </Effect>
          <Effect fade slide={{ direction: 'up', offset: 20 }} blur>
            <SplittingText
              type="words"
              text="Biến tài liệu thành chuyển động mượt mà"
              style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.25, color: 'var(--ux-ink)' }}
            />
          </Effect>
          <Effect fade slide={{ direction: 'up', offset: 12 }}>
            <p style={{ margin: 0, color: 'var(--ux-ink-2)', fontSize: 16 }}>
              <TypingText
                text={['Upload PDF → tách câu hỏi…', 'Đảo đáp án theo seed…', 'Chấm điểm & ôn tập…']}
                loop
              />
            </p>
          </Effect>
        </Effects>

        <section
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {[
            { value: 1280, label: 'Câu hỏi đã tạo' },
            { value: 96, label: 'Tài liệu đã xử lý' },
            { value: 87, label: '% đúng trung bình' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: 18, borderRadius: 18, background: 'var(--ux-surface)',
                border: '1px solid var(--ux-line)',
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ux-accent)' }}>
                <CountingNumber number={s.value} fromNumber={0} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--ux-ink-2)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <StatusButton />
          <Magnetic strength={0.35} range={120}>
            <button
              type="button"
              style={{
                position: 'relative', overflow: 'hidden', height: 44, padding: '0 22px',
                borderRadius: 999, border: '1px solid var(--ux-line-2)',
                background: 'var(--ux-surface)', color: 'var(--ux-ink)',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Click variant="ripple" />
              Nút ripple + magnetic
            </button>
          </Magnetic>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ux-ink-2)' }}>
            Tempo
            <input
              type="range" min={0.5} max={1.5} step={0.05} value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              aria-label="Tốc độ animation"
            />
            <b style={{ color: 'var(--ux-ink)' }}>{tempo.toFixed(2)}x</b>
          </label>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <Tilt maxTilt={10} perspective={800}>
            <TiltContent
              style={{
                padding: 22, borderRadius: 20, background: 'var(--ux-grad)', color: '#fff',
                minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              }}
            >
              <b>Thẻ nghiêng theo chuột (Tilt)</b>
              <span style={{ fontSize: 13, opacity: 0.9 }}>Di chuột qua để xem hiệu ứng 3D lò xo.</span>
            </TiltContent>
          </Tilt>
          <div
            style={{
              padding: 22, borderRadius: 20, background: 'var(--ux-surface)',
              border: '1px solid var(--ux-line)',
            }}
          >
            <b style={{ display: 'block', marginBottom: 10 }}>Danh sách động (thêm / xóa)</b>
            <TodoList />
          </div>
        </section>
      </div>
    </AnimateUIProvider>
  );
}
'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ReducedMotionConfig, scale, spring, transition, useShouldReduceMotion, useTempoTransition } from '@animate-ui/react/utils/motion';
import './feedback.css';

type Tone = 'info' | 'success' | 'danger';
type Toast = { id: number; message: string; tone: Tone };
type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'danger' | 'primary' };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const FeedbackContext = createContext<{ toast: (message: string, tone?: Tone) => void; confirm: (options: ConfirmOptions) => Promise<boolean> } | null>(null);

/** toast() for results of an action, confirm() instead of window.confirm. */
export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => { window.removeEventListener('online', callback); window.removeEventListener('offline', callback); };
}
/** true on the server and while hydrating, then the browser's real connectivity. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

const ICONS: Record<Tone, React.ReactNode> = {
  info: <path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />,
  success: <polyline points="20 6 9 17 4 12" />,
  danger: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
};

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const reduce = useShouldReduceMotion();
  const enter = useTempoTransition(spring.toast);
  const leave = useTempoTransition(transition.dismiss);
  const fade = useTempoTransition(transition.fade);
  const hidden = { opacity: 0, filter: 'blur(4px)', transform: reduce ? 'none' : `translate3d(0, 14px, 0) scale(${scale.toast})` };
  return (
    <div className="sf-toasts" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout={!reduce}
            className="sf-toast"
            data-tone={t.tone}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            initial={hidden}
            animate={{ opacity: 1, filter: 'blur(0px)', transform: 'translate3d(0, 0, 0) scale(1)', transition: { ...enter, opacity: fade, filter: fade } }}
            exit={{ ...hidden, transition: leave }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[t.tone]}</svg>
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ConfirmDialog({ pending, close }: { pending: Pending; close: (ok: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(false); }
      if (event.key === 'Tab') {
        const items = [...document.querySelectorAll<HTMLElement>('.sf-dialog [data-dialog-action]')];
        if (!items.length) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
        event.preventDefault();
        items[next].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); (opener.current as HTMLElement | null)?.focus?.(); };
  }, [close]);
  return (
    <div className="sf-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) close(false); }}>
      <div className="sf-dialog sf-confirm" role="alertdialog" aria-modal="true" aria-labelledby="sf-confirm-title" aria-describedby={pending.message ? 'sf-confirm-desc' : undefined}>
        <h2 id="sf-confirm-title">{pending.title}</h2>
        {pending.message && <p id="sf-confirm-desc">{pending.message}</p>}
        <div className="sf-confirm-actions">
          <button ref={cancelRef} type="button" className="sf-confirm-btn" data-dialog-action onClick={() => close(false)}>{pending.cancelLabel ?? 'Huỷ'}</button>
          <button type="button" className="sf-confirm-btn" data-tone={pending.tone ?? 'primary'} data-dialog-action onClick={() => close(true)}>{pending.confirmLabel ?? 'Đồng ý'}</button>
        </div>
      </div>
    </div>
  );
}

function NetworkBanner() {
  const online = useOnline();
  const reduce = useShouldReduceMotion();
  const offset = reduce ? '0px' : '-12px';
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBackOnline(true);
    const t = window.setTimeout(() => setBackOnline(false), 2600);
    return () => window.clearTimeout(t);
  }, [online]);
  const visible = !online || backOnline;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={online ? 'on' : 'off'}
          className="sf-netbar"
          data-online={online}
          role="status"
          initial={{ opacity: 0, transform: `translate3d(-50%, ${offset}, 0)` }}
          animate={{ opacity: 1, transform: 'translate3d(-50%, 0, 0)' }}
          exit={{ opacity: 0, transform: `translate3d(-50%, ${offset}, 0)` }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          <span className="sf-netbar-dot" aria-hidden="true" />
          {online ? 'Đã kết nối lại — đang đồng bộ.' : 'Mất kết nối mạng. Thao tác được giữ trên máy và sẽ đồng bộ khi có mạng.'}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);
  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), tone === 'danger' ? 6500 : 3800);
  }, [dismiss]);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...options, resolve })), []);
  const close = useCallback((ok: boolean) => setPending(current => { current?.resolve(ok); return null; }), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ReducedMotionConfig>
        <ToastStack toasts={toasts} dismiss={dismiss} />
        <NetworkBanner />
      </ReducedMotionConfig>
      {pending && <ConfirmDialog pending={pending} close={close} />}
    </FeedbackContext.Provider>
  );
}

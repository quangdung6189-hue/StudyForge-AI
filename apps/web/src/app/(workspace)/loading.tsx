const card: React.CSSProperties = {
  borderRadius: 18,
  background: 'var(--ux-surface)',
  border: '1px solid var(--ux-line)',
  boxShadow: 'var(--ux-elev-1)',
};

/** Route-level skeleton: shimmering placeholders shaped like the workspace pages. */
export default function LoadingWorkspace() {
  return (
    <div
      className="ux"
      role="status"
      aria-live="polite"
      aria-label="Đang tải nội dung"
      style={{ maxWidth: 1240, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 22 }}
    >
      <div style={{ ...card, borderRadius: 22, padding: '30px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 220 }}>
          <div className="sf-skel" style={{ width: 210, height: 22, borderRadius: 999 }} />
          <div className="sf-skel" style={{ width: 'min(360px, 80%)', height: 30, borderRadius: 10 }} />
          <div className="sf-skel" style={{ width: 'min(520px, 95%)', height: 14, opacity: 0.7 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="sf-skel" style={{ width: 124, height: 42, borderRadius: 11 }} />
          <div className="sf-skel" style={{ width: 108, height: 42, borderRadius: 11 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...card, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="sf-skel" style={{ width: 36, height: 36, borderRadius: 10 }} />
            <div className="sf-skel" style={{ width: '62%', height: 16 }} />
            <div className="sf-skel" style={{ width: '88%', height: 12, opacity: 0.7 }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ ...card, borderRadius: 20, padding: 22 }}>
            <div className="sf-skel" style={{ width: 170, height: 18, marginBottom: 18 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="sf-skel" style={{ height: 52, borderRadius: 12, opacity: 1 - j * 0.15 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="visually-hidden">Đang tải nội dung…</span>
    </div>
  );
}

export default function LoadingWorkspace() {
  return (
    <div
      className="ux"
      role="status"
      aria-live="polite"
      style={{
        padding: '32px 24px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              width: 180,
              height: 28,
              borderRadius: 8,
              background: 'var(--ux-surface-2)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: 280,
              height: 16,
              borderRadius: 6,
              background: 'var(--ux-surface-2)',
              opacity: 0.6,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
        <div
          style={{
            width: 120,
            height: 38,
            borderRadius: 10,
            background: 'var(--ux-surface-2)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 140,
              borderRadius: 'var(--ux-radius, 14px)',
              background: 'var(--ux-surface)',
              border: '1px solid var(--ux-line)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--ux-surface-2)',
              }}
            />
            <div
              style={{
                width: '60%',
                height: 18,
                borderRadius: 6,
                background: 'var(--ux-surface-2)',
              }}
            />
            <div
              style={{
                width: '40%',
                height: 14,
                borderRadius: 4,
                background: 'var(--ux-surface-2)',
                opacity: 0.7,
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          height: 320,
          borderRadius: 'var(--ux-radius, 14px)',
          background: 'var(--ux-surface)',
          border: '1px solid var(--ux-line)',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 200,
            height: 20,
            borderRadius: 6,
            background: 'var(--ux-surface-2)',
            marginBottom: 20,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 44,
                borderRadius: 8,
                background: 'var(--ux-surface-2)',
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

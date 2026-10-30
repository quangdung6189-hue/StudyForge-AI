import Link from 'next/link';
import AnimateUIDemo from '@/components/animate-ui/AnimateUIDemo';

export const metadata = { title: 'Animate UI Demo · StudyForge AI' };

export default function AnimateTestPage() {
  return (
    <div className="ux" style={{ minHeight: '100vh', background: 'var(--ux-page)' }}>
      <nav
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 32px', maxWidth: 1200, margin: '0 auto',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', fontWeight: 800, color: 'var(--ux-ink)' }}>
          ← StudyForge AI
        </Link>
        <span style={{ fontSize: 13, color: 'var(--ux-ink-2)' }}>
          Demo Animate UI · subtle level · <code>/animate-test</code>
        </span>
      </nav>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
        <AnimateUIDemo />
      </main>
    </div>
  );
}
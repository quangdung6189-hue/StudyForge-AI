import { LucianSignIn } from '@/components/lucian/LucianSignIn';

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'radial-gradient(ellipse at 50% 20%, var(--ux-surface-2) 0%, var(--ux-page) 70%)',
      }}
    >
      <LucianSignIn />
    </div>
  );
}

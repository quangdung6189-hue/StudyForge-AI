import { requireUser } from '@/server/auth';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppHeader } from '@/components/layout/AppHeader';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect('/sign-in');
  }

  return (
    <div className="app-shell">
      <AppSidebar user={user} />
      <div className="app-main">
        <AppHeader />
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

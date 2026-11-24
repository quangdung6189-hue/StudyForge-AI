import { requireUser } from '@/server/auth';
import { listClassrooms } from '@/server/learning';
import { ClassesView } from './ClassesView';
import '../pages.css';

export const dynamic = 'force-dynamic';

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const user = await requireUser();
  const [data, query] = await Promise.all([listClassrooms(user.id), searchParams]);
  const canCreate = user.role === 'teacher' || user.role === 'admin';
  return <ClassesView initial={data} canCreate={canCreate} joinCode={(query.join ?? '').toUpperCase().slice(0, 12)} />;
}

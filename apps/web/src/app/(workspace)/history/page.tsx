import { requireUser } from '@/server/auth';
import { listAttemptHistory } from '@/server/learning';
import { HistoryView } from './HistoryView';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const user = await requireUser();
  const data = await listAttemptHistory(user.id);
  return <HistoryView data={data} />;
}

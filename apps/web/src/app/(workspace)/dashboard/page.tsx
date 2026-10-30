import { requireUser } from '@/server/auth';
import { listUserDocuments, listUserQuizzes } from '@/server/dal';
import { LucianDashboard } from '@/components/lucian/LucianDashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const [docsData, quizzes] = await Promise.all([
    listUserDocuments(user.id, 1, 50),
    listUserQuizzes(user.id),
  ]);

  return <LucianDashboard docs={docsData.items} quizzes={quizzes} />;
}


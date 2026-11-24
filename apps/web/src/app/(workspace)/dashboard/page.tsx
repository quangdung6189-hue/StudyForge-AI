import { requireUser } from '@/server/auth';
import { listUserDocuments, listUserQuizzes } from '@/server/data-access';
import { LucianDashboard } from '@/components/lucian/LucianDashboard';
import { myAssignments, studyStats } from '@/server/learning';

export const dynamic = 'force-dynamic';

/** Greeting computed on the server in Vietnam time, so server and client HTML always match. */
function greetingFor(date: Date) {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(date),
  );
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [docsData, quizzes, assignments, study] = await Promise.all([
    listUserDocuments(user.id, 1, 50),
    listUserQuizzes(user.id),
    myAssignments(user.id).catch(() => []),
    studyStats(user.id).catch(() => null),
  ]);

  return (
    <LucianDashboard
      docs={docsData.items}
      quizzes={quizzes}
      greeting={greetingFor(new Date())}
      userName={user.name}
      assignments={assignments}
      studyDue={study?.due ?? 0}
      streak={study?.streak ?? 0}
    />
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { quizAnalytics } from '@/server/learning';
import { AnalyticsView } from './AnalyticsView';
import '../../../pages.css';

export const dynamic = 'force-dynamic';

export default async function QuizAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  try {
    return <AnalyticsView data={await quizAnalytics(user.id, id)} />;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'NOT_FOUND') notFound();
    if (code !== 'CONFLICT') throw error;
    return (
      <div className="ux sf-page">
        <div className="sf-empty">
          <h2>Đề chưa xuất bản</h2>
          <p>Thống kê xuất hiện sau khi đề được xuất bản và có học sinh nộp bài.</p>
          <Link className="sf-pbtn primary" href={`/quizzes/create?quizId=${id}`}>Tiếp tục biên soạn</Link>
        </div>
      </div>
    );
  }
}

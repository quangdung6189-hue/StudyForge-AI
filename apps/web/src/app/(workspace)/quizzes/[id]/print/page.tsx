import { notFound } from 'next/navigation';
import { versionLayout } from '@studyforge/core';
import { requireUser } from '@/server/auth';
import { getOwnedQuiz } from '@/server/data-access';
import { MathText } from '@/components/common/MathText';
import { PrintControls } from './PrintControls';
import './print.css';
import '../../../pages.css';

export const dynamic = 'force-dynamic';
const L = (i: number) => String.fromCharCode(65 + i);

export default async function PrintQuizPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ versions?: string; key?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const versions = Math.max(1, Math.min(8, Number(query.versions) || 2));
  const withKey = query.key !== '0';
  let quiz;
  try { quiz = await getOwnedQuiz(user.id, id); } catch { notFound(); }
  const papers = Array.from({ length: versions }, (_, v) => ({ code: 101 + v, layout: versionLayout(quiz.questions, quiz.id, v) }));

  return (
    <div className="ux sf-page print-root">
      <PrintControls quizId={quiz.id} versions={versions} withKey={withKey} />
      {papers.map(paper => (
        <section key={paper.code} className="print-paper">
          <header className="print-head">
            <div><b>{quiz.title}</b><span>Thời gian: {quiz.durationMinutes >= 1440 ? 'không giới hạn' : `${quiz.durationMinutes} phút`} · {quiz.questions.length} câu</span></div>
            <div className="print-code">Mã đề <b>{paper.code}</b></div>
          </header>
          <p className="print-student">Họ và tên: ........................................................ Lớp: ............ SBD: ............</p>
          <ol className="print-questions">
            {paper.layout.map((item, index) => {
              const q = item.question;
              return (
                <li key={q.id} className="print-q">
                  <div className="print-stem"><b>Câu {index + 1}</b> <span>({q.points} đ)</span> <MathText text={q.stem} inline /></div>
                  {(q.type === 'single' || q.type === 'multiple') && (
                    <div className="print-options" data-cols={item.options.every(o => o.text.length <= 24) && item.options.length === 4 ? 4 : 2}>
                      {item.options.map((o, i) => <div key={o.id}><b>{L(i)}.</b> <MathText text={o.text} inline /></div>)}
                    </div>
                  )}
                  {q.type === 'boolean' && <div className="print-line">☐ Đúng &nbsp;&nbsp;&nbsp; ☐ Sai</div>}
                  {q.type === 'ordering' && (
                    <>
                      <div className="print-options" data-cols={1}>{item.options.map((o, i) => <div key={o.id}><b>{L(i)}.</b> <MathText text={o.text} inline /></div>)}</div>
                      <div className="print-line">Thứ tự đúng: ......................................</div>
                    </>
                  )}
                  {q.type === 'matching' && (
                    <div className="print-match">
                      <div>{item.left.map((o, i) => <div key={o.id}><b>{i + 1}.</b> <MathText text={o.text} inline /></div>)}</div>
                      <div>{item.right.map((o, i) => <div key={o.id}><b>{String.fromCharCode(97 + i)}.</b> <MathText text={o.text} inline /></div>)}</div>
                    </div>
                  )}
                  {(q.type === 'short' || q.type === 'fill') && <div className="print-line">Trả lời: ..............................................................................</div>}
                </li>
              );
            })}
          </ol>
          <p className="print-end">— HẾT —</p>
        </section>
      ))}
      {withKey && (
        <section className="print-paper print-keys">
          <h2>Đáp án các mã đề</h2>
          <div className="print-key-grid">
            {papers.map(paper => (
              <div key={paper.code}>
                <h3>Mã đề {paper.code}</h3>
                <table>
                  <tbody>
                    {paper.layout.map((item, index) => {
                      const q = item.question;
                      const key = q.type === 'single' || q.type === 'multiple'
                        ? item.options.map((o, i) => (q.correctOptionIds.includes(o.id) ? L(i) : '')).filter(Boolean).join(', ')
                        : q.type === 'boolean' ? q.options.find(o => q.correctOptionIds.includes(o.id))?.text ?? ''
                        : q.type === 'ordering' ? q.correctOptionIds.map(cid => L(item.options.findIndex(o => o.id === cid))).join('–')
                        : q.type === 'matching' ? (q.pairs ?? []).map(p => `${item.left.findIndex(o => o.id === p.leftId) + 1}-${String.fromCharCode(97 + item.right.findIndex(o => o.id === p.rightId))}`).join(', ')
                        : q.acceptedAnswers.join(' / ');
                      return <tr key={q.id}><td>Câu {index + 1}</td><td>{key}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

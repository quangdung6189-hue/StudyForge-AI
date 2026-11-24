'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { Histogram, RateMeter } from '@/components/charts/Charts';
import { MathText } from '@/components/common/MathText';
import { DIFFICULTY_LABELS, TYPE_LABELS, dateTime } from '@/lib/labels';

type Data = {
  quiz: { id: string; title: string; shareCode: string | null };
  summary: { students: number; submissions: number; mean: number; median: number; passRate: number; pendingReview: number };
  histogram: { from: number; to: number; count: number }[];
  questions: { index: number; id: string; type: string; difficulty: string; stem: string; points: number; options: { id: string; text: string; correct: boolean }[]; answer: string; responses: number; correctRate: number; discrimination: number | null; optionCounts: Record<string, number>; blank: number }[];
  students: { recordId: string; name: string; email: string; score: number; totalPoints: number; passed: boolean; submittedAt: string; credits: Record<string, number> }[];
};

/** Ebel's guideline for the discrimination index D. */
function quality(d: number | null) {
  if (d === null) return { q: 'none', label: 'Cần ≥ 4 bài' };
  if (d >= 0.4) return { q: 'good', label: 'Tốt' };
  if (d >= 0.3) return { q: 'ok', label: 'Khá' };
  if (d >= 0.2) return { q: 'weak', label: 'Cần xem lại' };
  return { q: 'bad', label: 'Kém' };
}

export function AnalyticsView({ data }: { data: Data }) {
  const [open, setOpen] = useState<string | null>(null);
  const { summary } = data;
  const hardest = [...data.questions].filter(q => q.responses).sort((a, b) => a.correctRate - b.correctRate)[0];
  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div>
          <span className="sf-page-eyebrow">THỐNG KÊ KẾT QUẢ</span>
          <h1>{data.quiz.title}</h1>
          <p>Mỗi học sinh tính theo lượt nộp gần nhất. {data.quiz.shareCode && <>Mã đề <span className="sf-code">{data.quiz.shareCode}</span>.</>}</p>
        </div>
        <div className="sf-page-actions">
          {summary.pendingReview > 0 && <Link className="sf-pbtn primary" href={`/quizzes/${data.quiz.id}/grading`}>Chấm {summary.pendingReview} câu trả lời ngắn</Link>}
          <a className="sf-pbtn" href={`/api/quizzes/${data.quiz.id}/analytics?format=csv`} download>Tải bảng điểm (Excel/CSV)</a>
          <Link className="sf-pbtn" href={`/quizzes/${data.quiz.id}/print`}>In đề & đáp án</Link>
        </div>
      </header>

      {!summary.students ? (
        <div className="sf-empty">
          <h2>Chưa có học sinh nộp bài</h2>
          <p>Gửi mã đề hoặc giao bài cho lớp. Kết quả và phân tích câu hỏi sẽ cập nhật ngay khi có bài nộp.</p>
          <Link className="sf-pbtn primary" href="/classes">Giao bài cho lớp</Link>
        </div>
      ) : (
        <>
          <div className="sf-tiles sf-stagger">
            <div className="sf-tile"><b><CountingNumber number={summary.students} /></b><span>Học sinh đã nộp</span></div>
            <div className="sf-tile"><b><CountingNumber number={summary.submissions} /></b><span>Tổng lượt nộp</span></div>
            <div className="sf-tile"><b><CountingNumber number={summary.mean} decimalPlaces={1} />%</b><span>Điểm trung bình</span></div>
            <div className="sf-tile"><b><CountingNumber number={summary.median} decimalPlaces={1} />%</b><span>Trung vị</span></div>
            <div className="sf-tile"><b><CountingNumber number={summary.passRate} decimalPlaces={1} />%</b><span>Tỉ lệ đạt (≥ 50%)</span></div>
          </div>

          <div className="sf-grid-2">
            <section className="sf-panel">
              <div className="sf-panel-head"><h2>Phân bố điểm</h2><small>Số học sinh theo khoảng % điểm</small></div>
              <Histogram ariaLabel="Biểu đồ phân bố điểm của lớp" bins={data.histogram} />
            </section>
            <section className="sf-panel">
              <div className="sf-panel-head"><h2>Đọc nhanh</h2></div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ux-ink-2)' }}>
                {hardest && <li>Câu khó nhất: <b>Câu {hardest.index}</b> — {Math.round(hardest.correctRate * 100)}% làm đúng.</li>}
                <li>{data.questions.filter(q => q.discrimination !== null && q.discrimination < 0.2).length} câu có độ phân biệt thấp (D &lt; 0.2) — nên xem lại đáp án hoặc cách hỏi.</li>
                <li>{data.questions.filter(q => q.responses && q.blank / q.responses >= 0.3).length} câu bị bỏ trống từ 30% trở lên.</li>
                <li>Độ phân biệt D = tỉ lệ đúng của 27% điểm cao nhất trừ 27% điểm thấp nhất.</li>
              </ul>
            </section>
          </div>

          <section className="sf-panel">
            <div className="sf-panel-head"><h2>Phân tích từng câu</h2><small>Nhấn vào một dòng để xem phương án được chọn</small></div>
            <div className="sf-table-wrap">
              <table className="sf-table">
                <thead><tr><th>Câu</th><th>Nội dung</th><th>Dạng</th><th>Mức độ</th><th className="num">Làm đúng</th><th className="num">Độ phân biệt</th><th className="num">Bỏ trống</th><th>Nhiễu chọn nhiều</th></tr></thead>
                <tbody>
                  {data.questions.map(q => {
                    const d = quality(q.discrimination);
                    const wrong = q.options.filter(o => !o.correct).map(o => ({ o, n: q.optionCounts[o.id] ?? 0 })).sort((a, b) => b.n - a.n)[0];
                    const wrongLetter = wrong ? String.fromCharCode(65 + q.options.findIndex(o => o.id === wrong.o.id)) : '';
                    return (
                      <Fragment key={q.id}>
                        <tr onClick={() => setOpen(open === q.id ? null : q.id)} style={{ cursor: 'pointer' }} aria-expanded={open === q.id}>
                          <td className="strong">{q.index}</td>
                          <td className="clip" title={q.stem}>{q.stem}</td>
                          <td>{TYPE_LABELS[q.type] ?? q.type}</td>
                          <td>{DIFFICULTY_LABELS[q.difficulty] ?? q.difficulty}</td>
                          <td className="num"><RateMeter value={q.correctRate} /> {Math.round(q.correctRate * 100)}%</td>
                          <td className="num">{q.discrimination === null ? '–' : q.discrimination.toFixed(2)} <span className="sf-dlabel" data-q={d.q}>{d.label}</span></td>
                          <td className="num">{q.blank}</td>
                          <td>{wrong && wrong.n > 0 ? `${wrongLetter} (${wrong.n})` : '–'}</td>
                        </tr>
                        {open === q.id && (
                          <tr>
                            <td colSpan={8} style={{ background: 'var(--ux-surface-2)' }}>
                              <div style={{ fontSize: 13.5, color: 'var(--ux-ink)', marginBottom: 8 }}><MathText text={q.stem} /></div>
                              {q.options.length > 0 && q.type !== 'matching' ? (
                                <div style={{ display: 'grid', gap: 6 }}>
                                  {q.options.map((o, i) => {
                                    const n = q.optionCounts[o.id] ?? 0;
                                    return (
                                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                                        <b style={{ width: 18 }}>{q.type === 'ordering' ? `${i + 1}.` : String.fromCharCode(65 + i)}</b>
                                        <span style={{ flex: 1 }}><MathText text={o.text} inline /></span>
                                        {o.correct && <span className="sf-badge" data-tone="good">Đáp án</span>}
                                        {q.type !== 'ordering' && <span className="num" style={{ minWidth: 90, textAlign: 'right' }}><RateMeter value={q.responses ? n / q.responses : 0} /> {n}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : <p className="sf-muted">Đáp án: {q.answer}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sf-panel">
            <div className="sf-panel-head"><h2>Bảng điểm học sinh</h2><small>{data.students.length} học sinh</small></div>
            <div className="sf-table-wrap">
              <table className="sf-table">
                <thead><tr><th>Họ tên</th><th>Email</th><th className="num">Điểm</th><th className="num">%</th><th>Nộp lúc</th><th>Kết quả</th></tr></thead>
                <tbody>
                  {[...data.students].sort((a, b) => b.score - a.score).map(s => (
                    <tr key={s.recordId}>
                      <td className="strong">{s.name}</td>
                      <td>{s.email}</td>
                      <td className="num">{s.score}/{s.totalPoints}</td>
                      <td className="num">{s.totalPoints ? Math.round((s.score / s.totalPoints) * 1000) / 10 : 0}%</td>
                      <td>{dateTime(s.submittedAt)}</td>
                      <td><span className="sf-badge" data-tone={s.passed ? 'good' : 'bad'}>{s.passed ? 'Đạt' : 'Chưa đạt'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

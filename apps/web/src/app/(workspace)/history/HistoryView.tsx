'use client';

import Link from 'next/link';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { ShareBars, TrendChart } from '@/components/charts/Charts';
import { DIFFICULTY_LABELS, TYPE_LABELS, dateTime, duration, shortDate } from '@/lib/labels';
import '../pages.css';

type Data = {
  items: { id: string; attemptId: string; quizTitle: string; shareCode: string | null; score: number; totalPoints: number; percent: number; passed: boolean; submittedAt: string; durationSec: number; pendingReview: boolean }[];
  byType: Record<string, { earned: number; total: number }>;
  byDifficulty: Record<string, { earned: number; total: number }>;
};

export function HistoryView({ data }: { data: Data }) {
  const items = data.items;
  const recent = items.slice(-30);
  const avg = items.length ? items.reduce((s, i) => s + i.percent, 0) / items.length : 0;
  const passRate = items.length ? (items.filter(i => i.passed).length / items.length) * 100 : 0;
  const last = items[items.length - 1];
  const prev = items[items.length - 2];
  const delta = last && prev ? Math.round((last.percent - prev.percent) * 10) / 10 : null;
  const toBars = (rec: Record<string, { earned: number; total: number }>, labels: Record<string, string>) =>
    Object.entries(rec).filter(([, v]) => v.total > 0).map(([k, v]) => ({ label: labels[k] ?? k, value: v.earned / v.total, detail: `${Math.round(v.earned * 100) / 100}/${Math.round(v.total * 100) / 100} điểm` }));
  const typeBars = toBars(data.byType, TYPE_LABELS).sort((a, b) => a.value - b.value);
  const levelBars = ['recognition', 'comprehension', 'application'].filter(k => data.byDifficulty[k]?.total).map(k => ({ label: DIFFICULTY_LABELS[k], value: data.byDifficulty[k].earned / data.byDifficulty[k].total, detail: `${Math.round(data.byDifficulty[k].earned * 100) / 100}/${Math.round(data.byDifficulty[k].total * 100) / 100} điểm` }));
  const weakest = typeBars[0];

  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div>
          <span className="sf-page-eyebrow">TIẾN BỘ HỌC TẬP</span>
          <h1>Bạn đang tiến bộ thế nào?</h1>
          <p>Mọi lượt nộp bài đều được lưu lại, kể cả khi làm lại — để thấy rõ xu hướng và phần cần ôn thêm.</p>
        </div>
        <Link href="/study" className="sf-pbtn primary">Ôn tập thẻ đến hạn →</Link>
      </header>

      {!items.length ? (
        <div className="sf-empty">
          <h2>Chưa có bài nộp nào</h2>
          <p>Vào phòng thi bằng mã giáo viên gửi, làm bài và nộp — kết quả sẽ xuất hiện ở đây.</p>
          <Link href="/quizzes/take" className="sf-pbtn primary">Vào phòng thi</Link>
        </div>
      ) : (
        <>
          <div className="sf-tiles sf-stagger">
            <div className="sf-tile"><b><CountingNumber number={items.length} /></b><span>Lượt đã nộp</span></div>
            <div className="sf-tile"><b><CountingNumber number={Math.round(avg)} />%</b><span>Điểm trung bình</span></div>
            <div className="sf-tile"><b><CountingNumber number={Math.round(passRate)} />%</b><span>Tỉ lệ đạt (≥ 50%)</span></div>
            <div className="sf-tile">
              <b>{Math.round(last.percent)}%</b>
              <span>Lần gần nhất{delta !== null && <em data-up={delta >= 0}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}</em>}</span>
            </div>
          </div>

          <section className="sf-panel">
            <div className="sf-panel-head"><h2>Điểm theo thời gian</h2><small>{recent.length} lượt gần nhất · % điểm mỗi lần nộp</small></div>
            <TrendChart ariaLabel="Biểu đồ phần trăm điểm theo thời gian" points={recent.map(i => ({ label: shortDate(i.submittedAt), value: i.percent, detail: i.quizTitle }))} />
          </section>

          <div className="sf-grid-2">
            <section className="sf-panel">
              <div className="sf-panel-head"><h2>Độ chính xác theo dạng câu</h2>{weakest && <small>Cần ôn nhất: {weakest.label}</small>}</div>
              {typeBars.length ? <ShareBars ariaLabel="Tỉ lệ điểm theo dạng câu" items={typeBars} /> : <p className="sf-muted">Chưa đủ dữ liệu.</p>}
            </section>
            <section className="sf-panel">
              <div className="sf-panel-head"><h2>Theo mức độ nhận thức</h2><small>Nhận biết → Vận dụng</small></div>
              {levelBars.length ? <ShareBars ariaLabel="Tỉ lệ điểm theo mức độ" items={levelBars} /> : <p className="sf-muted">Chưa đủ dữ liệu.</p>}
            </section>
          </div>

          <section className="sf-panel">
            <div className="sf-panel-head"><h2>Chi tiết từng lượt</h2><small>Mới nhất trước</small></div>
            <div className="sf-table-wrap">
              <table className="sf-table">
                <thead><tr><th>Đề thi</th><th>Nộp lúc</th><th className="num">Điểm</th><th className="num">%</th><th>Thời gian</th><th>Kết quả</th><th aria-label="Thao tác" /></tr></thead>
                <tbody>
                  {[...items].reverse().map(i => (
                    <tr key={i.id}>
                      <td className="strong">{i.quizTitle}</td>
                      <td>{dateTime(i.submittedAt)}</td>
                      <td className="num">{i.score}/{i.totalPoints}</td>
                      <td className="num">{i.percent}%</td>
                      <td>{duration(i.durationSec)}</td>
                      <td><span className="sf-badge" data-tone={i.passed ? 'good' : 'bad'}>{i.passed ? 'Đạt' : 'Chưa đạt'}</span>{i.pendingReview && <span className="sf-badge" data-tone="warn">Chờ chấm</span>}</td>
                      <td>{i.shareCode && <Link className="sf-link" href={`/quizzes/take?code=${i.shareCode}`}>Mở đề</Link>}</td>
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

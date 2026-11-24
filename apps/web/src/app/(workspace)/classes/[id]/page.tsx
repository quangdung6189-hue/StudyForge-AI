'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, use, useCallback, useEffect, useState } from 'react';
import { useFeedback } from '@/components/ui/Feedback';
import { QrCode } from '@/components/ui/ShareDialog';
import { dateTime } from '@/lib/labels';
import '../../pages.css';

type Result = { userId: string; score: number | null; totalPoints: number | null; submittedAt: string | null; late: boolean };
type OwnerView = {
  role: 'owner'; id: string; name: string; joinCode: string; teacher: string;
  members: { id: string; name: string; email: string; joinedAt: string }[];
  assignments: { id: string; quizId: string; title: string; shareCode: string | null; isPublished: boolean; dueAt: string | null; note: string; submitted: number; members: number; averagePercent: number | null; results: Result[] }[];
};
type MemberView = {
  role: 'member'; id: string; name: string; teacher: string;
  assignments: { id: string; title: string; shareCode: string | null; durationMinutes: number; dueAt: string | null; note: string; status: 'done' | 'todo' | 'overdue'; score: number | null; totalPoints: number | null; submittedAt: string | null }[];
};
type Quiz = { id: string; title: string; isPublished: boolean };

/** <input type="datetime-local"> value (local time) → ISO string. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState<OwnerView | MemberView | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [form, setForm] = useState({ quizId: '', dueAt: '', note: '' });
  const [openResults, setOpenResults] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/classes/${id}`);
    const body = await res.json();
    if (!res.ok) { toast(body.error?.message || 'Không mở được lớp.', 'danger'); router.replace('/classes'); return; }
    setData(body);
    if (body.role === 'owner') fetch('/api/quizzes').then(r => r.json()).then(q => setQuizzes((q.items ?? []).filter((x: Quiz) => x.isPublished))).catch(() => {});
  }, [id, router, toast]);
  useEffect(() => { setOrigin(window.location.origin); void load(); }, [load]);

  const api = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error?.message || 'Thao tác chưa thành công.');
    return body;
  };
  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.quizId || busy) return;
    setBusy(true);
    try {
      await api(`/api/classes/${id}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizId: form.quizId, dueAt: toIso(form.dueAt), note: form.note }) });
      toast('Đã giao bài cho lớp.', 'success');
      setForm({ quizId: '', dueAt: '', note: '' });
      await load();
    } catch (err) { toast((err as Error).message, 'danger'); }
    finally { setBusy(false); }
  };
  const unassign = async (assignmentId: string, title: string) => {
    if (!(await confirm({ title: 'Gỡ bài khỏi lớp?', message: `“${title}” sẽ không còn hiện trong danh sách bài được giao. Kết quả đã nộp vẫn được giữ.`, confirmLabel: 'Gỡ bài', tone: 'danger' }))) return;
    try { await api(`/api/classes/${id}/assignments?assignmentId=${assignmentId}`, { method: 'DELETE' }); await load(); }
    catch (err) { toast((err as Error).message, 'danger'); }
  };
  const removeMember = async (userId: string, name: string, self = false) => {
    if (!(await confirm({ title: self ? 'Rời lớp này?' : `Xoá ${name} khỏi lớp?`, message: self ? 'Bạn có thể tham gia lại bằng mã lớp.' : 'Học sinh có thể tham gia lại bằng mã lớp. Kết quả đã nộp vẫn được giữ.', confirmLabel: self ? 'Rời lớp' : 'Xoá', tone: 'danger' }))) return;
    try {
      await api(`/api/classes/${id}/members${self ? '' : `?userId=${userId}`}`, { method: 'DELETE' });
      if (self) { toast('Đã rời lớp.', 'success'); router.push('/classes'); } else await load();
    } catch (err) { toast((err as Error).message, 'danger'); }
  };
  const deleteClass = async () => {
    if (!data || !(await confirm({ title: `Xoá lớp ${data.name}?`, message: 'Danh sách học sinh và bài giao của lớp sẽ bị xoá. Đề thi và kết quả nộp bài vẫn được giữ trong ngân hàng.', confirmLabel: 'Xoá lớp', tone: 'danger' }))) return;
    try { await api(`/api/classes/${id}`, { method: 'DELETE' }); toast('Đã xoá lớp.', 'success'); router.push('/classes'); }
    catch (err) { toast((err as Error).message, 'danger'); }
  };

  if (!data) return <div className="ux sf-page"><div className="sf-skel" style={{ height: 120, borderRadius: 20 }} /><div className="sf-skel" style={{ height: 280, borderRadius: 20 }} /></div>;

  if (data.role === 'member') {
    return (
      <div className="ux sf-page">
        <header className="sf-page-head">
          <div><span className="sf-page-eyebrow">LỚP HỌC</span><h1>{data.name}</h1><p>Giáo viên: {data.teacher}</p></div>
          <button type="button" className="sf-pbtn danger" onClick={() => void removeMember('', '', true)}>Rời lớp</button>
        </header>
        <section className="sf-panel">
          <div className="sf-panel-head"><h2>Bài được giao</h2><small>{data.assignments.filter(a => a.status !== 'done').length} bài chưa làm</small></div>
          {data.assignments.length ? (
            <div className="sf-table-wrap">
              <table className="sf-table">
                <thead><tr><th>Bài</th><th>Hạn nộp</th><th>Trạng thái</th><th className="num">Điểm</th><th aria-label="Thao tác" /></tr></thead>
                <tbody>
                  {data.assignments.map(a => (
                    <tr key={a.id}>
                      <td className="strong">{a.title}{a.note && <div className="sf-muted" style={{ fontWeight: 500 }}>{a.note}</div>}</td>
                      <td>{a.dueAt ? dateTime(a.dueAt) : 'Không giới hạn'}</td>
                      <td><span className="sf-badge" data-tone={a.status === 'done' ? 'good' : a.status === 'overdue' ? 'bad' : 'warn'}>{a.status === 'done' ? 'Đã nộp' : a.status === 'overdue' ? 'Quá hạn' : 'Chưa làm'}</span></td>
                      <td className="num">{a.score !== null ? `${a.score}/${a.totalPoints}` : '–'}</td>
                      <td>{a.shareCode && <Link className={`sf-pbtn sm${a.status === 'done' ? '' : ' primary'}`} href={`/quizzes/take?code=${a.shareCode}`}>{a.status === 'done' ? 'Xem lại' : 'Làm bài'}</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="sf-muted">Giáo viên chưa giao bài nào.</p>}
        </section>
      </div>
    );
  }

  const joinLink = origin ? `${origin}/classes?join=${data.joinCode}` : '';
  const memberName = new Map(data.members.map(m => [m.id, m.name]));
  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div><span className="sf-page-eyebrow">LỚP HỌC · GIÁO VIÊN</span><h1>{data.name}</h1><p>{data.members.length} học sinh · {data.assignments.length} bài đã giao</p></div>
        <button type="button" className="sf-pbtn danger" onClick={() => void deleteClass()}>Xoá lớp</button>
      </header>

      <div className="sf-grid-2">
        <section className="sf-panel" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ padding: 8, background: '#fff', borderRadius: 14, border: '1px solid var(--ux-line)' }}>{joinLink ? <QrCode value={joinLink} size={132} label={`Mã QR tham gia lớp ${data.joinCode}`} /> : <div className="sf-skel" style={{ width: 132, height: 132 }} />}</div>
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <small className="sf-muted">Mã tham gia lớp</small>
            <button type="button" className="sf-code" style={{ fontSize: 26, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => void navigator.clipboard.writeText(data.joinCode).then(() => toast('Đã sao chép mã lớp.', 'success'))}>{data.joinCode}</button>
            <small className="sf-muted">Học sinh quét QR hoặc nhập mã ở trang Lớp học.</small>
            <button type="button" className="sf-pbtn sm" style={{ justifySelf: 'start' }} onClick={() => void navigator.clipboard.writeText(joinLink).then(() => toast('Đã sao chép đường dẫn mời.', 'success'))}>Sao chép link mời</button>
          </div>
        </section>
        <form className="sf-panel" onSubmit={assign}>
          <div className="sf-panel-head"><h2>Giao bài mới</h2><small>Chỉ đề đã xuất bản</small></div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label className="sf-field">Đề thi
              <select className="sf-input" value={form.quizId} onChange={e => setForm(f => ({ ...f, quizId: e.target.value }))}>
                <option value="">{quizzes.length ? 'Chọn đề…' : 'Chưa có đề đã xuất bản'}</option>
                {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </label>
            <div className="sf-row">
              <label className="sf-field">Hạn nộp (tuỳ chọn)<input className="sf-input" type="datetime-local" value={form.dueAt} onChange={e => setForm(f => ({ ...f, dueAt: e.target.value }))} /></label>
              <label className="sf-field">Lời nhắn<input className="sf-input" maxLength={500} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="VD: Làm trước buổi học thứ 5" /></label>
            </div>
            <button type="submit" className="sf-pbtn primary" disabled={!form.quizId || busy} style={{ justifySelf: 'start' }}>{busy ? 'Đang giao…' : 'Giao cho lớp'}</button>
          </div>
        </form>
      </div>

      <section className="sf-panel">
        <div className="sf-panel-head"><h2>Bài đã giao</h2><small>Nhấn “Kết quả” để xem từng học sinh</small></div>
        {data.assignments.length ? (
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead><tr><th>Đề</th><th>Hạn nộp</th><th className="num">Đã nộp</th><th className="num">TB lớp</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>
                {data.assignments.map(a => (
                  <Fragment key={a.id}>
                    <tr>
                      <td className="strong">{a.title}{a.shareCode && <> · <span className="sf-code" style={{ fontSize: 12 }}>{a.shareCode}</span></>}</td>
                      <td>{a.dueAt ? dateTime(a.dueAt) : 'Không giới hạn'}</td>
                      <td className="num">{a.submitted}/{a.members}</td>
                      <td className="num">{a.averagePercent === null ? '–' : `${a.averagePercent}%`}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="sf-pbtn sm" aria-expanded={openResults === a.id} onClick={() => setOpenResults(openResults === a.id ? null : a.id)}>Kết quả</button>{' '}
                        <Link className="sf-pbtn sm" href={`/quizzes/${a.quizId}/analytics`}>Thống kê</Link>{' '}
                        <button type="button" className="sf-pbtn sm danger" onClick={() => void unassign(a.id, a.title)}>Gỡ</button>
                      </td>
                    </tr>
                    {openResults === a.id && (
                      <tr>
                        <td colSpan={5} style={{ background: 'var(--ux-surface-2)' }}>
                          {a.results.length ? a.results.map(r => (
                            <div key={r.userId} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                              <b style={{ flex: 1 }}>{memberName.get(r.userId)}</b>
                              {r.submittedAt ? <><span className="num">{r.score}/{r.totalPoints}</span><span className="sf-muted">{dateTime(r.submittedAt)}</span>{r.late && <span className="sf-badge" data-tone="warn">Nộp muộn</span>}</> : <span className="sf-badge" data-tone="bad">Chưa nộp</span>}
                            </div>
                          )) : <p className="sf-muted">Lớp chưa có học sinh.</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="sf-muted">Chưa giao bài nào.</p>}
      </section>

      <section className="sf-panel">
        <div className="sf-panel-head"><h2>Học sinh</h2><small>{data.members.length} thành viên</small></div>
        {data.members.length ? (
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead><tr><th>Họ tên</th><th>Email</th><th>Tham gia</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>
                {data.members.map(m => (
                  <tr key={m.id}><td className="strong">{m.name}</td><td>{m.email}</td><td>{dateTime(m.joinedAt)}</td><td><button type="button" className="sf-pbtn sm danger" onClick={() => void removeMember(m.id, m.name)}>Xoá</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="sf-muted">Gửi mã lớp hoặc QR cho học sinh để các em tham gia.</p>}
      </section>
    </div>
  );
}

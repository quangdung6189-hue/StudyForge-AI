'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFeedback } from '@/components/ui/Feedback';

type Data = {
  owned: { id: string; name: string; joinCode: string; members: number; assignments: number; createdAt: string }[];
  joined: { id: string; name: string; teacher: string; assignments: number; joinedAt: string }[];
};

export function ClassesView({ initial, canCreate, joinCode }: { initial: Data; canCreate: boolean; joinCode: string }) {
  const router = useRouter();
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [code, setCode] = useState(joinCode);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  const call = async (url: string, body: object) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Thao tác chưa thành công.');
    return data;
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy('create');
    try {
      const c = await call('/api/classes', { name });
      toast(`Đã tạo lớp ${c.name}. Mã mời: ${c.joinCode}`, 'success');
      router.push(`/classes/${c.id}`);
    } catch (err) { toast((err as Error).message, 'danger'); setBusy(null); }
  };
  const join = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || busy) return;
    setBusy('join');
    try {
      const c = await call('/api/classes/join', { code });
      toast(`Đã tham gia lớp ${c.name}.`, 'success');
      router.push(`/classes/${c.id}`);
    } catch (err) { toast((err as Error).message, 'danger'); setBusy(null); }
  };

  return (
    <div className="ux sf-page">
      <header className="sf-page-head">
        <div>
          <span className="sf-page-eyebrow">LỚP HỌC</span>
          <h1>Lớp học & bài được giao</h1>
          <p>Giáo viên tạo lớp và giao đề có hạn nộp. Học sinh tham gia bằng mã 6 ký tự hoặc quét QR, rồi thấy ngay bài cần làm.</p>
        </div>
      </header>

      <div className="sf-grid-2">
        <form className="sf-panel" onSubmit={join}>
          <div className="sf-panel-head"><h2>Tham gia lớp</h2><small>Nhập mã giáo viên gửi</small></div>
          <div className="sf-row">
            <label className="sf-field">Mã lớp
              <input className="sf-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="VD: K7M2QA" maxLength={12} autoComplete="off" spellCheck={false} style={{ letterSpacing: '.18em', fontWeight: 800, textTransform: 'uppercase' }} />
            </label>
            <button type="submit" className="sf-pbtn primary" disabled={!code.trim() || busy !== null}>{busy === 'join' ? 'Đang tham gia…' : 'Tham gia'}</button>
          </div>
        </form>
        {canCreate ? (
          <form className="sf-panel" onSubmit={create}>
            <div className="sf-panel-head"><h2>Tạo lớp mới</h2><small>Dành cho giáo viên</small></div>
            <div className="sf-row">
              <label className="sf-field">Tên lớp
                <input className="sf-input" value={name} onChange={e => setName(e.target.value)} placeholder="VD: 12A1 · Hoá học" maxLength={120} />
              </label>
              <button type="submit" className="sf-pbtn primary" disabled={!name.trim() || busy !== null}>{busy === 'create' ? 'Đang tạo…' : 'Tạo lớp'}</button>
            </div>
          </form>
        ) : (
          <div className="sf-panel">
            <div className="sf-panel-head"><h2>Bạn là học sinh</h2></div>
            <p className="sf-muted">Tài khoản giáo viên mới tạo được lớp. Hãy xin mã lớp từ giáo viên của bạn.</p>
          </div>
        )}
      </div>

      {initial.owned.length > 0 && (
        <section>
          <div className="sf-panel-head"><h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Lớp bạn phụ trách</h2></div>
          <div className="sf-cards sf-stagger">
            {initial.owned.map(c => (
              <Link key={c.id} href={`/classes/${c.id}`} className="sf-card sf-spot">
                <span className="sf-badge" data-tone="accent" style={{ alignSelf: 'flex-start' }}>Giáo viên</span>
                <h3>{c.name}</h3>
                <div className="sf-card-meta"><span>{c.members} học sinh</span><span>{c.assignments} bài đã giao</span><span>Mã <span className="sf-code" style={{ fontSize: 12 }}>{c.joinCode}</span></span></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="sf-panel-head"><h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Lớp bạn tham gia</h2></div>
        {initial.joined.length ? (
          <div className="sf-cards sf-stagger">
            {initial.joined.map(c => (
              <Link key={c.id} href={`/classes/${c.id}`} className="sf-card sf-spot">
                <h3>{c.name}</h3>
                <p>Giáo viên: {c.teacher}</p>
                <div className="sf-card-meta"><span>{c.assignments} bài được giao</span></div>
              </Link>
            ))}
          </div>
        ) : <p className="sf-muted">Bạn chưa tham gia lớp nào.</p>}
      </section>
    </div>
  );
}

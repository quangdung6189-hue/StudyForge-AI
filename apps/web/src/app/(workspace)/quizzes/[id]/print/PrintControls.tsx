'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function PrintControls({ quizId, versions, withKey }: { quizId: string; versions: number; withKey: boolean }) {
  const router = useRouter();
  const go = (v: number, k: boolean) => router.replace(`/quizzes/${quizId}/print?versions=${v}&key=${k ? 1 : 0}`);
  return (
    <div className="print-controls sf-panel">
      <div className="sf-row">
        <label className="sf-field" style={{ maxWidth: 180 }}>Số mã đề
          <select className="sf-input" value={versions} onChange={e => go(Number(e.target.value), withKey)}>
            {[1, 2, 3, 4, 6, 8].map(n => <option key={n} value={n}>{n} mã đề</option>)}
          </select>
        </label>
        <label className="sf-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 'none', minWidth: 0, height: 40 }}>
          <input type="checkbox" checked={withKey} onChange={e => go(versions, e.target.checked)} /> Kèm trang đáp án
        </label>
        <span style={{ flex: 1 }} />
        <Link className="sf-pbtn" href="/quizzes">← Ngân hàng đề</Link>
        <a className="sf-pbtn" href={`/api/quizzes/${quizId}/export?versions=${versions}&key=${withKey ? 1 : 0}`} download>Tải Word (.docx)</a>
        <button type="button" className="sf-pbtn primary" onClick={() => window.print()}>In / Lưu PDF</button>
      </div>
      <p className="sf-muted" style={{ marginTop: 10 }}>Mỗi mã đề xáo trộn thứ tự câu và phương án theo cách cố định — in lại vẫn ra đúng đề cũ. Chọn “Lưu dưới dạng PDF” trong hộp thoại in để xuất PDF.</p>
    </div>
  );
}

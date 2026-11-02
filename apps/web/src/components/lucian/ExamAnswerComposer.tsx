// Lucian UX/UI Prompt #028 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#028
'use client';
import { useEffect, useId, useRef, useState } from 'react';

export function ExamAnswerComposer({ value, onChange, label, manual, invalid, describedBy }: {
  value: string; onChange: (value: string) => void; label: string; manual: boolean; invalid: boolean; describedBy?: string;
}) {
  const [local, setLocal] = useState(value), input = useRef<HTMLTextAreaElement>(null), focused = useRef(false), id = useId();
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  useEffect(() => {
    const ta = input.current; if (!ta) return;
    const grow = () => {
      const height = ta.style.height; ta.style.transition = 'none'; ta.style.height = '24px';
      const need = Math.min(144, ta.scrollHeight);
      ta.style.height = height || '24px'; void ta.offsetHeight; ta.style.transition = ''; ta.style.height = `${need}px`;
      ta.style.overflowY = ta.scrollHeight > 144 ? 'auto' : 'hidden';
    };
    grow(); const observer = new ResizeObserver(grow); if (ta.parentElement) observer.observe(ta.parentElement);
    return () => observer.disconnect();
  }, [local]);
  const count = manual ? Array.from(local).length : Math.max(0, ...local.split('|').map(answer => answer.trim().length));
  const limit = manual ? 250000 : 4000, remaining = limit - count;
  return <div className={`exam-answer-composer${remaining <= 20 ? ' is-near' : ''}${remaining < 0 ? ' is-over' : ''}`}>
    <label htmlFor={id}>{manual ? 'Đáp án mẫu / hướng dẫn chấm' : 'Đáp án chấp nhận'}</label>
    <p id={`${id}-hint`}>{manual ? 'Giữ nguyên xuống dòng, các ý a/b/c và ký hiệu. Câu này chưa đưa vào chấm tự động.' : 'Các cách trả lời tương đương ngăn bằng |. Giữ nguyên phân số, đơn vị và xuống dòng.'}</p>
    <div className="exam-composer-box">
      <textarea id={id} ref={input} aria-label={label} aria-invalid={invalid || remaining < 0} aria-describedby={`${id}-hint ${describedBy ?? ''}`} rows={1} value={local}
        onFocus={() => { focused.current = true; }} onChange={event => { setLocal(event.target.value); onChange(event.target.value); }} onBlur={() => { focused.current = false; }}
        placeholder={manual ? 'Bài làm mẫu đã đối chiếu nguồn…' : 'Nhập đáp án, ví dụ: 1/2 | 0,5'}/>
      <div className="exam-composer-foot"><span>{manual ? 'Bản nháp · chấm tay' : 'Chấm theo đáp án · giáo viên cần duyệt'}</span><span className="exam-composer-ring" aria-hidden="true"><svg viewBox="0 0 30 30"><circle className="bg" cx="15" cy="15" r="12"/><circle className="fg" cx="15" cy="15" r="12" style={{ strokeDashoffset: 75.4 * (1 - Math.min(1, count / limit)) }}/></svg></span><small>{count.toLocaleString('vi')}{!manual && ' / 4.000'}</small></div>
    </div>
  </div>;
}
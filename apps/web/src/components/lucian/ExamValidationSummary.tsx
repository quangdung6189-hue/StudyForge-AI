// Lucian UX/UI Prompt #244 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#244
'use client';
import type { ExamQuestion } from '@/lib/exam-code';
import { questionReview } from '@/lib/exam-review';

export function ExamValidationSummary({ questions, open, onJump, onClose }: {
  questions: ExamQuestion[]; open: boolean; onJump: (question: ExamQuestion) => void; onClose: () => void;
}) {
  const blocked = questions.filter(q => questionReview(q).status !== 'ready');
  return <div className={`exam-validation${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
    <div><section className="exam-validation-box" data-manual-only={blocked.length > 0 && blocked.every(q => questionReview(q).status === 'manual')} role={open ? 'alert' : undefined} aria-label="Kết quả kiểm tra đề">
      <header><div><b><i aria-hidden="true">!</i>{blocked.length ? `${blocked.length} câu cần xử lý trước khi duyệt toàn bộ` : 'Đã xử lý các mục được đánh dấu'}</b><p>Có đáp án không đồng nghĩa đã sẵn sàng: kiểm tra dạng chấm, cấu trúc và căn cứ riêng.</p></div><button type="button" aria-label="Đóng kết quả kiểm tra" onClick={onClose}>×</button></header>
      <ul>{blocked.map(q => { const review = questionReview(q); return <li key={q.id} data-status={review.status}><button type="button" onClick={() => onJump(q)}><span>Câu {q.number}<small>#{q.globalIndex} · {q.group || 'Chưa phân phần'}</small></span><span>{review.label}<small>{review.manual ? `${review.answerPresent ? 'Đã có đáp án mẫu. ' : ''}Giữ nháp, chuyển dạng phù hợp hoặc duyệt riêng phần tự động.` : review.errors[0]?.message}</small></span><span aria-hidden="true">↗</span></button></li>; })}</ul>
      {!blocked.length && <p>Các câu chấm tự động đã đủ dữ liệu. Tiếp tục sang bước giáo viên duyệt.</p>}
    </section></div>
  </div>;
}
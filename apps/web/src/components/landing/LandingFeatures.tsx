// StudyForge features & workflow — Editorial Swiss Bento (Lucian #214) + 3-Step Workflow + Calm CTA Banner
import React from 'react';
import Link from 'next/link';
import { LandingBento } from './LandingBento';

const WORKFLOW = [
  {
    num: '01',
    step: 'Bước 1',
    title: 'Tải tài liệu hoặc dán đề sẵn có',
    desc: 'Chọn file PDF, Word, văn bản hoặc ảnh chụp đề giấy. Hệ thống tự động giữ cấu trúc phần, bảng biểu và công thức khoa học.',
  },
  {
    num: '02',
    step: 'Bước 2',
    title: 'Kiểm tra, biên soạn & duyệt đáp án',
    desc: 'Chỉnh sửa trực quan, chèn nhanh ký tự Toán – Lý – Hóa – Sinh và đối chiếu từng câu hỏi với đoạn trích dẫn trong tài liệu gốc.',
  },
  {
    num: '03',
    step: 'Bước 3',
    title: 'Phát hành mã phòng thi & ôn luyện',
    desc: 'Chia sẻ mã phòng ngắn gọn để học sinh vào làm bài ngay, chấm điểm tức thì và tự động lưu câu sai thành thẻ ôn tập.',
  },
];

export function LandingFeatures() {
  return (
    <div className="sf-sections-wrap">
      <section className="sf-features-section" aria-labelledby="sf-features-heading">
        <div className="sf-section-head">
          <span className="sf-eyebrow">NỀN TẢNG KHẢO THÍ THÔNG MINH</span>
          <h2 id="sf-features-heading">Tối giản trên bề mặt, chính xác ở từng chi tiết</h2>
          <p>
            Di chuột hoặc dùng phím Tab vào từng khối tính năng bên dưới để xem cách StudyForge AI
            xử lý đề thi chuẩn hóa.
          </p>
        </div>

        <LandingBento />
      </section>

      <section id="quy-trinh" className="sf-workflow-section" aria-labelledby="sf-workflow-heading">
        <div className="sf-section-head">
          <span className="sf-eyebrow">QUY TRÌNH 3 BƯỚC</span>
          <h2 id="sf-workflow-heading">Gọn gàng, dễ tiếp cận cho cả giáo viên và học sinh</h2>
          <p>Không cần cài đặt phức tạp — mọi thao tác từ tải tài liệu đến chấm bài diễn ra trên cùng một không gian.</p>
        </div>

        <ol className="sf-workflow-grid">
          {WORKFLOW.map((item) => (
            <li key={item.num} className="sf-workflow-item sf-spot sf-reveal">
              <div className="sf-workflow-top">
                <span className="sf-workflow-badge">{item.step}</span>
                <span className="sf-workflow-num" aria-hidden="true">{item.num}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="sf-cta-banner sf-reveal" aria-labelledby="sf-cta-heading">
        <div className="sf-cta-banner-inner">
          <div className="sf-cta-copy">
            <span className="sf-eyebrow">SẴN SÀNG BẮT ĐẦU</span>
            <h2 id="sf-cta-heading">Chuẩn hóa bộ tài liệu học tập của bạn ngay hôm nay</h2>
            <p>
              Đăng nhập để tải tài liệu đầu tiên hoặc nhập mã phòng thi từ giáo viên để bắt đầu làm bài.
            </p>
          </div>
          <div className="sf-cta-banner-actions">
            <Link href="/sign-in" className="sf-btn sf-btn-primary sf-btn-md">
              Tạo tài khoản / Đăng nhập
            </Link>
            <Link href="/quizzes/take" className="sf-btn sf-btn-ghost sf-btn-md">
              Vào phòng thi
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

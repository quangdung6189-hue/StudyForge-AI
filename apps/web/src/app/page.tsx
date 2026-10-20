import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="ux" style={{ minHeight: '100vh', background: 'var(--ux-page)' }}>
      <style>{`
        .landing-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .landing-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }
        .landing-logo {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--ux-grad);
          color: white;
          font-weight: 800;
          font-size: 20px;
          display: grid;
          place-items: center;
          box-shadow: 0 8px 20px var(--ux-shadow);
        }
        .landing-brand-text {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
        }
        .landing-actions {
          display: flex;
          gap: 12px;
        }
        .btn-outline {
          padding: 10px 20px;
          border-radius: 999px;
          border: 1px solid var(--ux-line-2);
          background: var(--ux-surface);
          color: var(--ux-ink);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          transition: background-color .2s;
        }
        .btn-primary {
          padding: 10px 24px;
          border-radius: 999px;
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 4px 14px var(--ux-shadow);
          transition: filter .2s;
        }
        .hero {
          max-width: 1000px;
          margin: 60px auto 40px;
          text-align: center;
          padding: 0 24px;
        }
        .hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 999px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 2px 8px var(--ux-shadow);
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-accent);
          margin-bottom: 24px;
        }
        .hero-title {
          font-size: 52px;
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: var(--ux-ink);
          margin: 0 0 20px;
        }
        .hero-title span {
          background: var(--ux-grad);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-subtitle {
          font-size: 20px;
          color: var(--ux-ink-2);
          max-width: 680px;
          margin: 0 auto 36px;
          line-height: 1.6;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          max-width: 1100px;
          margin: 60px auto;
          padding: 0 24px;
        }
        .feature-card {
          padding: 32px;
          border-radius: 24px;
          background: var(--ux-surface);
          border: 1px solid var(--ux-line);
          box-shadow: 0 10px 30px var(--ux-shadow);
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-align: left;
        }
        .feature-icon {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          background: var(--ux-accent-soft);
          color: var(--ux-accent);
          font-size: 24px;
          display: grid;
          place-items: center;
        }
        .feature-title {
          font-size: 18px;
          font-weight: 800;
          color: var(--ux-ink);
        }
        .feature-desc {
          font-size: 14px;
          color: var(--ux-ink-2);
          line-height: 1.6;
        }
        .demo-box {
          max-width: 680px;
          margin: 40px auto 80px;
          padding: 24px 32px;
          border-radius: 20px;
          background: var(--ux-surface-2);
          border: 1px dashed var(--ux-accent);
          text-align: left;
        }
      `}</style>

      <nav className="landing-nav">
        <Link href="/" className="landing-brand">
          <div className="landing-logo">SF</div>
          <span className="landing-brand-text">StudyForge AI</span>
        </Link>
        <div className="landing-actions">
          <Link href="/sign-in" className="btn-outline">Đăng nhập</Link>
          <Link href="/sign-in" className="btn-primary">Dùng thử ngay</Link>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-pill">
            <span>✨ AI Khảo thí & Ôn luyện thế hệ mới</span>
          </div>
          <h1 className="hero-title">
            Biến tài liệu học tập thành <span>cách học của bạn</span>
          </h1>
          <p className="hero-subtitle">
            Tự động chuyển đổi file PDF, Word (DOCX) và sách scan thành ngân hàng câu hỏi, đề thi chuẩn hoá có đối chiếu trích dẫn nguồn và bộ ôn luyện thông minh.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/sign-in" className="btn-primary" style={{ padding: '14px 36px', fontSize: '16px' }}>
              Bắt đầu tạo bài thi
            </Link>
            <Link href="/quizzes/take" className="btn-outline" style={{ padding: '14px 30px', fontSize: '16px' }}>
              Vào phòng thi qua mã
            </Link>
          </div>

          <div className="demo-box">
            <b style={{ color: 'var(--ux-accent)', display: 'block', marginBottom: '8px' }}>
              💡 Tài khoản mẫu để kiểm tra ngay lập tức:
            </b>
            <div style={{ fontSize: '14px', lineHeight: 1.8 }}>
              • <b>Giáo viên:</b> <code>giaovien@studyforge.vn</code> / Mật khẩu: <code>GiaoVien2026!</code><br />
              • <b>Học sinh:</b> <code>hocsinh@studyforge.vn</code> / Mật khẩu: <code>HocSinh2026!</code><br />
              • <b>Mã đề thi mẫu:</b> <code>SINHHOC8DEMO</code> (Sinh học 8: Cấu tạo tế bào)
            </div>
          </div>
        </section>

        <section className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📁</div>
            <div className="feature-title">Trích xuất đa định dạng</div>
            <div className="feature-desc">
              Hỗ trợ kéo thả PDF, DOCX, TXT. Giữ nguyên công thức, bảng biểu và dấu tiếng Việt chuẩn Unicode NFC.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <div className="feature-title">Căn cứ & Dẫn nguồn chuẩn xác</div>
            <div className="feature-desc">
              Phân biệt rõ ràng đáp án gốc trong tài liệu với đáp án AI đề xuất. Mọi câu hỏi đều có liên kết đối chiếu (sourceRefs) với đoạn trích.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⏱️</div>
            <div className="feature-title">Phòng thi bảo mật cao</div>
            <div className="feature-desc">
              Đảo phương án theo seed từng thí sinh, tự động lưu câu trả lời vào máy chủ, kiểm soát hạn chót tuyệt đối và không để lộ đáp án trước khi nộp.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

import Link from 'next/link';
import './auth-page.css';
import { LucianSignIn } from '@/components/lucian/LucianSignIn';
import { LucianThemeSwitch } from '@/components/lucian/LucianThemeSwitch';
import { MathText } from '@/components/common/MathText';
import { getSessionUser } from '@/server/auth';
import { isGoogleAuthConfigured } from '@/server/google-oauth';

const googleErrors: Record<string, string> = {
  not_configured: 'Đăng nhập Google hiện chưa khả dụng. Bạn vẫn có thể dùng email và mật khẩu.',
  invalid_state: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
  cancelled: 'Bạn đã hủy đăng nhập Google.',
  invalid_identity: 'Không thể xác minh tài khoản Google. Vui lòng thử lại.',
  account_exists: 'Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu, rồi quay lại đây để liên kết Google.',
  link_failed: 'Không thể liên kết. Hãy đăng nhập tài khoản hiện tại và chọn Google có cùng email.',
  failed: 'Không thể đăng nhập Google lúc này. Vui lòng thử lại.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ google_error?: string | string[] }> }) {
  const params = await searchParams;
  const error = typeof params.google_error === 'string' ? googleErrors[params.google_error] ?? googleErrors.failed : '';
  const user = await getSessionUser();

  return (
    <div className="ux sf-auth-layout">
      {/* Left Editorial Academic Showcase (hidden cleanly below 960px) */}
      <aside className="sf-auth-aside" aria-label="Giới thiệu StudyForge AI">
        <div className="sf-auth-aside-grid" aria-hidden="true" />

        <div className="sf-auth-aside-top">
          <Link href="/" className="sf-auth-brand" aria-label="StudyForge AI — Trang chủ">
            <span className="sf-auth-brand-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
              </svg>
            </span>
            <span className="sf-auth-brand-text">
              StudyForge AI
              <small>Khảo thí &amp; Ôn luyện chuẩn hóa</small>
            </span>
          </Link>
        </div>

        <div className="sf-auth-aside-body">
          <div className="sf-auth-kicker">
            <span className="sf-auth-kicker-dot" aria-hidden="true" />
            <span>Môi trường học tập riêng tư &amp; bảo mật</span>
          </div>

          <h1>Một không gian duy nhất cho khảo thí và ôn luyện chuẩn xác.</h1>
          <p>
            Đăng nhập để lưu trữ ngân hàng tài liệu riêng, tự động chuẩn hóa đề thi STEM và
            đồng bộ lịch sử làm bài giữa mọi thiết bị.
          </p>

          <ul className="sf-auth-points">
            <li>
              <span className="sf-auth-point-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span>
                <strong>Đọc chính xác tệp gốc:</strong> Phân biệt rõ phương án A. B. C. D. với ý phụ a), b) trong thân câu hỏi.
              </span>
            </li>
            <li>
              <span className="sf-auth-point-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              <span>
                <strong>Đối chiếu nguồn minh bạch:</strong> Luôn gắn trích dẫn gốc và tách riêng đáp án tài liệu với gợi ý AI.
              </span>
            </li>
            <li>
              <span className="sf-auth-point-ic" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <span>
                <strong>Khóa đáp án phía máy chủ:</strong> Bảo vệ đề thi trong suốt phiên làm bài và chấm điểm tức thì.
              </span>
            </li>
          </ul>

          <div className="sf-auth-sample" aria-label="Ví dụ câu hỏi chuẩn hóa">
            <div className="sf-auth-sample-head">
              <span>VÍ DỤ CÂU HỎI CHUẨN HÓA · HÓA HỌC 12</span>
              <span className="sf-auth-sample-pill">Đáp án gốc</span>
            </div>
            <div className="sf-auth-sample-stem">
              Khử hoàn toàn <MathText text="$\text{Fe}_2\text{O}_3$" inline /> bằng khí{' '}
              <MathText text="$\text{CO}$" inline /> dư ở nhiệt độ cao theo phương trình:{' '}
              <MathText text="$\text{Fe}_2\text{O}_3 + 3\text{CO} \xrightarrow{t^\circ} 2\text{Fe} + 3\text{CO}_2$" inline />.
            </div>
            <div className="sf-auth-sample-cite">
              <span>Trích dẫn: Chuyên đề Kim loại · Trang 6</span>
              <span>KaTeX STEM</span>
            </div>
          </div>
        </div>

        <div className="sf-auth-aside-foot">
          <span>© 2026 StudyForge AI</span>
          <span>Phiên đăng nhập mã hóa · Không chế độ khách</span>
        </div>
      </aside>

      {/* Right Authentication Form Column */}
      <div className="sf-auth-right">
        <header className="sf-auth-topbar">
          <Link href="/" className="sf-auth-back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Trang chủ StudyForge</span>
          </Link>
          <LucianThemeSwitch />
        </header>

        <main className="sf-auth-main">
          <LucianSignIn
            googleEnabled={isGoogleAuthConfigured()}
            googleError={error}
            linkGoogle={Boolean(user)}
            currentEmail={user?.email}
          />
        </main>
      </div>
    </div>
  );
}

import { LucianSignIn } from '@/components/lucian/LucianSignIn';
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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'radial-gradient(ellipse at 50% 20%, var(--ux-surface-2) 0%, var(--ux-page) 70%)',
      }}
    >
      <LucianSignIn googleEnabled={isGoogleAuthConfigured()} googleError={error} linkGoogle={Boolean(user)} />
    </div>
  );
}

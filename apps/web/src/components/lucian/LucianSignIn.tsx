'use client';

// Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062
// Ported to React / Next.js with real StudyForge AI authentication

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function LucianSignIn({ googleEnabled = false, googleError = '', linkGoogle = false }: {
  googleEnabled?: boolean;
  googleError?: string;
  linkGoogle?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErrorMsg('');
    setBusy(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister ? { email, password, name, role } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setBusy(false);
        setErrorMsg(data.error?.message || 'Đăng nhập không thành công');

        // Shake animation
        if (rootRef.current) {
          rootRef.current.classList.remove('shake');
          void rootRef.current.offsetWidth;
          rootRef.current.classList.add('shake');
        }
        return;
      }

      setOk(true);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 700);
    } catch {
      setBusy(false);
      setErrorMsg('Không thể kết nối máy chủ. Vui lòng thử lại.');
    }
  };

  return (
    <>
      <style>{`
        .u062 {
          position: relative;
          width: 380px;
          max-width: 100%;
          min-height: 480px;
          border-radius: 28px;
          background: var(--ux-surface);
          box-shadow: 0 20px 50px -10px var(--ux-shadow-strong), 0 0 0 1px var(--ux-line);
          padding: 32px 28px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform .3s var(--ux-spring);
        }
        .u062.shake {
          animation: u062-shake .45s var(--ux-ease);
        }
        @keyframes u062-shake {
          0%, 100% { transform: none; }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
        .u062-pane {
          display: flex;
          flex-direction: column;
          width: 100%;
          flex: 1;
        }
        .u062-logo {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: var(--ux-grad);
          display: grid;
          place-items: center;
          margin-bottom: 16px;
          color: white;
          font-weight: 800;
          font-size: 20px;
          box-shadow: 0 4px 14px var(--ux-shadow);
        }
        .u062 h3 {
          margin: 0;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--ux-ink);
        }
        .u062 p {
          margin: 6px 0 20px;
          font-size: 14px;
          color: var(--ux-ink-3);
        }
        .u062-f {
          display: flex;
          flex-direction: column;
          margin-bottom: 12px;
        }
        .u062-f label {
          font-size: 13px;
          font-weight: 700;
          color: var(--ux-ink-2);
          margin-bottom: 6px;
        }
        .u062-box {
          position: relative;
          display: flex;
          align-items: center;
          height: 48px;
          border-radius: 14px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          transition: border-color .2s, box-shadow .2s;
        }
        .u062-box:focus-within {
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
        }
        .u062-box input, .u062-box select {
          width: 100%;
          height: 100%;
          border: 0;
          background: none;
          padding: 0 16px;
          font-size: 15px;
          color: var(--ux-ink);
          outline: none;
        }
        .u062-eye {
          width: 40px;
          height: 40px;
          border: 0;
          background: none;
          color: var(--ux-ink-3);
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .u062-eye:hover { color: var(--ux-ink); }
        .u062-eye svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; }
        .u062-caps {
          font-size: 11px;
          font-weight: 700;
          color: var(--ux-warn);
          margin-top: 4px;
        }
        .u062-err {
          font-size: 13px;
          font-weight: 600;
          color: var(--ux-danger);
          margin-top: 4px;
        }
        .u062-go {
          position: relative;
          align-self: center;
          width: 100%;
          height: 50px;
          margin-top: 18px;
          border: 0;
          border-radius: 15px;
          background: var(--ux-accent);
          color: var(--ux-accent-ink);
          font-size: 16px;
          font-weight: 700;
          overflow: hidden;
          cursor: pointer;
          transition: width .4s var(--ux-spring), border-radius .4s var(--ux-spring), background-color .3s;
        }
        .u062-go:hover { filter: brightness(1.08); }
        .u062-go.busy, .u062-go.ok {
          width: 50px;
          border-radius: 25px;
        }
        .u062-go i {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          margin: -10px 0 0 -10px;
          border-radius: 50%;
          border: 2.5px solid currentColor;
          border-right-color: transparent;
          animation: u062-spin .7s linear infinite;
        }
        .u062-go.ok {
          background: var(--ux-mint);
        }
        @keyframes u062-spin { to { transform: rotate(360deg); } }
        .u062-toggle-mode {
          margin-top: 18px;
          text-align: center;
          font-size: 13px;
          color: var(--ux-ink-2);
        }
        .u062-toggle-mode button {
          background: none;
          border: 0;
          color: var(--ux-accent);
          font-weight: 700;
          cursor: pointer;
          margin-left: 4px;
        }
        .u062 .u062-google {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 48px;
          padding: 10px 14px;
          margin-bottom: 16px;
          border: 1px solid var(--ux-line);
          border-radius: 14px;
          background: var(--ux-surface);
          color: var(--ux-ink);
          font: inherit;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
        }
        .u062 .u062-google:hover { background: var(--ux-surface-2); }
        .u062 .u062-google:disabled { opacity: .6; cursor: not-allowed; }
        .u062 .u062-divider { text-align: center; color: var(--ux-ink-3); font-size: 12px; margin-bottom: 16px; }
        .u062 .u062-auth-error { color: var(--ux-danger); font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
      `}</style>

      <div ref={rootRef} className="ux u062">
        <form className="u062-pane" onSubmit={handleSubmit}>
          <div className="u062-logo" aria-hidden="true">SF</div>
          <h3>{isRegister ? 'Tạo tài khoản StudyForge' : 'Chào mừng trở lại'}</h3>
          <p>{isRegister ? 'Bắt đầu biến tài liệu thành bài kiểm tra & câu hỏi ôn tập' : 'Đăng nhập vào tài khoản StudyForge AI'}</p>

          {googleError && <div className="u062-auth-error" role="alert">{googleError}</div>}
          {googleEnabled ? (
            <a className="u062-google" href={linkGoogle ? '/api/auth/google?intent=link' : '/api/auth/google'}>
              {linkGoogle ? 'Liên kết tài khoản Google' : 'Tiếp tục với Google'}
            </a>
          ) : (
            <>
              <button className="u062-google" type="button" disabled>Tiếp tục với Google</button>
              <span className="u062-divider">Đăng nhập Google hiện chưa khả dụng</span>
            </>
          )}
          <div className="u062-divider">hoặc dùng email</div>

          {isRegister && (
            <>
              <div className="u062-f">
                <label htmlFor="auth-name">Họ và tên</label>
                <div className="u062-box">
                  <input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="u062-f">
                <label htmlFor="auth-role">Vai trò</label>
                <div className="u062-box">
                  <select id="auth-role" name="role" value={role} onChange={e => setRole(e.target.value as 'student' | 'teacher')}>
                    <option value="student">Học sinh / Sinh viên</option>
                    <option value="teacher">Giáo viên / Giảng viên</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="u062-f">
            <label htmlFor="auth-email">Email</label>
            <div className="u062-box">
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                placeholder="name@school.edu.vn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="u062-f">
            <label htmlFor="auth-password">Mật khẩu</label>
            <div className="u062-box">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isRegister ? 12 : undefined}
                placeholder="Tối thiểu 12 ký tự an toàn"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyUp={e => {
                  if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'));
                }}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              <button
                className="u062-eye"
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <svg viewBox="0 0 24 24">
                  <path d={showPassword ? "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" : "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"} />
                  {showPassword ? <circle cx="12" cy="12" r="3" /> : <line x1="1" y1="1" x2="23" y2="23" />}
                </svg>
              </button>
            </div>
            {capsOn && <span className="u062-caps">Đang bật Caps Lock</span>}
            {errorMsg && <span className="u062-err" role="alert">{errorMsg}</span>}
          </div>

          <button
            className={`u062-go ${busy ? 'busy' : ''} ${ok ? 'ok' : ''}`}
            type="submit"
            disabled={busy || ok}
          >
            {busy ? (
              <i aria-hidden="true" />
            ) : ok ? (
              <span>✓</span>
            ) : (
              <span>{isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}</span>
            )}
          </button>

          <div className="u062-toggle-mode">
            {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
            <button
              type="button"
              onClick={() => {
                setIsRegister(r => !r);
                setErrorMsg('');
              }}
            >
              {isRegister ? 'Đăng nhập ngay' : 'Tạo tài khoản mới'}
            </button>
          </div>
          {linkGoogle && <div className="u062-toggle-mode"><a href="/dashboard">Trở lại bảng điều khiển</a></div>}

          {!isRegister && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--ux-line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ux-ink-3)', textAlign: 'center' }}>
                ⚡ Điền nhanh tài khoản mẫu để trải nghiệm:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--ux-line)',
                    background: 'var(--ux-surface-2)',
                    color: 'var(--ux-ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setEmail('giaovien@studyforge.vn');
                    setPassword('GiaoVien2026!');
                    setErrorMsg('');
                  }}
                >
                  👨‍🏫 Giáo viên mẫu
                </button>
                <button
                  type="button"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: '1px solid var(--ux-line)',
                    background: 'var(--ux-surface-2)',
                    color: 'var(--ux-ink)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setEmail('hocsinh@studyforge.vn');
                    setPassword('HocSinh2026!');
                    setErrorMsg('');
                  }}
                >
                  👩‍🎓 Học sinh mẫu
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </>
  );
}

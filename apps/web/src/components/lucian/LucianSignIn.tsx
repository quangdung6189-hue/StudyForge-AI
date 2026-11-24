'use client';

// Lucian UX/UI Prompt #062 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#062
// Lucian UX/UI Prompt #401 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#401
// Lucian UX/UI Prompt #404 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#404
// Ported to React / Next.js with real StudyForge AI authentication, official Google button & live password strength meter

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const STRENGTH_LABELS = ['', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];

function GoogleMark() {
  return (
    <svg className="u401-g" viewBox="0 0 48 48" width="19" height="19" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function getPasswordStrength(value: string) {
  const hasLen = value.length >= 12;
  const hasNum = /\d/.test(value);
  const hasUpperOrSym = /[A-Z]|[^A-Za-z0-9\s]/.test(value);
  const hasBothCaseAndSym = /[a-z]/.test(value) && /[A-Z]/.test(value) && /[^A-Za-z0-9\s]/.test(value);

  let level = 0;
  if (value.length > 0) {
    level = Math.min(
      4,
      Math.max(1, (value.length >= 8 ? 1 : 0) + (hasLen ? 1 : 0) + (hasNum ? 1 : 0) + (hasUpperOrSym ? 1 : 0) + (hasBothCaseAndSym ? 1 : 0) - 1)
    );
    if (hasLen && hasNum && hasUpperOrSym) {
      level = value.length >= 16 || hasBothCaseAndSym ? 4 : 3;
    }
  }
  return { level, hasLen, hasNum, hasUpperOrSym };
}

export function LucianSignIn({
  googleEnabled = false,
  googleError = '',
  linkGoogle = false,
  currentEmail = '',
}: {
  googleEnabled?: boolean;
  googleError?: string;
  linkGoogle?: boolean;
  currentEmail?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setHydrated(true);
  }, []);

  const strength = getPasswordStrength(password);

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        const apiMessage = typeof data.error?.message === 'string' ? data.error.message : '';
        setErrorMsg(apiMessage || `Đăng nhập không thành công (HTTP ${res.status})`);

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
      }, 650);
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
          width: 416px;
          max-width: 100%;
          border-radius: 20px;
          background: var(--ux-surface);
          box-shadow: var(--ux-shadow-strong), 0 0 0 1px var(--ux-line);
          padding: 32px 30px 28px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform .3s var(--ux-spring);
        }
        @media (max-width: 440px) {
          .u062 {
            padding: 24px 20px 22px;
            border-radius: 16px;
          }
        }
        .u062.shake {
          animation: u062-shake .45s var(--ux-ease);
        }
        @keyframes u062-shake {
          0%, 100% { transform: none; }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(3px); }
        }
        .u062-pane {
          display: flex;
          flex-direction: column;
          width: 100%;
          flex: 1;
        }
        .u062 .u062-fields {
          border: 0;
          padding: 0;
          margin: 0;
          min-width: 0;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .u062-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .u062-logo {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: var(--ux-ink);
          display: grid;
          place-items: center;
          color: var(--ux-page);
          font-weight: 800;
          font-size: 15px;
          flex-shrink: 0;
        }
        .u062 h3 {
          margin: 0;
          font-size: 21px;
          font-weight: 850;
          letter-spacing: -0.025em;
          color: var(--ux-ink);
          line-height: 1.25;
        }
        .u062-sub {
          margin: 3px 0 0;
          font-size: 13px;
          line-height: 1.48;
          color: var(--ux-ink-3);
        }

        /* Lucian #401 Official Google Button */
        .u062 .u062-google {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 46px;
          padding: 10px 16px;
          margin-bottom: 12px;
          border: 1px solid var(--ux-line-2);
          border-radius: 12px;
          background: var(--ux-surface);
          color: var(--ux-ink);
          font: inherit;
          font-size: 14px;
          font-weight: 650;
          text-decoration: none;
          text-align: center;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
          transition: transform 0.2s var(--ux-ease), background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.2s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .u062 .u062-google:hover:not(:disabled) {
            background: var(--ux-surface-2);
            border-color: var(--ux-ink-3);
            transform: translateY(-1px);
            box-shadow: var(--ux-shadow);
          }
        }
        .u062 .u062-google:active:not(:disabled) {
          transform: scale(0.985);
        }
        .u062 .u062-google:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .u401-ic {
          position: relative;
          width: 20px;
          height: 20px;
          flex: none;
          display: grid;
          place-items: center;
        }
        .u401-arc {
          width: 20px;
          height: 20px;
          animation: u401-spin 0.9s linear infinite;
        }
        .u401-arc circle {
          fill: none;
          stroke-width: 2.6;
          stroke-linecap: round;
          stroke-dasharray: 8.6 41.7;
        }
        @keyframes u401-spin { to { transform: rotate(360deg); } }

        /* Hairline Divider */
        .u062 .u062-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--ux-ink-3);
          font-size: 12px;
          font-weight: 600;
          margin: 6px 0 16px;
        }
        .u062 .u062-divider::before,
        .u062 .u062-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--ux-line);
        }
        .u062 .u062-google-note {
          display: block;
          text-align: center;
          font-size: 11.5px;
          color: var(--ux-ink-3);
          margin: -4px 0 10px;
        }

        .u062-f {
          display: flex;
          flex-direction: column;
          margin-bottom: 13px;
        }
        .u062-f label {
          font-size: 12.8px;
          font-weight: 650;
          color: var(--ux-ink-2);
          margin-bottom: 6px;
        }
        .u062-box {
          position: relative;
          display: flex;
          align-items: center;
          height: 46px;
          border-radius: 11px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line-2);
          overflow: hidden;
          transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
        }
        .u062-box:hover {
          border-color: var(--ux-ink-3);
        }
        .u062-box:focus-within {
          background: var(--ux-surface);
          border-color: var(--ux-accent);
          box-shadow: 0 0 0 3px var(--ux-accent-soft);
        }
        .u062-box input, .u062-box select {
          width: 100%;
          height: 100%;
          border: 0;
          background: none;
          padding: 0 14px;
          font-size: 14.5px;
          color: var(--ux-ink);
          outline: none;
        }
        .u062-box input::placeholder {
          color: var(--ux-ink-3);
          opacity: 0.78;
        }

        /* Lucian #404 Animated Eyelid Toggle */
        .u062-eye {
          width: 38px;
          height: 38px;
          margin-right: 4px;
          border: 0;
          border-radius: 8px;
          background: none;
          color: var(--ux-ink-3);
          display: grid;
          place-items: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: color .18s ease, background-color .18s ease;
        }
        .u062-eye:hover {
          color: var(--ux-ink);
          background: var(--ux-surface-3);
        }
        .u062-eye svg {
          width: 19px;
          height: 19px;
          overflow: visible;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.7;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .u062-eye .lid {
          transform-origin: 10px 10px;
          transform: scaleY(0.12);
          transition: transform .42s var(--ux-spring);
        }
        .u062-eye .lash {
          transition: opacity .2s ease, transform .38s var(--ux-spring);
        }
        .u062-eye[aria-pressed="true"] .lid {
          transform: none;
        }
        .u062-eye[aria-pressed="true"] .lash {
          opacity: 0;
          transform: translateY(-3px);
        }

        /* Lucian #404 Live 4-Segment Strength Meter & Checklist */
        .u404-meter-wrap {
          margin-top: 10px;
        }
        .u404-st {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 18px;
        }
        .u404-bars {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
        }
        .u404-bars i {
          position: relative;
          height: 5px;
          border-radius: 999px;
          background: var(--ux-surface-3);
          overflow: hidden;
        }
        .u404-bars i::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: var(--pw-c, var(--ux-ink-3));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .42s var(--ux-spring), background-color .25s ease;
        }
        .u404-bars i.is-on::after {
          transform: none;
        }
        .u404-st em {
          min-width: 66px;
          text-align: right;
          font-style: normal;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--pw-c, var(--ux-ink-3));
        }
        .u404-meter-wrap[data-lv="1"] { --pw-c: var(--ux-danger); }
        .u404-meter-wrap[data-lv="2"] { --pw-c: var(--ux-warn); }
        .u404-meter-wrap[data-lv="3"],
        .u404-meter-wrap[data-lv="4"] { --pw-c: var(--ux-mint); }

        .u404-rules {
          margin: 10px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 6px;
        }
        .u404-rules li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.2px;
          font-weight: 550;
          color: var(--ux-ink-3);
          transition: color .25s ease;
        }
        .u404-rules svg {
          width: 16px;
          height: 16px;
          flex: none;
        }
        .u404-rules circle {
          fill: transparent;
          stroke: var(--ux-line-2);
          stroke-width: 1.6;
          transition: fill .25s ease, stroke .25s ease;
        }
        .u404-rules path {
          fill: none;
          stroke: var(--ux-surface);
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 12;
          stroke-dashoffset: 12;
          transition: stroke-dashoffset .3s var(--ux-ease) .06s;
        }
        .u404-rules li.is-ok {
          color: var(--ux-ink);
        }
        .u404-rules li.is-ok circle {
          fill: var(--ux-mint);
          stroke: var(--ux-mint);
        }
        .u404-rules li.is-ok path {
          stroke-dashoffset: 0;
        }

        .u062-caps {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--ux-warn);
          margin-top: 6px;
        }
        .u062-err {
          font-size: 12.8px;
          font-weight: 600;
          color: var(--ux-danger);
          margin-top: 6px;
          line-height: 1.45;
        }
        .u062-go {
          position: relative;
          align-self: center;
          width: 100%;
          height: 46px;
          margin-top: 10px;
          border: 0;
          border-radius: 12px;
          background: var(--ux-ink);
          color: var(--ux-page);
          font-size: 14.5px;
          font-weight: 750;
          overflow: hidden;
          cursor: pointer;
          transition: width .4s var(--ux-spring), border-radius .4s var(--ux-spring), background-color .18s ease, transform .15s ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .u062-go:hover:not(:disabled) {
            background: var(--ux-accent);
            color: var(--ux-accent-ink);
          }
        }
        .u062-go:active:not(:disabled) {
          transform: scale(0.985);
        }
        .u062-go.busy, .u062-go.ok {
          width: 48px;
          border-radius: 24px;
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
          color: var(--ux-mint-ink);
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
          color: var(--ux-accent-text);
          font-weight: 750;
          cursor: pointer;
          margin-left: 5px;
          padding: 2px 4px;
          border-radius: 6px;
        }
        .u062-toggle-mode button:hover {
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .u062 .u062-auth-error {
          padding: 10px 12px;
          border-radius: 10px;
          background: color-mix(in oklab, var(--ux-danger) 10%, var(--ux-surface));
          border: 1px solid color-mix(in oklab, var(--ux-danger) 28%, transparent);
          color: var(--ux-danger);
          font-size: 12.8px;
          font-weight: 600;
          line-height: 1.5;
          margin-bottom: 14px;
        }
        .u062 .u062-current-account {
          margin: 0 0 12px;
          padding: 8px 12px;
          border-radius: 9px;
          background: var(--ux-surface-2);
          border: 1px solid var(--ux-line);
          font-size: 12px;
          color: var(--ux-ink-2);
          overflow-wrap: anywhere;
        }
        @media (prefers-reduced-motion: reduce) {
          .u062, .u062-eye .lid, .u062-eye .lash, .u404-bars i::after, .u404-rules path, .u062-go {
            transition: none;
          }
          .u062.shake { animation: none; }
        }
      `}</style>

      <div ref={rootRef} className="ux u062">
        <form
          className="u062-pane"
          method="post"
          action={isRegister ? '/api/auth/register' : '/api/auth/login'}
          onSubmit={handleSubmit}
          aria-busy={!hydrated || busy}
        >
          <fieldset className="u062-fields" disabled={!hydrated || busy || ok}>
            <div className="u062-head">
              <div className="u062-logo" aria-hidden="true">SF</div>
              <div>
                <h3>{isRegister ? 'Tạo tài khoản StudyForge' : 'Chào mừng trở lại'}</h3>
                <p className="u062-sub">
                  {isRegister
                    ? 'Bắt đầu biến tài liệu thành đề thi & bộ ôn tập chuẩn'
                    : 'Đăng nhập vào không gian StudyForge AI'}
                </p>
              </div>
            </div>

            {googleError && (
              <div className="u062-auth-error" role="alert">
                {googleError}
              </div>
            )}
            {currentEmail && (
              <p className="u062-current-account">Tài khoản hiện tại: <strong>{currentEmail}</strong></p>
            )}

            {googleEnabled ? (
              <>
                <a
                  className="u062-google"
                  href="/api/auth/google"
                  onClick={() => setGoogleBusy(true)}
                  aria-busy={googleBusy}
                >
                  <span className="u401-ic" aria-hidden="true">
                    {googleBusy ? (
                      <svg className="u401-arc" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" stroke="#EA4335" strokeDashoffset="0" />
                        <circle cx="10" cy="10" r="8" stroke="#4285F4" strokeDashoffset="-12.57" />
                        <circle cx="10" cy="10" r="8" stroke="#34A853" strokeDashoffset="-25.13" />
                        <circle cx="10" cy="10" r="8" stroke="#FBBC05" strokeDashoffset="-37.7" />
                      </svg>
                    ) : (
                      <GoogleMark />
                    )}
                  </span>
                  <span>{googleBusy ? 'Đang kết nối Google…' : 'Tiếp tục với Google'}</span>
                </a>
                {linkGoogle && (
                  <a className="u062-google" href="/api/auth/google?intent=link">
                    <span className="u401-ic" aria-hidden="true">
                      <GoogleMark />
                    </span>
                    <span>Liên kết Google với tài khoản hiện tại</span>
                  </a>
                )}
              </>
            ) : (
              <>
                <button className="u062-google" type="button" disabled>
                  <span className="u401-ic" aria-hidden="true">
                    <GoogleMark />
                  </span>
                  <span>Tiếp tục với Google</span>
                </button>
                <span className="u062-google-note">Đăng nhập Google hiện chưa cấu hình trên máy chủ này</span>
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
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="u062-f">
                  <label htmlFor="auth-role">Vai trò</label>
                  <div className="u062-box">
                    <select
                      id="auth-role"
                      name="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'student' | 'teacher')}
                    >
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
                  inputMode="email"
                  required
                  placeholder="name@school.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  placeholder={isRegister ? 'Tối thiểu 12 ký tự an toàn' : 'Nhập mật khẩu của bạn'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock'));
                  }}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  aria-describedby={isRegister ? 'auth-pw-rules' : undefined}
                />
                <button
                  className="u062-eye"
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <g className="lid">
                      <path d="M2 10s3-5.2 8-5.2S18 10 18 10s-3 5.2-8 5.2S2 10 2 10z" />
                      <circle cx="10" cy="10" r="2.3" />
                    </g>
                    <g className="lash">
                      <path d="M3 10.4c2 2.4 4.4 3.4 7 3.4s5-1 7-3.4M6 13l-1 1.6M10 14v1.8M14 13l1 1.6" />
                    </g>
                  </svg>
                </button>
              </div>

              {isRegister && (
                <div className="u404-meter-wrap" data-lv={strength.level}>
                  <div className="u404-st">
                    <div
                      className="u404-bars"
                      role="meter"
                      aria-label="Độ mạnh mật khẩu"
                      aria-valuemin={0}
                      aria-valuemax={4}
                      aria-valuenow={strength.level}
                      aria-valuetext={STRENGTH_LABELS[strength.level] || 'Chưa nhập'}
                    >
                      <i className={strength.level >= 1 ? 'is-on' : ''} />
                      <i className={strength.level >= 2 ? 'is-on' : ''} />
                      <i className={strength.level >= 3 ? 'is-on' : ''} />
                      <i className={strength.level >= 4 ? 'is-on' : ''} />
                    </div>
                    <em>{STRENGTH_LABELS[strength.level]}</em>
                  </div>

                  <ul id="auth-pw-rules" className="u404-rules">
                    <li className={strength.hasLen ? 'is-ok' : ''}>
                      <svg viewBox="0 0 18 18" aria-hidden="true">
                        <circle cx="9" cy="9" r="7.5" />
                        <path d="M5.6 9.3l2.3 2.3 4.6-4.8" />
                      </svg>
                      <span>Tối thiểu 12 ký tự</span>
                    </li>
                    <li className={strength.hasNum ? 'is-ok' : ''}>
                      <svg viewBox="0 0 18 18" aria-hidden="true">
                        <circle cx="9" cy="9" r="7.5" />
                        <path d="M5.6 9.3l2.3 2.3 4.6-4.8" />
                      </svg>
                      <span>Có ít nhất 1 chữ số</span>
                    </li>
                    <li className={strength.hasUpperOrSym ? 'is-ok' : ''}>
                      <svg viewBox="0 0 18 18" aria-hidden="true">
                        <circle cx="9" cy="9" r="7.5" />
                        <path d="M5.6 9.3l2.3 2.3 4.6-4.8" />
                      </svg>
                      <span>Có chữ hoa hoặc ký tự đặc biệt</span>
                    </li>
                  </ul>
                </div>
              )}

              {capsOn && <span className="u062-caps">Đang bật phím Caps Lock</span>}
              {errorMsg && (
                <span className="u062-err" role="alert">
                  {errorMsg}
                </span>
              )}
            </div>

            <button
              className={`u062-go ${busy ? 'busy' : ''} ${ok ? 'ok' : ''}`}
              type="submit"
              disabled={busy || ok}
            >
              {busy ? (
                <i aria-hidden="true" />
              ) : ok ? (
                <span aria-label="Thành công">✓</span>
              ) : (
                <span>{isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}</span>
              )}
            </button>

            <div className="u062-toggle-mode">
              {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
              <button
                type="button"
                onClick={() => {
                  setIsRegister((r) => !r);
                  setErrorMsg('');
                }}
              >
                {isRegister ? 'Đăng nhập ngay' : 'Tạo tài khoản mới'}
              </button>
            </div>
            {linkGoogle && (
              <div className="u062-toggle-mode">
                <a href="/dashboard">Trở lại bảng điều khiển</a>
              </div>
            )}
          </fieldset>
        </form>
      </div>
    </>
  );
}

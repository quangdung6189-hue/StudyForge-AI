'use client';

// Lucian UX/UI Prompt #214 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#214
// Ported: Living bento feature grid → StudyForge responsive Editorial Swiss bento showcase
import React, { useEffect, useRef, useState } from 'react';

const BLOOM_BARS = [
  { label: 'NB', h: 0.48 },
  { label: 'TH', h: 0.72 },
  { label: 'VD', h: 0.58 },
  { label: 'VDC', h: 0.88 },
  { label: 'Đ/S', h: 0.76 },
  { label: 'TLN', h: 0.96 },
];

const FORMATS = ['PDF', 'DOCX', 'TXT', 'OCR', 'KaTeX', 'OMML', 'PNG', 'JSON'];

export function LandingBento() {
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [typedFormula, setTypedFormula] = useState('H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O');
  const [typedQuery, setTypedQuery] = useState('Định luật bảo toàn');
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  const typeText = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    fullText: string,
    key: string
  ) => {
    clearTimeout(timersRef.current[key]);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setter(fullText);
      return;
    }
    const chars = Array.from(fullText);
    let idx = 0;
    const step = () => {
      idx += 1;
      setter(chars.slice(0, idx).join(''));
      if (idx < chars.length) {
        timersRef.current[key] = setTimeout(step, 34);
      }
    };
    step();
  };

  const activate = (id: string) => {
    setActiveTile(id);
    if (id === 'a') {
      typeText(setTypedFormula, 'x = A cos(ωt + φ) · H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O', 'a');
    } else if (id === 'b') {
      typeText(setTypedQuery, 'Định luật bảo toàn cơ năng · Tr. 4', 'b');
    }
  };

  const deactivate = (id: string) => {
    setActiveTile((prev) => (prev === id ? null : prev));
  };

  return (
    <div className="ux sf-bento-grid" aria-label="Lưới tính năng trực quan StudyForge AI">
      {/* Tile A: STEM Authoring & Live Formula Typing */}
      <article
        className={`sf-spot u214-tile u214-a${activeTile === 'a' ? ' is-on' : ''}`}
        tabIndex={0}
        onMouseEnter={() => activate('a')}
        onMouseLeave={() => deactivate('a')}
        onFocus={() => activate('a')}
        onBlur={() => deactivate('a')}
      >
        <div className="u214-top">
          <div>
            <span className="u214-kicker">01 · Công cụ STEM</span>
            <h3>Nhận diện & gõ nhanh công thức Toán – Lý – Hóa – Sinh</h3>
            <p>
              Tự động đọc phông ký hiệu Word (Symbol, Cambria Math, OMML) và chuyển thành chuẩn KaTeX sắc nét.
            </p>
          </div>
          <span className="u214-chips" aria-hidden="true">
            <i>Toán</i>
            <i>Lý</i>
            <i>Hóa</i>
            <i>Sinh</i>
          </span>
        </div>
        <div className="u214-ty" aria-hidden="true">
          <span className="u214-ty-tag">KaTeX</span>
          <span className="u214-ty-text">{typedFormula}</span>
        </div>
      </article>

      {/* Tile B: Citation & Provenance Search */}
      <article
        className={`sf-spot u214-tile u214-b${activeTile === 'b' ? ' is-on' : ''}`}
        tabIndex={0}
        onMouseEnter={() => activate('b')}
        onMouseLeave={() => deactivate('b')}
        onFocus={() => activate('b')}
        onBlur={() => deactivate('b')}
      >
        <span className="u214-kicker">02 · Đối chiếu nguồn gốc</span>
        <h3>Trích dẫn từng đoạn văn bản gốc</h3>
        <p>
          Tách biệt hoàn toàn đáp án có sẵn trong đề gốc với phần AI đề xuất bổ sung.
        </p>
        <div className="u214-sb" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>{typedQuery}</span>
        </div>
        <div className="u214-rs" aria-hidden="true">
          <div className="u214-rs-row">
            <span className="u214-rs-pg">Tr. 04</span>
            <i style={{ '--w': 0.94 } as React.CSSProperties} />
          </div>
          <div className="u214-rs-row">
            <span className="u214-rs-pg">Tr. 09</span>
            <i style={{ '--w': 0.78 } as React.CSSProperties} />
          </div>
          <div className="u214-rs-row">
            <span className="u214-rs-pg">Tr. 12</span>
            <i style={{ '--w': 0.85 } as React.CSSProperties} />
          </div>
          <div className="u214-rs-row">
            <span className="u214-rs-pg">Tr. 15</span>
            <i style={{ '--w': 0.62 } as React.CSSProperties} />
          </div>
        </div>
      </article>

      {/* Tile C: Bloom Difficulty Matrix */}
      <article
        className={`sf-spot u214-tile u214-c${activeTile === 'c' ? ' is-on' : ''}`}
        tabIndex={0}
        onMouseEnter={() => activate('c')}
        onMouseLeave={() => deactivate('c')}
        onFocus={() => activate('c')}
        onBlur={() => deactivate('c')}
      >
        <span className="u214-kicker">03 · Ma trận Bloom</span>
        <h3>4 nhóm câu hỏi GDPT</h3>
        <p>Phân biệt A. B. C. D. với ý phụ a), b) trong thân câu hỏi.</p>
        <div className="u214-br" aria-hidden="true">
          {BLOOM_BARS.map((bar, idx) => (
            <div key={bar.label} className="u214-br-col">
              <div className="u214-br-track">
                <i
                  style={
                    {
                      '--h': bar.h,
                      '--i': idx,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </article>

      {/* Tile D: Exam Room Confidentiality */}
      <article
        className={`sf-spot u214-tile u214-d${activeTile === 'd' ? ' is-on' : ''}`}
        tabIndex={0}
        onMouseEnter={() => activate('d')}
        onMouseLeave={() => deactivate('d')}
        onFocus={() => activate('d')}
        onBlur={() => deactivate('d')}
      >
        <span className="u214-kicker">04 · Bảo mật khảo thí</span>
        <h3>Khóa đáp án trên máy chủ</h3>
        <p>Đảo đề theo mã phiên riêng và chấm điểm hoàn toàn phía server.</p>
        <span className="u214-sh" aria-hidden="true">
          <svg viewBox="0 0 32 36" fill="none">
            <path
              d="M16 2.5L28 7.2v9.2c0 8.5-5.2 14.3-12 17.5C9.2 30.7 4 24.9 4 16.4V7.2L16 2.5z"
              fill="currentColor"
              opacity="0.14"
            />
            <path
              d="M16 2.5L28 7.2v9.2c0 8.5-5.2 14.3-12 17.5C9.2 30.7 4 24.9 4 16.4V7.2L16 2.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M11 18l3.5 3.5L21.5 14"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </article>

      {/* Tile E: Multi-Format Input Strip */}
      <article
        className={`sf-spot u214-tile u214-e${activeTile === 'e' ? ' is-on' : ''}`}
        tabIndex={0}
        onMouseEnter={() => activate('e')}
        onMouseLeave={() => deactivate('e')}
        onFocus={() => activate('e')}
        onBlur={() => deactivate('e')}
      >
        <div className="u214-e-copy">
          <span className="u214-kicker">05 · Đa định dạng đầu vào</span>
          <h3>Đọc thẳng từ tệp tài liệu bạn đang có</h3>
          <p>Hỗ trợ PDF, Word (.docx), ảnh chụp đề giấy và bảng công thức khoa học.</p>
        </div>
        <div className="u214-lg" aria-hidden="true">
          <div className="u214-lt">
            {FORMATS.concat(FORMATS).map((fmt, idx) => (
              <i key={`${fmt}-${idx}`}>{fmt}</i>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

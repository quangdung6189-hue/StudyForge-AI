// StudyForge features — same Vietnamese copy, Tilt cards + scroll reveal + counters.
'use client';

import { Effect } from '@animate-ui/react/primitives/effects/effect';
import { Tilt, TiltContent } from '@animate-ui/react/primitives/effects/tilt';
import { CountingNumber } from '@animate-ui/react/primitives/texts/counting-number';
import { ReducedMotionConfig } from '@animate-ui/react/utils/motion';

const CARDS = [
  { n: '01', icon: '📁', title: 'Trích xuất đa định dạng', desc: 'Hỗ trợ kéo thả PDF, DOCX, TXT. Giữ nguyên công thức, bảng biểu và dấu tiếng Việt chuẩn Unicode NFC.' },
  { n: '02', icon: '🔍', title: 'Căn cứ & Dẫn nguồn chuẩn xác', desc: 'Phân biệt rõ ràng đáp án gốc trong tài liệu với đáp án AI đề xuất. Mọi câu hỏi đều có liên kết đối chiếu (sourceRefs) với đoạn trích.' },
  { n: '03', icon: '⏱️', title: 'Phòng thi bảo mật cao', desc: 'Đảo phương án theo seed từng thí sinh, tự động lưu câu trả lời vào máy chủ, kiểm soát hạn chót tuyệt đối và không để lộ đáp án trước khi nộp.' },
];

export function LandingFeatures() {
  return (
    <ReducedMotionConfig>
      <section className="sf-features" aria-label="Tính năng chính">
        {CARDS.map((c, i) => (
          <Effect key={c.n} fade blur slide={{ direction: 'up', offset: 18 }} delay={i * 90}>
            <Tilt maxTilt={7} perspective={900}>
              <TiltContent className="sf-card" style={{ minHeight: 250, display: 'flex', flexDirection: 'column' }}>
                <span className="sf-card-num">{c.n}</span>
                <div className="sf-card-icon" aria-hidden="true">{c.icon}</div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                {i === 0 ? (
                  <div className="sf-stats">
                    <div><b><CountingNumber number={3} fromNumber={0} /></b><span>định dạng file</span></div>
                    <div><b><CountingNumber number={100} fromNumber={0} />%</b><span>giữ dấu TV</span></div>
                  </div>
                ) : null}
                {i === 2 ? (
                  <div className="sf-stats">
                    <div><b><CountingNumber number={0} fromNumber={0} /></b><span>lộ đáp án sớm</span></div>
                    <div><b>seed</b><span>đảo / thí sinh</span></div>
                  </div>
                ) : null}
              </TiltContent>
            </Tilt>
          </Effect>
        ))}
      </section>
    </ReducedMotionConfig>
  );
}

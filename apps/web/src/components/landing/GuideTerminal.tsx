'use client';

// StudyForge Interactive Product Preview — Accessible WAI-ARIA tabs + real KaTeX formula rendering
import React, { useRef, useState } from 'react';
import { MathText } from '@/components/common/MathText';

type PreviewTabId = 'parse' | 'provenance' | 'exam';

const TABS: { id: PreviewTabId; step: string; label: string }[] = [
  { id: 'parse', step: '01', label: 'Đọc đề & Công thức STEM' },
  { id: 'provenance', step: '02', label: 'Đối chiếu dẫn nguồn' },
  { id: 'exam', step: '03', label: 'Phòng thi & Ôn tập' },
];

export function GuideTerminal() {
  const [activeTab, setActiveTab] = useState<PreviewTabId>('parse');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = TABS.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      setActiveTab(TABS[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="sf-preview-window" aria-label="Xem trước không gian làm việc StudyForge AI">
      <div className="sf-preview-topbar">
        <div className="sf-preview-chrome">
          <div className="sf-preview-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="sf-preview-path">studyforge.workspace / de-on-tap-khtn-12.docx</span>
        </div>

        <div className="sf-preview-tabs" role="tablist" aria-label="Các bước xử lý của StudyForge AI">
          {TABS.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`sf-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`sf-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                className={`sf-preview-tab${isSelected ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
              >
                <span className="sf-preview-step">{tab.step}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sf-preview-body">
        {activeTab === 'parse' && (
          <div
            id="sf-panel-parse"
            role="tabpanel"
            aria-labelledby="sf-tab-parse"
            tabIndex={0}
            className="sf-preview-grid"
          >
            <div>
              <div className="sf-preview-label">
                <span>Tài liệu gốc tải lên (.DOCX / PDF)</span>
                <span className="sf-preview-pill">Giữ nguyên ý phụ a), b)</span>
              </div>
              <div className="sf-preview-doc-box">
                <p className="sf-preview-muted">PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn</p>
                <p className="sf-preview-strong">
                  Câu 12. Cho các nhận định sau về phản ứng trung hòa H2SO4 loãng bằng dung dịch NaOH:
                </p>
                <ul className="sf-preview-sublist">
                  <li>a) Phản ứng xảy ra theo tỉ lệ mol 1 : 2 khi tạo muối trung hòa.</li>
                  <li>b) Dung dịch sau phản ứng hoàn toàn có pH = 7.</li>
                  <li>c) Công thức tính số mol chất tan là n = m / M.</li>
                </ul>
                <p className="sf-preview-muted" style={{ marginBottom: 4 }}>
                  Số nhận định đúng là:
                </p>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ux-ink-2)' }}>
                  A. 1 &nbsp;&nbsp; <strong>B. 3 (gạch chân)</strong> &nbsp;&nbsp; C. 2 &nbsp;&nbsp; D. 0
                </p>
              </div>
            </div>

            <div>
              <div className="sf-preview-label">
                <span>Câu hỏi đã chuẩn hóa · KaTeX STEM</span>
                <span className="sf-preview-pill ok">Đã kiểm chứng</span>
              </div>
              <div className="sf-preview-qcard">
                <div className="sf-preview-qstem">
                  <strong>Câu 12.</strong> Cho các nhận định sau về phản ứng giữa{' '}
                  <MathText text="$\text{H}_2\text{SO}_4$" inline /> loãng và{' '}
                  <MathText text="$\text{NaOH}$" inline />:
                  <br />
                  <span style={{ color: 'var(--ux-ink-2)' }}>
                    a) Tạo muối trung hòa theo tỉ lệ mol 1 : 2 · b) Dung dịch trung tính có{' '}
                    <MathText text="$\text{pH} = 7$" inline /> · c) Tính số mol theo{' '}
                    <MathText text="$n = \frac{m}{M}$" inline />.
                  </span>
                </div>
                <div className="sf-preview-opts">
                  <div className="sf-preview-opt">
                    <b>A.</b> <span>1 nhận định</span>
                  </div>
                  <div className="sf-preview-opt is-correct">
                    <b>B.</b> <span>3 nhận định</span>
                    <small>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Đáp án gốc
                    </small>
                  </div>
                  <div className="sf-preview-opt">
                    <b>C.</b> <span>2 nhận định</span>
                  </div>
                  <div className="sf-preview-opt">
                    <b>D.</b> <span>0 nhận định</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'provenance' && (
          <div
            id="sf-panel-provenance"
            role="tabpanel"
            aria-labelledby="sf-tab-provenance"
            tabIndex={0}
            className="sf-preview-single"
          >
            <div className="sf-preview-label">
              <span>Phân tách rõ nguồn gốc đáp án & dẫn chứng văn bản</span>
              <span className="sf-preview-pill ok">sourceRefs bắt buộc</span>
            </div>

            <div className="sf-preview-qcard">
              <div className="sf-preview-qstem" style={{ marginBottom: 12 }}>
                <strong>Câu 18 (Vật lý 12).</strong> Một chất điểm dao động điều hòa theo phương trình{' '}
                <MathText text="$x = A\cos(\omega t + \varphi)$" inline />. Gia tốc tức thời của vật liên hệ với li độ qua biểu thức nào?
              </div>

              <div className="sf-preview-citation-row">
                <div className="sf-preview-cite-card">
                  <strong>Trích dẫn đối chiếu · Trang 4 · Đoạn 2</strong>
                  <p>
                    “Trong dao động điều hòa, gia tốc luôn ngược dấu với li độ và tỉ lệ thuận với độ lớn li độ:{' '}
                    <MathText text="$a = -\omega^2 x$" inline />, đạt cực đại tại vị trí biên.”
                  </p>
                </div>

                <div className="sf-preview-cite-meta">
                  <div>
                    <small>Nguồn đáp án</small>
                    <b>Tài liệu gốc (Document Key)</b>
                  </div>
                  <div>
                    <small>Trạng thái kiểm duyệt</small>
                    <b style={{ color: 'var(--ux-mint)' }}>Khớp 100% · Không suy diễn</b>
                  </div>
                  <div>
                    <small>Gợi ý AI tách biệt</small>
                    <b>Đánh nhãn riêng nếu đề thiếu key</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exam' && (
          <div
            id="sf-panel-exam"
            role="tabpanel"
            aria-labelledby="sf-tab-exam"
            tabIndex={0}
            className="sf-preview-single"
          >
            <div className="sf-preview-exam-bar">
              <div>
                <strong>Đề kiểm tra giữa học kỳ I — Khoa học Tự nhiên 12</strong>
                <small>Mã phòng: SF-8K2Q · 40 câu hỏi · Đảo câu & phương án độc lập theo phiên</small>
              </div>
              <div className="sf-preview-exam-right">
                <span className="sf-preview-lock">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Khóa key máy chủ
                </span>
                <div className="sf-preview-timer" aria-label="Thời gian còn lại 44 phút 18 giây">
                  44:18
                </div>
              </div>
            </div>

            <div className="sf-preview-metrics">
              <div>
                <b>Bảo mật tuyệt đối khi đang thi</b>
                <span>Đáp án và lời giải chỉ được mở sau khi nộp bài thành công, không gửi kèm payload trình duyệt.</span>
              </div>
              <div>
                <b>Lưu tiến độ liên tục</b>
                <span>Tự động đồng bộ từng câu trả lời và thời hạn nộp bài trực tiếp từ đồng hồ máy chủ.</span>
              </div>
              <div>
                <b>Ôn luyện câu sai ngắt quãng</b>
                <span>Mọi câu làm sai tự động kết nối sang thẻ ghi nhớ Flashcard kèm giải thích công thức đầy đủ.</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

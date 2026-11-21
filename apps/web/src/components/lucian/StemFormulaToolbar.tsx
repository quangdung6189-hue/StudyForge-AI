'use client';

import React, { useState } from 'react';
import { MathText } from '@/components/common/MathText';

export type StemSubjectTab = 'math' | 'physics' | 'chemistry' | 'biology';

export type FormulaPreset = {
  label: string;
  latex: string;
  hint: string;
};

export const STEM_FORMULA_PRESETS: Record<StemSubjectTab, { title: string; badge: string; items: FormulaPreset[] }> = {
  math: {
    title: 'Toán học',
    badge: '∑ Toán',
    items: [
      { label: 'Phân số', latex: '\\tfrac{a}{b}', hint: 'Phân số chuẩn \\tfrac{a}{b}' },
      { label: 'Căn bậc 2', latex: '\\sqrt{x}', hint: 'Căn bậc hai \\sqrt{x}' },
      { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', hint: 'Căn bậc n \\sqrt[n]{x}' },
      { label: 'Lũy thừa', latex: 'x^{2}', hint: 'Số mũ / lũy thừa x^{n}' },
      { label: 'Chỉ số dưới', latex: 'x_{1}', hint: 'Chỉ số dưới x_{i}' },
      { label: 'Tích phân', latex: '\\int_{a}^{b} f(x)\\,dx', hint: 'Tích phân xác định' },
      { label: 'Tổng Sigma', latex: '\\sum_{i=1}^{n} x_i', hint: 'Tổng dãy số' },
      { label: 'Giới hạn', latex: '\\lim_{x \\to +\\infty}', hint: 'Giới hạn hàm số' },
      { label: 'Hệ PT', latex: '\\begin{cases} x + y = 1 \\\\ x - y = 0 \\end{cases}', hint: 'Hệ phương trình' },
      { label: 'Vectơ', latex: '\\vec{AB}', hint: 'Vectơ hình học' },
      { label: 'Góc', latex: '\\widehat{ABC}', hint: 'Góc 3 đỉnh \\widehat{ABC}' },
      { label: 'Ký hiệu góc', latex: '\\angle A', hint: 'Góc \\angle A' },
      { label: 'Vuông góc', latex: '\\perp', hint: 'Quan hệ vuông góc' },
      { label: 'Song song', latex: '\\parallel', hint: 'Quan hệ song song' },
      { label: 'Tam giác', latex: '\\triangle ABC', hint: 'Tam giác ABC' },
      { label: 'Thuộc', latex: '\\in', hint: 'Phần tử thuộc tập hợp' },
      { label: 'Không thuộc', latex: '\\notin', hint: 'Không thuộc tập hợp' },
      { label: 'Tập con', latex: '\\subset', hint: 'Tập hợp con' },
      { label: 'Hợp', latex: '\\cup', hint: 'Hợp hai tập hợp' },
      { label: 'Giao', latex: '\\cap', hint: 'Giao hai tập hợp' },
      { label: 'Tập rỗng', latex: '\\emptyset', hint: 'Tập hợp rỗng' },
      { label: 'Tập số thực R', latex: '\\mathbb{R}', hint: 'Tập số thực R' },
      { label: 'Tập số nguyên Z', latex: '\\mathbb{Z}', hint: 'Tập số nguyên Z' },
      { label: 'Nhỏ hơn bằng', latex: '\\le', hint: 'Bất đẳng thức <=' },
      { label: 'Lớn hơn bằng', latex: '\\ge', hint: 'Bất đẳng thức >=' },
      { label: 'Khác', latex: '\\ne', hint: 'Khác nhau !=' },
      { label: 'Xấp xỉ', latex: '\\approx', hint: 'Xấp xỉ bằng' },
      { label: 'Cộng trừ', latex: '\\pm', hint: 'Cộng hoặc trừ' },
      { label: 'Suy ra', latex: '\\Rightarrow', hint: 'Kéo theo / suy ra' },
      { label: 'Tương đương', latex: '\\Leftrightarrow', hint: 'Khi và chỉ khi' },
      { label: 'Vô cực', latex: '+\\infty', hint: 'Dương vô cực' },
      { label: 'Số Pi', latex: '\\pi', hint: 'Hằng số Pi' },
    ],
  },
  physics: {
    title: 'Vật lý',
    badge: '⚡ Lý',
    items: [
      { label: 'Vectơ lực', latex: '\\vec{F}', hint: 'Vectơ lực \\vec{F}' },
      { label: 'Vectơ vận tốc', latex: '\\vec{v}', hint: 'Vectơ vận tốc \\vec{v}' },
      { label: 'Vectơ gia tốc', latex: '\\vec{a}', hint: 'Vectơ gia tốc \\vec{a}' },
      { label: 'Động lượng', latex: '\\vec{p}', hint: 'Vectơ động lượng \\vec{p}' },
      { label: 'Điện trường', latex: '\\vec{E}', hint: 'Cường độ điện trường \\vec{E}' },
      { label: 'Từ trường', latex: '\\vec{B}', hint: 'Cảm ứng từ \\vec{B}' },
      { label: 'Biến thiên Δt', latex: '\\Delta t', hint: 'Độ biến thiên thời gian' },
      { label: 'Độ lệch pha', latex: '\\Delta \\varphi', hint: 'Độ lệch pha dao động' },
      { label: 'Độ biến dạng', latex: '\\Delta l', hint: 'Độ biến dạng lò xo' },
      { label: 'PT dao động', latex: 'x = A\\cos(\\omega t + \\varphi)', hint: 'Phương trình dao động điều hòa' },
      { label: 'Chu kỳ con lắc', latex: 'T = 2\\pi\\sqrt{\\tfrac{l}{g}}', hint: 'Chu kỳ con lắc đơn' },
      { label: 'Hạt nhân X', latex: '{}^{A}_{Z}\\text{X}', hint: 'Ký hiệu hạt nhân đồng vị' },
      { label: 'Đồng vị U-235', latex: '{}^{235}_{92}\\text{U}', hint: 'Hạt nhân Uranium-235' },
      { label: 'Hạt Alpha', latex: '{}^{4}_{2}\\text{He}', hint: 'Hạt nhân Heli / tia alpha' },
      { label: 'Tia β+', latex: '\\beta^{+}', hint: 'Phóng xạ positron' },
      { label: 'Tia β-', latex: '\\beta^{-}', hint: 'Phóng xạ electron' },
      { label: 'Tia γ', latex: '\\gamma', hint: 'Bức xạ điện từ gamma' },
      { label: 'Bước sóng λ', latex: '\\lambda', hint: 'Bước sóng \\lambda' },
      { label: 'Tần số góc ω', latex: '\\omega', hint: 'Tần số góc \\omega' },
      { label: 'Từ thông Φ', latex: '\\Phi', hint: 'Từ thông \\Phi' },
      { label: 'Hệ số ma sát μ', latex: '\\mu', hint: 'Hệ số ma sát / độ từ thẩm' },
      { label: 'Điện trở suất ρ', latex: '\\rho', hint: 'Điện trở suất / khối lượng riêng' },
      { label: 'Độ C', latex: '^{\\circ}\\text{C}', hint: 'Đơn vị nhiệt độ Celsius' },
      { label: 'Đơn vị Ôm', latex: '\\ \\Omega', hint: 'Đơn vị điện trở Ohm' },
      { label: 'Micro Fara', latex: '\\ \\mu\\text{F}', hint: 'Đơn vị điện dung microFarad' },
      { label: 'Gia tốc m/s²', latex: '\\text{m/s}^{2}', hint: 'Đơn vị gia tốc' },
    ],
  },
  chemistry: {
    title: 'Hóa học',
    badge: '⚗️ Hóa',
    items: [
      { label: 'Mũi tên phản ứng', latex: '\\longrightarrow', hint: 'Phản ứng một chiều' },
      { label: 'PƯ có nhiệt độ', latex: '\\xrightarrow{t^{\\circ}}', hint: 'Phản ứng đun nóng' },
      { label: 'PƯ nhiệt độ, xt', latex: '\\xrightarrow{t^{\\circ},\\ \\text{xt}}', hint: 'Phản ứng có nhiệt độ và xúc tác' },
      { label: 'PƯ thuận nghịch', latex: '\\rightleftharpoons', hint: 'Phản ứng thuận nghịch / cân bằng' },
      { label: 'Điện phân dd', latex: '\\xrightarrow{\\text{đpdd}}', hint: 'Điện phân dung dịch' },
      { label: 'Kết tủa', latex: '\\downarrow', hint: 'Chất kết tủa' },
      { label: 'Bay hơi', latex: '\\uparrow', hint: 'Chất khí thoát ra' },
      { label: 'Axit sunfuric', latex: '\\text{H}_2\\text{SO}_4', hint: 'Công thức chuẩn phông H2SO4' },
      { label: 'Axit nitric', latex: '\\text{HNO}_3', hint: 'Công thức chuẩn phông HNO3' },
      { label: 'Nước', latex: '\\text{H}_2\\text{O}', hint: 'Phân tử nước H2O' },
      { label: 'Khí cacbonic', latex: '\\text{CO}_2', hint: 'Phân tử CO2' },
      { label: 'Ion Sắt(III)', latex: '\\text{Fe}^{3+}', hint: 'Cation Fe3+' },
      { label: 'Ion Sắt(II)', latex: '\\text{Fe}^{2+}', hint: 'Cation Fe2+' },
      { label: 'Ion Đồng(II)', latex: '\\text{Cu}^{2+}', hint: 'Cation Cu2+' },
      { label: 'Ion Amoni', latex: '\\text{NH}_4^{+}', hint: 'Cation NH4+' },
      { label: 'Ion Sunfat', latex: '\\text{SO}_4^{2-}', hint: 'Anion SO4 2-' },
      { label: 'Ion Nitrat', latex: '\\text{NO}_3^{-}', hint: 'Anion NO3-' },
      { label: 'Ion Cacbonat', latex: '\\text{CO}_3^{2-}', hint: 'Anion CO3 2-' },
      { label: 'Ion Hiđroxit', latex: '\\text{OH}^{-}', hint: 'Anion OH-' },
      { label: 'Liên kết ba', latex: '\\equiv', hint: 'Liên kết ba (ankin / N2)' },
      { label: 'Nhóm Anđehit', latex: '-\\text{CHO}', hint: 'Nhóm chức anđehit' },
      { label: 'Nhóm Cacboxyl', latex: '-\\text{COOH}', hint: 'Nhóm chức axit cacboxylic' },
      { label: 'Nhóm Amino', latex: '-\\text{NH}_2', hint: 'Nhóm chức amin / amino axit' },
      { label: 'Cấu hình e', latex: '1s^{2}2s^{2}2p^{6}', hint: 'Cấu hình electron nguyên tử' },
    ],
  },
  biology: {
    title: 'Sinh học',
    badge: '🧬 Sinh',
    items: [
      { label: 'Thế hệ P', latex: '\\text{P}: ', hint: 'Thế hệ xuất phát P' },
      { label: 'Thế hệ F1', latex: '\\text{F}_1', hint: 'Thế hệ con lai F1' },
      { label: 'Thế hệ F2', latex: '\\text{F}_2', hint: 'Thế hệ F2' },
      { label: 'Giao tử G', latex: '\\text{G}: ', hint: 'Giao tử G' },
      { label: 'Phép lai ×', latex: '\\times', hint: 'Dấu phép lai di truyền' },
      { label: 'Giới tính cái ♀', latex: '\\female', hint: 'Cá thể cái / mẹ' },
      { label: 'Giới tính đực ♂', latex: '\\male', hint: 'Cá thể đực / bố' },
      { label: 'Bộ NST 2n', latex: '2n = 46', hint: 'Bộ nhiễm sắc thể lưỡng bội' },
      { label: 'Bộ NST đơn bội', latex: 'n = 23', hint: 'Bộ nhiễm sắc thể đơn bội' },
      { label: 'Thể ba (2n+1)', latex: '2n + 1', hint: 'Đột biến lệch bội thể ba' },
      { label: 'Thể một (2n-1)', latex: '2n - 1', hint: 'Đột biến lệch bội thể một' },
      { label: 'Tam bội 3n', latex: '3n', hint: 'Đa bội lẻ 3n' },
      { label: 'Tứ bội 4n', latex: '4n', hint: 'Đa bội chẵn 4n' },
      { label: 'NST giới tính XX', latex: '\\text{X}^{\\text{A}}\\text{X}^{\\text{a}}', hint: 'Gen liên kết NST giới tính X' },
      { label: 'NST giới tính XY', latex: '\\text{X}^{\\text{a}}\\text{Y}', hint: 'Gen trên NST X không alen trên Y' },
      { label: 'Kiểu gen liên kết', latex: '\\frac{\\underline{\\text{AB}}}{\\text{ab}}', hint: 'Di truyền liên kết gen trên NST thường' },
      { label: 'Liên kết chéo', latex: '\\frac{\\underline{\\text{Ab}}}{\\text{aB}}', hint: 'Di truyền liên kết dị hợp chéo' },
      { label: 'Nhóm máu AB', latex: '\\text{I}^{\\text{A}}\\text{I}^{\\text{B}}', hint: 'Kiểu gen nhóm máu AB' },
      { label: 'Nhóm máu O', latex: '\\text{I}^{\\text{O}}\\text{I}^{\\text{O}}', hint: 'Kiểu gen nhóm máu O' },
      { label: 'Chiều 5’→3’', latex: "5' \\to 3'", hint: 'Chiều mạch mã bổ sung / mARN' },
      { label: 'Chiều 3’→5’', latex: "3' \\to 5'", hint: 'Chiều mạch khuôn ADN' },
      { label: 'Liên kết H ADN', latex: '2\\text{A} + 3\\text{G}', hint: 'Tổng số liên kết hiđrô của gen' },
    ],
  },
};

type Props = {
  onInsert: (latexWrapped: string) => void;
  onNormalizeAll?: () => void;
  compact?: boolean;
};

export function StemFormulaToolbar({ onInsert, onNormalizeAll, compact = false }: Props) {
  const [open, setOpen] = useState(!compact);
  const [tab, setTab] = useState<StemSubjectTab>('math');
  const [composerLatex, setComposerLatex] = useState('');

  const handleChipClick = (latex: string) => {
    onInsert(`$${latex}$`);
  };

  const handleComposerInsert = () => {
    const trimmed = composerLatex.trim();
    if (!trimmed) return;
    const wrapped = trimmed.startsWith('$') && trimmed.endsWith('$') ? trimmed : `$${trimmed}$`;
    onInsert(wrapped);
    setComposerLatex('');
  };

  return (
    <div className="stem-formula-toolbar" aria-label="Bộ công cụ ký tự và phông chữ công thức Toán - Lý - Hóa - Sinh">
      <div className="stem-formula-bar-head">
        <div className="stem-formula-tabs" role="tablist" aria-label="Phân môn công thức">
          {(Object.entries(STEM_FORMULA_PRESETS) as [StemSubjectTab, typeof STEM_FORMULA_PRESETS['math']][]).map(([key, group]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key && open}
              className={`stem-formula-tab ${tab === key && open ? 'active' : ''}`}
              onClick={() => {
                setTab(key);
                setOpen(true);
              }}
            >
              {group.badge}
            </button>
          ))}
        </div>
        <div className="stem-formula-actions">
          {onNormalizeAll && (
            <button
              type="button"
              className="stem-formula-convert-btn"
              onClick={onNormalizeAll}
              title="Tự động nhận diện và chuyển toàn bộ ký tự công thức thường (H2SO4, x^2, vec(F), Δt, 2n=46...) sang phông chữ công thức chuẩn KaTeX"
            >
              ✦ Chuẩn hóa phông công thức
            </button>
          )}
          <button
            type="button"
            className="stem-formula-toggle-btn"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Thu gọn ▲' : 'Mở bảng ký tự ▼'}
          </button>
        </div>
      </div>

      {open && (
        <div className="stem-formula-body">
          <div className="stem-formula-grid" role="group" aria-label={`Ký tự chuẩn phông ${STEM_FORMULA_PRESETS[tab].title}`}>
            {STEM_FORMULA_PRESETS[tab].items.map((item) => (
              <button
                key={item.latex}
                type="button"
                className="stem-formula-chip"
                title={`${item.label} (${item.hint}) — Bấm để chèn phông công thức $${item.latex}$`}
                onMouseDown={(e) => {
                  // Prevent stealing focus from active textarea/input in the editor
                  e.preventDefault();
                }}
                onClick={() => handleChipClick(item.latex)}
              >
                <span className="stem-formula-chip-math">
                  <MathText text={`$${item.latex}$`} inline />
                </span>
                <small className="stem-formula-chip-label">{item.label}</small>
              </button>
            ))}
          </div>

          <div className="stem-formula-composer">
            <div className="stem-formula-composer-input-wrap">
              <span className="stem-formula-composer-tag">Soạn công thức LaTeX:</span>
              <input
                type="text"
                className="stem-formula-composer-input"
                aria-label="Nhập mã LaTeX công thức Toán Lý Hóa Sinh"
                placeholder="Ví dụ: \text{H}_2\text{SO}_4 + \text{BaCl}_2 \longrightarrow \text{BaSO}_4\downarrow + 2\text{HCl}"
                value={composerLatex}
                onChange={(e) => setComposerLatex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleComposerInsert();
                  }
                }}
              />
              <button
                type="button"
                className="stem-formula-insert-btn"
                disabled={!composerLatex.trim()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleComposerInsert}
              >
                ＋ Chèn công thức
              </button>
            </div>
            {composerLatex.trim() && (
              <div className="stem-formula-composer-preview" aria-live="polite">
                <small>Xem trước phông công thức chuẩn:</small>
                <div className="stem-formula-preview-box">
                  <MathText
                    text={
                      composerLatex.trim().startsWith('$')
                        ? composerLatex.trim()
                        : `$${composerLatex.trim()}$`
                    }
                    inline
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

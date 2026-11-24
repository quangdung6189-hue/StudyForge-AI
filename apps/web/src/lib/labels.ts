/** Vietnamese labels shared by the bank, history, analytics and builder screens. */
export const TYPE_LABELS: Record<string, string> = {
  single: 'Trắc nghiệm',
  multiple: 'Nhiều đáp án',
  boolean: 'Đúng / Sai',
  short: 'Trả lời ngắn',
  fill: 'Điền từ',
  ordering: 'Sắp xếp thứ tự',
  matching: 'Ghép nối',
};
export const DIFFICULTY_LABELS: Record<string, string> = {
  recognition: 'Nhận biết',
  comprehension: 'Thông hiểu',
  application: 'Vận dụng',
};
export const ORIGIN_LABELS: Record<string, string> = {
  document: 'Đáp án gốc',
  teacher: 'Giáo viên soạn',
  ai_suggested: 'AI đề xuất',
};

// Assembled from numeric parts so server and browser render identical text (no hydration drift).
const partsFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' });
function vnParts(iso: string) {
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return parts as Record<'day' | 'month' | 'year' | 'hour' | 'minute', string>;
}
export const shortDate = (iso: string) => { const p = vnParts(iso); return `${p.day}/${p.month}`; };
export const dateTime = (iso: string) => { const p = vnParts(iso); return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`; };
export function duration(sec: number) {
  if (sec < 60) return `${sec} giây`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
}

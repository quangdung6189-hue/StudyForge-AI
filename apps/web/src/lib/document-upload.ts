export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_PART_BYTES = 1024 * 1024;
export const DOCUMENT_MAX_FILES = 10;

const types: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

export function documentFileType(filename: string) {
  const extension = filename.toLowerCase().split('.').pop() ?? '';
  return filename.includes('.') && Object.hasOwn(types, extension) ? types[extension] : undefined;
}

/** Hosting can return plain text/HTML instead of JSON for platform errors. */
export function uploadResponseError(status: number, text: string): string {
  if (status === 413) return 'Phần tải lên quá lớn. Hãy tải lại bằng luồng chia phần hoặc chọn file nhỏ hơn.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi tải tài liệu.';
  if (status === 504) return 'Đọc tài liệu quá thời gian máy chủ. Hãy thử lại hoặc tách tài liệu nhỏ hơn.';
  try {
    const value = JSON.parse(text);
    if (typeof value.error?.message === 'string') return value.error.message;
  } catch {}
  return status >= 500 ? 'Máy chủ chưa xử lý được tài liệu. Hãy thử lại sau vài giây.' : 'Phản hồi tải file chưa hợp lệ. Hãy tải lại trang và thử lại.';
}
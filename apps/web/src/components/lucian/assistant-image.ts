export type ChatImage = { name: string; dataUrl: string };

/** Local upload preparation only: no original image is sent to another storage service. */
export async function prepareChatImage(file: File): Promise<ChatImage> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Chọn ảnh PNG, JPG hoặc WebP. Ảnh HEIC cần chuyển sang JPG trước.');
  if (file.size > 8 * 1024 * 1024) throw new Error(`Ảnh ${file.name} vượt quá 8MB. Hãy chọn ảnh nhỏ hơn.`);
  if (!file.size) throw new Error('Ảnh trống hoặc chưa tải xong. Hãy chọn lại.');
  const image = await createImageBitmap(file).catch(() => { throw new Error(`Không mở được ảnh ${file.name}. Hãy thử lưu lại dưới dạng PNG/JPG.`); });
  try {
    if (image.width * image.height > 40_000_000) throw new Error('Ảnh có kích thước quá lớn. Hãy giảm kích thước rồi gửi lại.');
    for (const [maxSize, quality] of [[2000,.88],[2000,.72],[1600,.65]]) {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('Trình duyệt chưa hỗ trợ chuẩn bị ảnh.');
      context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không chuyển đổi được ảnh.')), 'image/jpeg', quality));
      if (blob.size > 1_100_000) continue;
      const dataUrl = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Không đọc được ảnh.')); reader.readAsDataURL(blob); });
      return { name: file.name || 'Ảnh dán từ clipboard', dataUrl };
    }
    throw new Error('Ảnh còn quá lớn sau khi tối ưu. Hãy cắt phần cần hỏi rồi gửi lại.');
  } finally { image.close(); }
}

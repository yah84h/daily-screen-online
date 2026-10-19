import { supabase } from './supabase';

const MAX_SIDE = 3840;
const MAX_BYTES = 5 * 1024 * 1024; // حد الحاوية في Supabase

/** يضغط الصورة في المتصفح إلى WebP (أو PNG/JPEG حين لا يدعم المتصفح WebP) */
export async function compressImage(file: File): Promise<Blob> {
  const supported = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!supported) throw Error('اختر صورة JPG أو PNG أو WEBP. إذا تعذّر فتح صورة HEIC من الآيفون، صدّرها بصيغة JPEG.');

  const objectURL = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error('لا يستطيع هذا المتصفح فتح هذه الصورة. صدّرها بصيغة JPEG ثم ارفعها.'));
      img.src = objectURL;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('تعذّرت معالجة الصورة');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // جرّب جودات متناقصة حتى تصبح الصورة أقل من الحد
    for (const quality of [0.86, 0.75, 0.62, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (!blob) break;
      if (blob.size <= MAX_BYTES) return blob;
    }
    throw Error('الصورة كبيرة جدًا حتى بعد الضغط. اختر صورة أصغر.');
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

/** يرفع الصورة إلى حاوية media ويعيد الرابط العام */
export async function uploadImage(file: File, folder = 'content'): Promise<string> {
  const blob = await compressImage(file);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw Error('تعذّر رفع الصورة: ' + error.message);
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

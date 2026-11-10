import { removeShowAsset } from '@/lib/assetCache';
import { mediaLink } from '@/lib/mediaLinks';
import { useState } from 'react';
import { parseDriveLink, clearDriveVideoCache } from '@/lib/driveVideo';
import { useAdmin } from './store';
export function DriveVideoEditor() {
  const { content, edit, busy } = useAdmin();
  const [kind, setKind] = useState<'video' | 'audio'>(
    content.fullType === 'audio' ? 'audio' : 'video',
  );
  const [link, setLink] = useState(content.fullMedia || '');
  const [message, setMessage] = useState('');
  const drive = parseDriveLink(content.fullMedia || '');
  return (
    <section className="drive-video-editor">
      <h3>رابط فيديو أو صوت</h3>
      <p className="field-hint">
        ألصق رابط ملف مباشر مثل MP4 أو WEBM أو MP3، أو رابط Drive عام يسمح بالتنزيل. يُشغّل الرابط
        دون رفع الملف إلى قاعدة بيانات المدرسة.
      </p>
      <label>
        رابط الوسائط
        <input
          type="url"
          dir="ltr"
          aria-label="رابط الوسائط"
          placeholder="https://example.com/video.mp4"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </label>
      <label>
        نوع الملف عند غياب الامتداد
        <select
          aria-label="نوع رابط الوسائط"
          value={kind}
          onChange={(e) => setKind(e.target.value as 'video' | 'audio')}
        >
          <option value="video">فيديو</option>
          <option value="audio">صوت</option>
        </select>
      </label>
      <button
        className="button white"
        type="button"
        disabled={busy}
        onClick={() => {
          const parsed = mediaLink(link, kind);
          if (!parsed) {
            setMessage('أدخل رابط HTTPS مباشرًا أو رابط Drive صالحًا.');
            return;
          }
          edit('fullMedia', parsed.url);
          edit('fullType', parsed.kind);
          setMessage('تم اختيار الرابط. انشر المحتوى لتطبيقه على الشاشة.');
        }}
      >
        استخدام رابط الوسائط
      </button>
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
      {drive && content.fullType !== 'audio' && (
        <>
          <label>
            تجهيز فيديو Drive قبل التشغيل
            <select
              aria-label="تجهيز فيديو Drive"
              value={content.videoPreparation || 'stream'}
              onChange={(e) =>
                edit('videoPreparation', e.target.value as 'stream' | 'buffer' | 'cache')
              }
            >
              <option value="stream">تشغيل مباشر</option>
              <option value="buffer">انتظار تخزين ١٠ ثوانٍ قبل التشغيل</option>
              <option value="cache">تنزيل كامل على جهاز العرض ثم التشغيل</option>
            </select>
          </label>
          <p className="field-hint">
            التحضير الكامل يعرض نسبة التنزيل ويحتفظ بنسخة على متصفح جهاز العرض للاستخدام القادم، حتى
            ٥١٢ ميجابايت وحسب مساحة الجهاز. لا يبدأ الفيديو قبل اكتمال التنزيل. المعاينة تبث مباشرة؛
            التحضير على شاشة العرض. تحديث ملف Drive بنفس الرابط يتطلب مسح النسخة المحفوظة على جهاز
            العرض.
          </p>
          <button
            type="button"
            className="button white"
            onClick={() =>
              Promise.all([clearDriveVideoCache(), removeShowAsset(content.fullMedia || '')])
                .then(() => setMessage('مُسحت نسخة Drive المحفوظة في هذا المتصفح فقط.'))
                .catch(() => setMessage('تعذر مسح النسخة المحفوظة.'))
            }
          >
            مسح نسخة Drive على هذا الجهاز
          </button>
        </>
      )}
    </section>
  );
}

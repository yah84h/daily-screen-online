import { useState } from 'react';
import { mediaLink } from '@/lib/mediaLinks';
import { useAdmin } from './store';
export function DailyMediaEditor() {
  const { edit, busy } = useAdmin();
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  return (
    <div className="daily-link-editor">
      <label>
        رابط صورة / GIF / فيديو للشاشة اليومية
        <input
          aria-label="رابط وسائط الشاشة اليومية"
          type="url"
          dir="ltr"
          value={link}
          onChange={(event) => setLink(event.target.value)}
        />
      </label>
      <button
        className="button white"
        type="button"
        disabled={busy}
        onClick={() => {
          const parsed = mediaLink(link);
          if (!parsed || parsed.kind === 'audio') {
            setMessage('استخدم رابط HTTPS لصورة أو GIF أو فيديو، أو رابط Drive لفيديو عام.');
            return;
          }
          edit('image', parsed.url);
          edit(
            'imageType',
            /\.(gif|png|jpe?g|webp)(?:[?#]|$)/i.test(parsed.url) ? 'image' : 'video',
          );
          setMessage('تم اختيار الوسائط. انشرها لتظهر في مكان الصورة اليومية.');
        }}
      >
        استخدام رابط الشاشة اليومية
      </button>
      {message && (
        <p role="status" className="field-hint">
          {message}
        </p>
      )}
    </div>
  );
}

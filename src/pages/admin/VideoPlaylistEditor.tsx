import { CropEditor } from './CropEditor';
import { mediaCropStyle } from '@/lib/mediaCrop';
import { useRef, useState } from 'react';
import { mediaLink } from '@/lib/mediaLinks';
import { uploadMedia } from '@/lib/media';
import { useAdmin } from './store';
import type { Content } from '@/lib/types';
type Item = NonNullable<Content['videoPlaylist']>['items'][number];
export function VideoPlaylistEditor() {
  const { content, edit, busy, run } = useAdmin();
  const playlist = content.videoPlaylist || { enabled: false, loop: true, items: [] };
  const current = useRef(playlist);
  current.current = playlist;
  const [link, setLink] = useState('');
  const [kind, setKind] = useState<'video' | 'image'>('video');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<typeof playlist>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    edit('videoPlaylist', next);
  };
  const append = (items: Item[]) =>
    update({ enabled: true, items: [...current.current.items, ...items] });
  return (
    <section className="video-playlist-editor">
      <h3>قائمة عرض · فيديوهات وصور متعددة</h3>
      <p className="field-hint">
        رتّب الملفات ثم انشر. جهاز الشاشة يجهّز القائمة كاملة في الخلفية ويبقي العرض السابق حتى تصبح
        جاهزة. حد الملف ٥١٢ ميجابايت والقائمة ٢ جيجابايت. التحضير على الشاشة نفسها، لا على الهاتف.
      </p>
      <label>
        <input
          type="checkbox"
          aria-label="تفعيل قائمة الفيديوهات"
          checked={playlist.enabled}
          disabled={busy}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
        استخدام القائمة بدل الملف الواحد
      </label>
      <label>
        رابط الملف التالي
        <input
          aria-label="رابط ملف القائمة"
          dir="ltr"
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <select
        aria-label="نوع ملف القائمة"
        value={kind}
        onChange={(e) => setKind(e.target.value as 'video' | 'image')}
      >
        <option value="video">فيديو · مباشر أو Drive</option>
        <option value="image">صورة · رابط مباشر</option>
      </select>
      <div className="playlist-actions">
        <button
          className="button white"
          type="button"
          disabled={busy || uploading || playlist.items.length >= 30}
          onClick={() => {
            const parsed = mediaLink(link);
            if (
              !parsed ||
              (kind === 'video' && parsed.kind === 'audio') ||
              (kind === 'image' && parsed.drive)
            ) {
              setMessage('استخدم رابط HTTPS لفيديو أو صورة، أو رابط Drive لفيديو عام.');
              return;
            }
            append([
              {
                id: crypto.randomUUID(),
                url: parsed.url,
                name: 'ملف ' + (playlist.items.length + 1),
                type: kind,
                seconds: 10,
              },
            ]);
            setLink('');
            setMessage('تمت الإضافة. اختر وضع صورة / فيديو ثم انشر القائمة.');
          }}
        >
          إضافة إلى القائمة
        </button>
        <button
          className="button white"
          type="button"
          disabled={busy || uploading || playlist.items.length >= 30}
          onClick={() => input.current?.click()}
        >
          {uploading ? 'جارٍ الرفع…' : 'رفع ملفات متعددة'}
        </button>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept="video/mp4,video/webm,image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          setUploading(true);
          await run(async () => {
            try {
              for (const file of files.slice(0, 30 - current.current.items.length)) {
                const url = await uploadMedia(file);
                append([
                  {
                    id: crypto.randomUUID(),
                    url,
                    name: file.name,
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    seconds: 10,
                  },
                ]);
              }
              setMessage('اكتمل الرفع. انشر القائمة على الشاشة.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'تعذر رفع الملفات.');
              throw error;
            } finally {
              setUploading(false);
            }
          });
        }}
      />
      <div className="playlist-summary">
        <b>{playlist.items.length} / 30 ملفًا</b>
        <span>من الأعلى إلى الأسفل · رتّب بالأسهم</span>
      </div>
      <ol className="playlist-stack">
        {playlist.items.map((item, index) => (
          <li key={item.id} className="playlist-card">
            <div className="playlist-card-heading">
              <span className="playlist-order">{index + 1}</span>
              <div className="playlist-thumbnail">
                {item.type === 'image' ? (
                  <img src={item.url} alt="" style={mediaCropStyle(item.crop)} />
                ) : (
                  <span aria-hidden="true">▶</span>
                )}
              </div>
              <span className="playlist-kind">
                {item.type === 'video' ? 'فيديو' : 'صورة / GIF'}
              </span>
            </div>
            <input
              aria-label={'اسم ملف ' + (index + 1)}
              value={item.name}
              onChange={(e) =>
                update({
                  items: current.current.items.map((v) =>
                    v.id === item.id ? { ...v, name: e.target.value } : v,
                  ),
                })
              }
            />
            <small>{item.type === 'video' ? 'فيديو' : 'صورة'}</small>
            {item.type === 'image' && (
              <label>
                ثوانٍ
                <input
                  aria-label={'مدة صورة ' + (index + 1)}
                  type="number"
                  min="3"
                  max="600"
                  value={item.seconds || 10}
                  onChange={(e) =>
                    update({
                      items: current.current.items.map((v) =>
                        v.id === item.id
                          ? { ...v, seconds: Math.max(3, Math.min(600, +e.target.value || 10)) }
                          : v,
                      ),
                    })
                  }
                />
              </label>
            )}
            <details className="playlist-crop">
              <summary>القص ونقطة التركيز</summary>
              <CropEditor
                label={'قص ملف ' + (index + 1)}
                value={item.crop}
                onChange={(crop) =>
                  update({
                    items: current.current.items.map((value) =>
                      value.id === item.id ? { ...value, crop } : value,
                    ),
                  })
                }
              />
            </details>
            <div className="playlist-actions">
              {[-1, 1].map((direction) => (
                <button
                  type="button"
                  key={direction}
                  disabled={
                    busy || index + direction < 0 || index + direction >= playlist.items.length
                  }
                  aria-label={(direction < 0 ? 'رفع ترتيب ' : 'خفض ترتيب ') + (index + 1)}
                  onClick={() => {
                    const items = [...current.current.items];
                    [items[index], items[index + direction]] = [
                      items[index + direction],
                      items[index],
                    ];
                    update({ items });
                  }}
                >
                  {direction < 0 ? '↑' : '↓'}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                aria-label={'حذف ملف ' + (index + 1)}
                onClick={() =>
                  update({ items: current.current.items.filter((v) => v.id !== item.id) })
                }
              >
                حذف
              </button>
            </div>
          </li>
        ))}
      </ol>
      <label>
        <input
          type="checkbox"
          checked={playlist.loop}
          onChange={(e) => update({ loop: e.target.checked })}
        />
        تكرار القائمة باستمرار
      </label>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

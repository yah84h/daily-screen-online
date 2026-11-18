import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Music,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { CropEditor } from './CropEditor';
import { mediaCropStyle } from '@/lib/mediaCrop';
import { mediaLink } from '@/lib/mediaLinks';
import { uploadMedia } from '@/lib/media';
import { parseDriveLink, clearDriveVideoCache } from '@/lib/driveVideo';
import { removeShowAsset } from '@/lib/assetCache';
import { useAdmin } from './store';
import type { Content } from '@/lib/types';

type Playlist = NonNullable<Content['videoPlaylist']>;
type Kind = 'video' | 'image' | 'audio';
type Entry = Omit<Playlist['items'][number], 'type'> & { type: Kind };
const LIMIT = 30;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i;
const kindName: Record<Kind, string> = { video: 'فيديو', image: 'صورة', audio: 'صوت' };
const kindIcon = { video: FileVideo, image: ImageIcon, audio: Music };

/**
 * Full-screen image / video, one list for everything:
 * one file plays full screen, two or more become a playlist automatically.
 * The stored shape is unchanged (fullMedia for one file, videoPlaylist for several).
 */
export function MediaEditor() {
  const { content, edit, busy } = useAdmin();
  const playlist: Playlist = content.videoPlaylist || { enabled: false, loop: true, items: [] };
  const entries: Entry[] =
    playlist.enabled && playlist.items.length
      ? playlist.items
      : content.fullMedia
        ? [
            {
              id: 'single',
              url: content.fullMedia,
              name:
                playlist.items.find((item) => item.url === content.fullMedia)?.name ||
                fileName(content.fullMedia),
              type: (content.fullType || 'image') as Kind,
              crop: content.fullCrop,
            },
          ]
        : [];
  const latest = useRef(entries);
  latest.current = entries;
  const picker = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState('');

  /** Save the list in the existing content shape. */
  const commit = (next: Entry[]) => {
    latest.current = next;
    if (next.length > 1) {
      edit('videoPlaylist', {
        ...playlist,
        enabled: true,
        items: next.map((item) => ({ ...item, type: item.type === 'image' ? 'image' : 'video' })),
      });
      edit('fullMedia', next[0].url);
      edit('fullType', next[0].type);
      return;
    }
    const only = next[0];
    edit('videoPlaylist', {
      ...playlist,
      enabled: false,
      items: only
        ? [
            {
              ...only,
              id: only.id === 'single' ? crypto.randomUUID() : only.id,
              type: only.type === 'image' ? 'image' : 'video',
            },
          ]
        : [],
    });
    edit('fullMedia', only?.url || '');
    edit('fullType', only?.type || 'image');
    edit('fullCrop', only?.crop);
  };
  const add = (items: Entry[]) => {
    const current = latest.current;
    if (current.length + items.length > LIMIT) throw Error('الحد ' + LIMIT + ' ملفًا.');
    if (
      [...current, ...items].some((item) => item.type === 'audio') &&
      current.length + items.length > 1
    )
      throw Error('ملف الصوت يُعرض وحده. للصوت مع الصور استخدم «صوت الخلفية».');
    commit([...current, ...items]);
  };
  const addLink = () => {
    try {
      const value = link.trim();
      const image = IMAGE.test(value) && !parseDriveLink(value);
      const parsed = mediaLink(value);
      if (!parsed) throw Error('الصق رابط https مباشرًا أو رابط Google Drive عامًا.');
      add([
        {
          id: crypto.randomUUID(),
          url: parsed.url,
          name: parsed.drive ? 'Google Drive' : fileName(parsed.url),
          type: image ? 'image' : parsed.kind,
          seconds: 10,
        },
      ]);
      setLink('');
      setMessage('أُضيف الرابط. انشر لتطبيقه على الشاشة.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };
  const upload = async (files: File[]) => {
    try {
      for (const [index, file] of files.entries()) {
        setUploading(`رفع ${index + 1} من ${files.length}: ${file.name}`);
        const type: Kind =
          file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
            ? 'image'
            : file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|flac)$/i.test(file.name)
              ? 'audio'
              : 'video';
        const url = await uploadMedia(file);
        add([{ id: crypto.randomUUID(), url, name: file.name, type, seconds: 10 }]);
      }
      setMessage('اكتمل الرفع. انشر لتطبيقه على الشاشة.');
    } catch (error) {
      setMessage((error as Error).message || 'تعذر رفع الملف.');
    } finally {
      setUploading('');
    }
  };
  const change = (id: string, patch: Partial<Entry>) =>
    commit(latest.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const move = (index: number, by: number) => {
    const next = [...latest.current];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    commit(next);
  };
  const hasVideo = entries.some((item) => item.type === 'video');
  const drive = entries.some((item) => parseDriveLink(item.url));
  const many = entries.length > 1;

  return (
    <section className="media-editor" aria-label="الصور والفيديو بملء الشاشة">
      <div className="media-add">
        <input
          ref={picker}
          hidden
          type="file"
          multiple
          aria-label="ملفات من الجوال"
          accept="video/mp4,video/x-m4v,video/webm,.mp4,.m4v,.webm,image/jpeg,image/png,image/webp,image/gif,audio/*"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            if (files.length) void upload(files);
          }}
        />
        <button
          type="button"
          className="button primary media-add-phone"
          disabled={busy || !!uploading || entries.length >= LIMIT}
          onClick={() => picker.current?.click()}
        >
          <Smartphone size={20} />
          {uploading ? 'جارٍ الرفع…' : entries.length ? 'إضافة ملفات' : 'اختيار صورة أو فيديو'}
        </button>
        <div className="media-link">
          <Link2 size={18} />
          <input
            dir="ltr"
            type="url"
            value={link}
            aria-label="رابط ملف"
            placeholder="رابط Google Drive أو https://"
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && link.trim() && addLink()}
          />
          <button
            type="button"
            className="button white"
            disabled={busy || !link.trim()}
            onClick={addLink}
          >
            إضافة
          </button>
        </div>
        <small>
          MP4 / WebM، صور JPG / PNG / WebP / GIF، أو صوت. ملف واحد يُعرض بملء الشاشة، وأكثر من ملف
          يصبح قائمة تُعرض بالترتيب.
        </small>
        {uploading && (
          <p className="media-note" role="status">
            {uploading}
          </p>
        )}
        {message && !uploading && (
          <p className="media-note" role="status">
            {message}
          </p>
        )}
      </div>

      {!!entries.length && (
        <>
          <div className="media-list-head">
            <b>{many ? `قائمة العرض · ${entries.length} ملفات` : 'يُعرض بملء الشاشة'}</b>
            {many && <span>بالترتيب من الأعلى</span>}
          </div>
          <ol className="media-list">
            {entries.map((item, index) => {
              const Icon = kindIcon[item.type];
              return (
                <li key={item.id}>
                  <div className="media-row">
                    <span className="media-thumb">
                      {item.type === 'image' ? (
                        <img src={item.url} alt="" style={mediaCropStyle(item.crop)} />
                      ) : (
                        <Icon size={22} />
                      )}
                    </span>
                    <span className="media-text">
                      <input
                        dir="auto"
                        aria-label={'اسم الملف ' + (index + 1)}
                        value={item.name}
                        onChange={(e) => change(item.id, { name: e.target.value })}
                      />
                      <small>
                        {kindName[item.type]}
                        {parseDriveLink(item.url) ? ' · Google Drive' : ''}
                      </small>
                    </span>
                    <span className="media-actions">
                      {many && (
                        <>
                          <button
                            type="button"
                            aria-label={'تحريك الملف ' + (index + 1) + ' للأعلى'}
                            disabled={busy || index === 0}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={18} />
                          </button>
                          <button
                            type="button"
                            aria-label={'تحريك الملف ' + (index + 1) + ' للأسفل'}
                            disabled={busy || index === entries.length - 1}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={18} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="danger"
                        aria-label={'حذف الملف ' + (index + 1)}
                        disabled={busy}
                        onClick={() => commit(latest.current.filter((v) => v.id !== item.id))}
                      >
                        <Trash2 size={18} />
                      </button>
                    </span>
                  </div>
                  {item.type !== 'audio' && (
                    <details className="media-more">
                      <summary>القص{many && item.type === 'image' ? ' والمدة' : ''}</summary>
                      {many && item.type === 'image' && (
                        <label>
                          مدة الصورة (ثوانٍ)
                          <input
                            type="number"
                            min="3"
                            max="600"
                            aria-label={'مدة الصورة ' + (index + 1)}
                            value={item.seconds || 10}
                            onChange={(e) =>
                              change(item.id, {
                                seconds: Math.max(3, Math.min(600, +e.target.value || 10)),
                              })
                            }
                          />
                        </label>
                      )}
                      <CropEditor
                        label={'قص الملف ' + (index + 1)}
                        value={item.crop}
                        onChange={(crop) => change(item.id, { crop })}
                      />
                    </details>
                  )}
                </li>
              );
            })}
          </ol>

          <details className="media-options">
            <summary>خيارات التشغيل</summary>
            {(hasVideo || entries.some((item) => item.type === 'audio')) && (
              <label>
                <input
                  type="checkbox"
                  checked={content.videoSound !== false}
                  onChange={(e) => edit('videoSound', e.target.checked)}
                />
                تشغيل الصوت على التلفزيون
              </label>
            )}
            {many ? (
              <label>
                <input
                  type="checkbox"
                  checked={playlist.loop}
                  onChange={(e) => edit('videoPlaylist', { ...playlist, loop: e.target.checked })}
                />
                تكرار القائمة باستمرار
              </label>
            ) : (
              hasVideo && (
                <label>
                  بعد انتهاء الفيديو
                  <select
                    aria-label="بعد انتهاء الفيديو"
                    value={content.videoLoop === false ? 'stop' : 'loop'}
                    onChange={(e) => edit('videoLoop', e.target.value === 'loop')}
                  >
                    <option value="loop">تكرار الفيديو</option>
                    <option value="stop">إيقاف عند آخر إطار</option>
                  </select>
                </label>
              )
            )}
            {hasVideo && (
              <label>
                <input
                  type="checkbox"
                  checked={!!content.videoControls}
                  onChange={(e) => edit('videoControls', e.target.checked)}
                />
                إظهار أزرار التشغيل على التلفزيون
              </label>
            )}
            <label>
              ملاءمة الصورة/الفيديو
              <select
                aria-label="ملاءمة الوسائط"
                value={content.mediaFit || 'cover'}
                onChange={(e) => edit('mediaFit', e.target.value as Content['mediaFit'])}
              >
                <option value="cover">تغطية · ملء الشاشة مع القص</option>
                <option value="contain">احتواء · عرض الملف كاملًا</option>
                <option value="fill">تمدد</option>
              </select>
            </label>
            {drive && !many && content.fullType !== 'audio' && (
              <>
                <label>
                  فيديو Drive
                  <select
                    aria-label="تجهيز فيديو Drive"
                    value={content.videoPreparation || 'stream'}
                    onChange={(e) =>
                      edit('videoPreparation', e.target.value as Content['videoPreparation'])
                    }
                  >
                    <option value="cache">تنزيل كامل على التلفزيون ثم التشغيل (الأفضل)</option>
                    <option value="buffer">انتظار ١٠ ثوانٍ ثم التشغيل</option>
                    <option value="stream">تشغيل مباشر</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button white"
                  onClick={() =>
                    Promise.all([clearDriveVideoCache(), removeShowAsset(content.fullMedia || '')])
                      .then(() => setMessage('مُسحت نسخة Drive المحفوظة في هذا المتصفح.'))
                      .catch(() => setMessage('تعذر مسح النسخة المحفوظة.'))
                  }
                >
                  مسح نسخة Drive المحفوظة (بعد تغيير الملف في Drive)
                </button>
              </>
            )}
            <p className="field-hint">
              التلفزيون يجهّز الملفات كاملة قبل عرضها ويبقي العرض السابق حتى تصبح جاهزة. حد الملف
              ٥١٢ ميجابايت.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

function fileName(url: string) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return name.replace(/^[0-9a-f-]{36}\./, 'ملف.') || 'ملف';
  } catch {
    return 'ملف';
  }
}

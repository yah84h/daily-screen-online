import { mediaLink, audioPlaybackURL } from '@/lib/mediaLinks';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from './store';
export function BackgroundAudioEditor() {
  const { content, edit } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    const mime = (
      {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        flac: 'audio/flac',
      } as Record<string, string>
    )[ext || ''];
    if (!mime || f.size > 100 * 1024 * 1024) {
      setMessage('اختر ملف صوت MP3 / M4A / WAV / OGG / FLAC حتى ١٠٠ ميجابايت.');
      return;
    }
    setBusy(true);
    setMessage('جارٍ رفع الصوت…');
    try {
      const path = 'backgrounds/audio/' + crypto.randomUUID() + '.' + ext;
      const { error } = await supabase.storage.from('media').upload(path, f, { contentType: mime });
      if (error) throw Error(error.message);
      edit('backgroundAudio', {
        ...content.backgroundAudio,
        url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl,
        name: f.name,
      });
      setMessage('الصوت جاهز. انشر المحتوى ليعمل على التلفزيون تلقائيًا.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const audio = content.backgroundAudio;
  const set = (patch: Partial<NonNullable<typeof audio>>) =>
    audio && edit('backgroundAudio', { ...audio, ...patch });
  return (
    <section className="background-audio-editor bg-audio">
      <input
        ref={file}
        hidden
        type="file"
        accept=".mp3,.m4a,.wav,.ogg,.flac"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      {audio ? (
        <div className="bg-audio-card">
          <span className="bg-audio-icon">♪</span>
          <span className="bg-audio-name">
            <bdi>{audio.name}</bdi>
            <small>
              {audio.autoplay !== false ? 'يعمل تلقائيًا على التلفزيون' : 'لا يبدأ تلقائيًا'}
              {audio.loop !== false ? ' · يتكرر' : ' · مرة واحدة'}
            </small>
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => edit('backgroundAudio', undefined)}
          >
            إزالة
          </button>
        </div>
      ) : (
        <p className="field-hint">لا يوجد صوت خلفية. ارفع ملفًا أو الصق رابطًا.</p>
      )}
      <button
        type="button"
        className="button primary"
        disabled={busy}
        onClick={() => file.current?.click()}
      >
        {busy ? 'جارٍ الرفع…' : audio ? 'تغيير ملف الصوت' : 'رفع ملف صوت من الجوال'}
      </button>
      <div className="bg-audio-link">
        <input
          aria-label="رابط صوت مباشر أو Drive"
          type="url"
          dir="ltr"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="رابط Google Drive أو MP3"
        />
        <button
          type="button"
          className="button white"
          disabled={busy || !link.trim()}
          onClick={() => {
            const parsed = mediaLink(link, 'audio');
            if (!parsed || parsed.kind !== 'audio') {
              setMessage('أدخل رابط ملف صوت HTTPS مباشر مثل MP3، أو رابط Drive عام.');
              return;
            }
            edit('backgroundAudio', {
              ...audio,
              url: parsed.url,
              name: parsed.drive ? 'صوت Google Drive' : 'صوت من رابط مباشر',
            });
            setLink('');
            setMessage('تم اختيار الصوت. انشر المحتوى لتطبيقه.');
          }}
        >
          استخدام الرابط
        </button>
      </div>
      {audio && (
        <>
          <label>
            <input
              type="checkbox"
              checked={audio.autoplay !== false}
              onChange={(e) => set({ autoplay: e.target.checked })}
            />
            تشغيل تلقائي على التلفزيون
          </label>
          <label>
            <input
              type="checkbox"
              checked={audio.loop !== false}
              onChange={(e) => set({ loop: e.target.checked })}
            />
            تكرار الصوت باستمرار
          </label>
          <label className="bg-audio-volume">
            مستوى الصوت <b dir="ltr">{Math.round((audio.volume ?? 0.5) * 100)}%</b>
            <input
              type="range"
              aria-label="مستوى صوت الخلفية"
              min={0}
              max={100}
              step={5}
              value={Math.round((audio.volume ?? 0.5) * 100)}
              onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            />
          </label>
          <label>
            معاينة على هذا الجهاز
            <audio controls preload="metadata" src={audioPlaybackURL(audio.url)} />
          </label>
        </>
      )}
      <p className="field-hint">
        يُنزّل التلفزيون الصوت كاملًا قبل التشغيل ويحفظه. انشر المحتوى بعد أي تغيير.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

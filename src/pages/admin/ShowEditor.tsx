import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  FileVideo,
  Image as ImageIcon,
  Link2,
  Loader2,
  Monitor,
  Play,
  Moon,
  Pause,
  Presentation,
  RotateCcw,
  RotateCw,
  SkipBack,
  Volume2,
  VolumeX,
  Smartphone,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useShowRemote, SHOW_FILE_LIMIT, type ShowItem } from '@/lib/show';
import type { ShowSettings } from '../../../local-test/show-state.mjs';
import { partKey, showSteps } from '../../../local-test/show-state.mjs';
import { renderPptxSlides } from '@/lib/browserPresentation';
import { parseDriveLink } from '@/lib/driveVideo';
import { useAdmin } from './store';

const kindIcon = { video: FileVideo, image: ImageIcon, deck: Presentation };
const kindName = { video: 'فيديو', image: 'صورة', deck: 'PowerPoint' };
const mb = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? (bytes / 1024 / 1024 / 1024).toFixed(1) + ' جيجابايت'
    : Math.max(1, Math.round(bytes / 1024 / 1024)) + ' ميجابايت';

/** Presenting mode: prepare everything on the TV first, then present from the phone. */
export function ShowEditor() {
  const { data, template, saveDesign, busy, notify } = useAdmin();
  const saved = data?.screen.template;
  const key = template.showKey || '';
  const applied = saved?.displayMode === 'show' && !!saved.showKey && saved.showKey === key;
  if (!data) return null;
  if (!applied)
    return (
      <section className="show-editor show-apply">
        <Monitor size={28} />
        <div>
          <h2>طبّق وضع التقديم على الشاشة</h2>
          <p>
            بعد التطبيق يتحول التلفزيون إلى شاشة انتظار بشعار المدرسة، وتبدأ بإرسال الملفات إليه.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void saveDesign().then((ok) => ok && notify('التلفزيون في وضع التقديم.'))}
        >
          تطبيق على الشاشة
        </button>
      </section>
    );
  return <ShowRemote screen={data.screen.id} showKey={key} />;
}

function ShowRemote({ screen, showKey }: { screen: string; showKey: string }) {
  const { notify } = useAdmin();
  const remote = useShowRemote(screen, showKey);
  const { status, online, readiness, sending, send, sendFiles } = remote;
  const files = useRef(new Map<string, Blob[]>());
  const picker = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [linkKind, setLinkKind] = useState<'video' | 'image'>('video');
  const [preparing, setPreparing] = useState('');
  const [pending, setPending] = useState(false);
  const show = status?.show;
  const steps = show ? showSteps(show.items) : [];
  const live = show?.phase === 'live' || show?.phase === 'paused';
  const current = show && steps[show.step];
  const currentItem = current && show?.items.find((item) => item.id === current.item);
  const nextStep = show && steps[show.step + 1];
  const nextItem = nextStep && show?.items.find((item) => item.id === nextStep.item);
  const rate = useRates();
  const [localSettings, setLocalSettings] = useState<Partial<ShowSettings>>({});

  const act = async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setPending(false);
    }
  };
  const transmit = async (item: ShowItem) => {
    const parts = files.current.get(item.id);
    if (!parts) return notify('اختر الملف من جوالك مرة أخرى.');
    try {
      await sendFiles(item, parts);
      files.current.delete(item.id);
    } catch (error) {
      notify((error as Error).message);
    }
  };
  const addFiles = async (list: FileList | null) => {
    for (const file of Array.from(list || [])) {
      const id = crypto.randomUUID();
      try {
        let item: ShowItem, parts: Blob[];
        if (/\.pptx$/i.test(file.name)) {
          const slides: Blob[] = [];
          await renderPptxSlides(
            file,
            (percent, stage) => setPreparing(file.name + ' · ' + stage + ' ' + percent + '٪'),
            async (blob) => void slides.push(blob),
          );
          item = {
            id,
            kind: 'deck',
            source: 'phone',
            url: '',
            name: file.name,
            parts: slides.length,
            size: slides.reduce((sum, slide) => sum + slide.size, 0),
          };
          parts = slides;
        } else {
          const kind = file.type.startsWith('video/')
            ? 'video'
            : file.type.startsWith('image/')
              ? 'image'
              : null;
          if (!kind) throw Error(file.name + ': اختر فيديو أو صورة أو ملف PPTX.');
          if (file.size > SHOW_FILE_LIMIT) throw Error(file.name + ': أكبر من ٢ جيجابايت.');
          item = { id, kind, source: 'phone', url: '', name: file.name, parts: 1, size: file.size };
          parts = [file];
        }
        setPreparing('');
        files.current.set(id, parts);
        await send({ op: 'add', item });
        await transmit(item);
      } catch (error) {
        setPreparing('');
        notify((error as Error).message);
      }
    }
  };
  const addLink = () =>
    act(async () => {
      const url = link.trim();
      if (!/^https:\/\//.test(url)) throw Error('الصق رابطًا يبدأ بـ https://');
      const drive = parseDriveLink(url);
      await send({
        op: 'add',
        item: {
          id: crypto.randomUUID(),
          kind: linkKind,
          source: 'link',
          url,
          name: drive ? 'Google Drive · ' + drive.id.slice(0, 8) : url.split('/').pop() || 'رابط',
        },
      });
      setLink('');
    });

  /** Per-file state: where it is, how far, how fast, how long left. */
  const itemState = (item: ShowItem) => {
    const total = item.kind === 'deck' ? item.parts : 1;
    let done = 0;
    for (let part = 0; part < total; part++) if (status?.stored[partKey(item.id, part)]) done++;
    const out = sending[item.id];
    const tv = status?.progress[item.id];
    if (done === total) return { tone: 'ok', text: 'على التلفزيون ✓', fraction: 1 };
    if (out?.error || tv?.error)
      return { tone: 'error', text: out?.error || tv?.error || '', fraction: 0 };
    if (out && out.sent < out.total) {
      const speed = rate('send:' + item.id, out.sent);
      return {
        tone: 'busy',
        text: 'إرسال من الجوال',
        fraction: out.sent / Math.max(1, out.total),
        detail: speedText(speed, out.total - out.sent, out.sent, out.total),
      };
    }
    if (tv && item.source === 'link') {
      const speed = rate('tv:' + item.id, tv.loaded);
      return {
        tone: 'busy',
        text: 'التلفزيون ينزّل',
        fraction: tv.total ? tv.loaded / tv.total : 0,
        detail: speedText(speed, tv.total ? tv.total - tv.loaded : 0, tv.loaded, tv.total),
      };
    }
    if (out || tv)
      return {
        tone: 'busy',
        text: 'التلفزيون يحفظ ويفحص الملف…',
        fraction: Math.max(0.98, done / total),
      };
    return {
      tone: 'wait',
      fraction: done / total,
      text:
        item.source === 'phone'
          ? files.current.has(item.id)
            ? 'بانتظار الإرسال'
            : 'لم يصل. احذفه وأضفه من جديد'
          : 'بانتظار التنزيل',
    };
  };
  const states = show ? show.items.map((item) => [item, itemState(item)] as const) : [];
  const overall = states.length
    ? states.reduce((sum, [, state]) => sum + state.fraction, 0) / states.length
    : 0;
  const totalSize = show?.items.reduce((sum, item) => sum + (item.size || 0), 0) || 0;
  // Toggles switch instantly on the phone; the TV's next status confirms them.
  const settings = show?.settings && { ...show.settings, ...localSettings };
  const changeSettings = (patch: Partial<ShowSettings>) => {
    setLocalSettings((current) => ({ ...current, ...patch }));
    void act(() => send({ op: 'settings', settings: patch })).finally(() =>
      setTimeout(() => setLocalSettings({}), 1500),
    );
  };
  const playback = status?.playback;

  const settingsPanel = show && settings && (
    <details className="show-settings" open={!live}>
      <summary>إعدادات التشغيل</summary>
      <label>
        <input
          type="checkbox"
          checked={settings.autoNext}
          onChange={(e) => changeSettings({ autoNext: e.target.checked })}
        />
        انتقال تلقائي: بعد انتهاء الفيديو، وبعد مدة لكل صورة
      </label>
      {settings.autoNext && (
        <label className="show-seconds">
          مدة كل صورة / شريحة
          <select
            value={settings.imageSeconds}
            onChange={(e) => changeSettings({ imageSeconds: Number(e.target.value) })}
          >
            {[5, 8, 10, 15, 20, 30, 45, 60, 120].map((n) => (
              <option key={n} value={n}>
                {n} ثانية
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={settings.loop}
          onChange={(e) => changeSettings({ loop: e.target.checked })}
        />
        تكرار العرض من البداية بعد آخر ملف
      </label>
    </details>
  );

  return (
    <section className="show-editor" aria-label="وضع التقديم">
      <div className={'show-status ' + (online ? (readiness?.complete ? 'ready' : 'busy') : 'off')}>
        <span className="show-status-icon">
          {!online ? (
            <Monitor size={24} />
          ) : readiness?.complete ? (
            <CheckCircle2 size={24} />
          ) : (
            <Loader2 size={24} className="spin" />
          )}
        </span>
        <div>
          <b>
            {!online
              ? 'بانتظار التلفزيون…'
              : !readiness?.total
                ? 'التلفزيون متصل. أضف ملفات العرض'
                : readiness.complete
                  ? 'كل شيء محفوظ على التلفزيون. جاهز للعرض'
                  : `التلفزيون يجهّز ${readiness.ready} من ${readiness.total}`}
          </b>
          <small>
            {online
              ? 'الجمهور يرى شاشة الانتظار فقط حتى تضغط «ابدأ العرض».'
              : 'افتح صفحة /tv على التلفزيون. يظهر الاتصال خلال ثوانٍ.'}
          </small>
        </div>
      </div>
      {online && !!states.length && !live && (
        <div className="show-overall" aria-label="التقدم الكلي">
          <div>
            <b>{Math.floor(overall * 100)}٪</b>
            <span>
              {states.filter(([, state]) => state.tone === 'ok').length} / {states.length} ملفات
              {totalSize ? ' · ' + mb(totalSize) : ''}
            </span>
          </div>
          <progress value={overall} max={1} />
          {status?.storage?.quota ? (
            <small>
              مساحة التلفزيون المستخدمة: {mb(status.storage.usage)} من {mb(status.storage.quota)}
            </small>
          ) : null}
        </div>
      )}

      {live && show ? (
        <div className="show-remote">
          <div className={'show-now' + (show.blackout ? ' black' : '')}>
            <small>
              {show.phase === 'paused'
                ? 'الجمهور يرى شاشة الانتظار'
                : show.blackout
                  ? 'الشاشة سوداء الآن'
                  : 'يُعرض الآن'}
            </small>
            <b>
              <bdi>{currentItem?.name || '—'}</bdi>
              {currentItem?.kind === 'deck' && current ? ' · شريحة ' + (current.part + 1) : ''}
            </b>
            <span dir="ltr">{`${show.step + 1} / ${steps.length}`}</span>
            <progress value={show.step + 1} max={steps.length} />
            {nextItem && (
              <small className="show-next-up">
                التالي: <bdi>{nextItem.name}</bdi>
                {nextItem.kind === 'deck' && nextStep ? ' · شريحة ' + (nextStep.part + 1) : ''}
              </small>
            )}
          </div>

          <div className="show-remote-main">
            <button
              className="button white show-big"
              aria-label="السابق"
              disabled={pending || show.step === 0}
              onClick={() => act(() => send({ op: 'previous' }))}
            >
              <ChevronRight size={30} />
            </button>
            <button
              className="button primary show-big show-next"
              aria-label="التالي"
              disabled={pending || (show.step >= steps.length - 1 && !settings?.loop)}
              onClick={() =>
                act(() =>
                  send(show.step >= steps.length - 1 ? { op: 'goto', index: 0 } : { op: 'next' }),
                )
              }
            >
              التالي
              <ChevronLeft size={30} />
            </button>
          </div>

          {current?.kind === 'video' && (
            <div className="show-video-panel" aria-label="التحكم بالفيديو">
              <div className="show-time" dir="ltr">
                <span>{clock(playback?.time || 0)}</span>
                <input
                  type="range"
                  aria-label="موضع الفيديو"
                  min={0}
                  max={Math.max(1, playback?.duration || 0)}
                  step={1}
                  value={Math.min(playback?.time || 0, playback?.duration || 0)}
                  disabled={!playback?.duration}
                  onChange={(e) =>
                    void act(() =>
                      send({ op: 'video', action: 'seek', value: Number(e.target.value) }),
                    )
                  }
                />
                <span>{clock(playback?.duration || 0)}</span>
              </div>
              <div className="show-video-buttons">
                <button
                  className="button white"
                  aria-label="رجوع ١٠ ثوانٍ"
                  onClick={() => act(() => send({ op: 'video', action: 'skip', value: -10 }))}
                >
                  <RotateCcw size={18} />
                  ١٠
                </button>
                <button
                  className="button primary show-play"
                  aria-label={playback?.paused ? 'تشغيل الفيديو' : 'إيقاف الفيديو مؤقتًا'}
                  onClick={() =>
                    act(() => send({ op: 'video', action: playback?.paused ? 'play' : 'pause' }))
                  }
                >
                  {playback?.paused ? <Play size={22} /> : <Pause size={22} />}
                </button>
                <button
                  className="button white"
                  aria-label="تقديم ١٠ ثوانٍ"
                  onClick={() => act(() => send({ op: 'video', action: 'skip', value: 10 }))}
                >
                  ١٠
                  <RotateCw size={18} />
                </button>
                <button
                  className="button white"
                  aria-label="الفيديو من البداية"
                  onClick={() => act(() => send({ op: 'video', action: 'restart' }))}
                >
                  <SkipBack size={18} />
                </button>
              </div>
              <div className="show-volume">
                <button
                  aria-label={playback?.muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                  onClick={() =>
                    act(() => send({ op: 'video', action: 'mute', value: !playback?.muted }))
                  }
                >
                  {playback?.muted || !playback?.volume ? (
                    <VolumeX size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
                <input
                  type="range"
                  aria-label="مستوى الصوت"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((playback?.muted ? 0 : (playback?.volume ?? 1)) * 100)}
                  onChange={(e) =>
                    void act(() =>
                      send({ op: 'video', action: 'volume', value: Number(e.target.value) / 100 }),
                    )
                  }
                />
                <span dir="ltr">
                  {Math.round((playback?.muted ? 0 : (playback?.volume ?? 1)) * 100)}٪
                </span>
              </div>
            </div>
          )}

          <div className="show-remote-row">
            <button
              className={'button white' + (show.blackout ? ' active' : '')}
              aria-pressed={show.blackout}
              onClick={() => act(() => send({ op: 'blackout' }))}
            >
              <Moon size={18} />
              {show.blackout ? 'إظهار الشاشة' : 'شاشة سوداء'}
            </button>
            {show.phase === 'paused' ? (
              <button className="button white" onClick={() => act(() => send({ op: 'resume' }))}>
                <Play size={18} />
                متابعة العرض
              </button>
            ) : (
              <button className="button white" onClick={() => act(() => send({ op: 'standby' }))}>
                <CirclePause size={18} />
                شاشة الانتظار
              </button>
            )}
          </div>
          <button className="button white danger" onClick={() => act(() => send({ op: 'end' }))}>
            <Square size={18} />
            إنهاء العرض
          </button>
          {settingsPanel}
          <ol className="show-jump" aria-label="الانتقال إلى">
            {steps.map((step, index) => {
              const item = show.items.find((entry) => entry.id === step.item);
              const Icon = item ? kindIcon[item.kind] : ImageIcon;
              return (
                <li key={step.item + step.part}>
                  <button
                    aria-current={index === show.step ? 'step' : undefined}
                    onClick={() => act(() => send({ op: 'goto', index }))}
                  >
                    <em>{index + 1}</em>
                    <Icon size={16} />
                    <bdi>{item?.name}</bdi>
                    {item?.kind === 'deck' ? ' · ' + (step.part + 1) : ''}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <>
          <label className="show-title">
            عنوان العرض (يظهر على شاشة الانتظار)
            <input
              key={show?.title}
              defaultValue={show?.title || ''}
              maxLength={80}
              placeholder="مثال: حفل التخرج ١٤٤٨"
              disabled={!online}
              onBlur={(e) =>
                e.target.value !== (show?.title || '') &&
                void act(() => send({ op: 'title', title: e.target.value }))
              }
            />
          </label>
          <div className="show-add">
            <input
              ref={picker}
              type="file"
              hidden
              multiple
              accept="video/mp4,video/webm,image/*,.pptx"
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              className="button primary show-add-phone"
              disabled={!online || !!preparing}
              onClick={() => picker.current?.click()}
            >
              <Smartphone size={20} />
              إرسال ملفات من الجوال
            </button>
            <small>فيديو MP4، صور، أو PowerPoint (يتحول إلى شرائح على جوالك).</small>
            {preparing && <p className="show-preparing">{preparing}</p>}
            <div className="show-link">
              <Link2 size={18} />
              <input
                dir="ltr"
                value={link}
                placeholder="رابط Google Drive أو https://"
                aria-label="رابط ملف"
                disabled={!online}
                onChange={(e) => setLink(e.target.value)}
              />
              <select
                aria-label="نوع الرابط"
                value={linkKind}
                onChange={(e) => setLinkKind(e.target.value as 'video' | 'image')}
              >
                <option value="video">فيديو</option>
                <option value="image">صورة</option>
              </select>
              <button
                className="button white"
                disabled={!online || pending || !link.trim()}
                onClick={() => void addLink()}
              >
                إضافة
              </button>
            </div>
          </div>
          <ol className="show-items">
            {states.map(([item, state], index) => {
              const Icon = kindIcon[item.kind];
              return (
                <li key={item.id} className={'tone-' + state.tone}>
                  <span className="show-item-icon">
                    <Icon size={20} />
                  </span>
                  <span className="show-item-text">
                    <b>
                      {index + 1}. <bdi>{item.name}</bdi>
                    </b>
                    <small>
                      {kindName[item.kind]}
                      {item.kind === 'deck' ? ' · ' + item.parts + ' شريحة' : ''}
                      {item.size ? ' · ' + mb(item.size) : ''}
                    </small>
                    <small className="show-item-state">
                      {state.tone === 'error' && <TriangleAlert size={14} />}
                      {state.text}
                      {state.tone === 'busy' && state.fraction < 1
                        ? ' ' + Math.floor(state.fraction * 100) + '٪'
                        : ''}
                    </small>
                    {state.tone === 'busy' && (
                      <progress className="show-item-bar" value={state.fraction} max={1} />
                    )}
                    {state.detail && <small className="show-item-detail">{state.detail}</small>}
                  </span>
                  <span className="show-item-actions">
                    {state.tone === 'error' && files.current.has(item.id) && (
                      <button aria-label="إعادة الإرسال" onClick={() => void transmit(item)}>
                        <RotateCcw size={18} />
                      </button>
                    )}
                    <button
                      aria-label={'تحريك ' + item.name + ' للأعلى'}
                      disabled={pending || index === 0}
                      onClick={() => act(() => send({ op: 'move', id: item.id, by: -1 }))}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      aria-label={'تحريك ' + item.name + ' للأسفل'}
                      disabled={pending || index === states.length - 1}
                      onClick={() => act(() => send({ op: 'move', id: item.id, by: 1 }))}
                    >
                      <ArrowDown size={18} />
                    </button>
                    <button
                      aria-label={'حذف ' + item.name}
                      disabled={pending}
                      onClick={() => act(() => send({ op: 'remove', id: item.id }))}
                    >
                      <Trash2 size={18} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          {settingsPanel}
          <button
            className="button primary show-start"
            disabled={!online || pending || !readiness?.complete}
            onClick={() => act(() => send({ op: 'start' }))}
          >
            <Play size={22} />
            {readiness?.complete
              ? 'ابدأ العرض'
              : readiness?.total
                ? 'ينتظر اكتمال التجهيز على التلفزيون… ' + Math.floor(overall * 100) + '٪'
                : 'أضف ملفًا لتبدأ'}
          </button>
        </>
      )}
    </section>
  );
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/** Transfer speed (bytes/second) per key, smoothed, from successive byte counts. */
function useRates() {
  const samples = useRef(new Map<string, { bytes: number; at: number; speed: number }>());
  return (key: string, bytes: number) => {
    const now = Date.now();
    const last = samples.current.get(key);
    if (!last || bytes < last.bytes) {
      samples.current.set(key, { bytes, at: now, speed: 0 });
      return 0;
    }
    const elapsed = (now - last.at) / 1000;
    if (elapsed < 0.8) return last.speed;
    const instant = (bytes - last.bytes) / elapsed;
    const speed = last.speed ? last.speed * 0.6 + instant * 0.4 : instant;
    samples.current.set(key, { bytes, at: now, speed });
    return speed;
  };
}

function speedText(speed: number, remaining: number, done: number, total: number) {
  const parts = [total ? mb(done) + ' من ' + mb(total) : mb(done)];
  if (speed > 0) {
    parts.push((speed / 1024 / 1024).toFixed(1) + ' ميجابايت/ث');
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / speed);
      parts.push('متبقٍ ' + (seconds < 60 ? seconds + ' ث' : Math.ceil(seconds / 60) + ' د'));
    }
  }
  return parts.join(' · ');
}

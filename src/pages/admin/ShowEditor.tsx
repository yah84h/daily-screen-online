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
  Presentation,
  RotateCcw,
  Smartphone,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useShowRemote, SHOW_FILE_LIMIT, type ShowItem } from '@/lib/show';
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

  const itemState = (item: ShowItem) => {
    const total = item.kind === 'deck' ? item.parts : 1;
    let done = 0;
    for (let part = 0; part < total; part++) if (status?.stored[partKey(item.id, part)]) done++;
    const out = sending[item.id];
    const tv = status?.progress[item.id];
    if (done === total) return { tone: 'ok', text: 'على التلفزيون ✓' };
    if (out?.error || tv?.error) return { tone: 'error', text: out?.error || tv?.error || '' };
    if (out)
      return {
        tone: 'busy',
        text: 'إرسال من الجوال ' + Math.floor((out.sent / Math.max(1, out.total)) * 100) + '٪',
      };
    if (tv)
      return {
        tone: 'busy',
        text:
          item.source === 'link'
            ? 'التلفزيون ينزّل ' +
              (tv.total ? Math.floor((tv.loaded / tv.total) * 100) + '٪' : mb(tv.loaded))
            : 'التلفزيون يحفظ…',
      };
    return {
      tone: 'wait',
      text:
        item.source === 'phone'
          ? files.current.has(item.id)
            ? 'بانتظار الإرسال'
            : 'لم يصل. احذفه وأضفه من جديد'
          : 'بانتظار التنزيل',
    };
  };

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
              ? 'الملفات تُحفظ على التلفزيون نفسه، ولا تُرفع إلى الخادم.'
              : 'افتح صفحة /tv على التلفزيون. يظهر الاتصال خلال ثوانٍ.'}
          </small>
        </div>
      </div>

      {live && show ? (
        <div className="show-remote">
          <div className="show-now">
            <small>{show.phase === 'paused' ? 'الشاشة على الانتظار' : 'يُعرض الآن'}</small>
            <b>{currentItem?.name || '—'}</b>
            <span dir="ltr">{`${show.step + 1} / ${steps.length}`}</span>
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
              disabled={pending || show.step >= steps.length - 1}
              onClick={() => act(() => send({ op: 'next' }))}
            >
              التالي
              <ChevronLeft size={30} />
            </button>
          </div>
          {current?.kind === 'video' && (
            <div className="show-remote-row">
              <button
                className="button white"
                onClick={() => act(() => send({ op: 'video', action: 'toggle' }))}
              >
                <Play size={18} />
                تشغيل / إيقاف الفيديو
              </button>
              <button
                className="button white"
                onClick={() => act(() => send({ op: 'video', action: 'restart' }))}
              >
                <RotateCcw size={18} />
                من البداية
              </button>
            </div>
          )}
          <div className="show-remote-row">
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
            <button className="button white danger" onClick={() => act(() => send({ op: 'end' }))}>
              <Square size={18} />
              إنهاء العرض
            </button>
          </div>
          <ol className="show-jump" aria-label="الانتقال إلى">
            {steps.map((step, index) => {
              const item = show.items.find((entry) => entry.id === step.item);
              return (
                <li key={step.item + step.part}>
                  <button
                    aria-current={index === show.step ? 'step' : undefined}
                    onClick={() => act(() => send({ op: 'goto', index }))}
                  >
                    <em>{index + 1}</em>
                    {item?.name}
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
            {show?.items.map((item, index) => {
              const Icon = kindIcon[item.kind];
              const state = itemState(item);
              return (
                <li key={item.id} className={'tone-' + state.tone}>
                  <span className="show-item-icon">
                    <Icon size={20} />
                  </span>
                  <span className="show-item-text">
                    <b>
                      {index + 1}. {item.name}
                    </b>
                    <small>
                      {kindName[item.kind]}
                      {item.kind === 'deck' ? ' · ' + item.parts + ' شريحة' : ''}
                      {item.size ? ' · ' + mb(item.size) : ''}
                    </small>
                    <small className="show-item-state">
                      {state.tone === 'error' && <TriangleAlert size={14} />}
                      {state.text}
                    </small>
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
                      disabled={pending || index === show.items.length - 1}
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
          <button
            className="button primary show-start"
            disabled={!online || pending || !readiness?.complete}
            onClick={() => act(() => send({ op: 'start' }))}
          >
            <Play size={22} />
            {readiness?.complete
              ? 'ابدأ العرض'
              : readiness?.total
                ? 'ينتظر اكتمال التجهيز على التلفزيون…'
                : 'أضف ملفًا لتبدأ'}
          </button>
        </>
      )}
    </section>
  );
}

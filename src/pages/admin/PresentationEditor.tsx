import { uploadBrowserPresentation } from '@/lib/browserPresentation';
import { useRef, useState } from 'react';
import { isLocalBackend } from '@/lib/supabase';
import { usePresentation, type Presentation } from '@/lib/presentation';
import { useAdmin } from './store';
import { ChevronLeft, ChevronRight, FileUp, Moon } from 'lucide-react';
import { useRemoteMedia } from '@/lib/remoteMedia';

/** The TV hides slide preparation from the audience; the phone shows it instead. */
function TvPreparation({ screenId, slides }: { screenId: string; slides: number }) {
  const remote = useRemoteMedia(screenId);
  const now = Date.now();
  const reports = Object.values(remote.state?.reports || {}).filter((r) => now - r.at < 20000);
  if (!reports.length)
    return (
      <p className="tv-prep wait" role="status">
        بانتظار تقرير التلفزيون… افتح صفحة /tv على التلفزيون.
      </p>
    );
  const tasks = reports.flatMap((r) => r.tasks.filter((t) => /PowerPoint|الشرائح/.test(t.label)));
  const failed = tasks.find((t) => t.error);
  const busy = tasks[0];
  return (
    <p className={'tv-prep ' + (failed ? 'error' : busy ? 'busy' : 'ready')} role="status">
      {failed
        ? 'تعذر تجهيز الشرائح على التلفزيون: ' + failed.error + ' (يعيد المحاولة تلقائيًا)'
        : busy
          ? `التلفزيون يجهّز الشرائح ${Math.floor(busy.loaded)} من ${busy.total || slides}… الجمهور يرى شاشة الانتظار.`
          : 'كل الشرائح جاهزة على التلفزيون.'}
    </p>
  );
}
function Remote({ deck, screenId }: { deck: Presentation; screenId: string }) {
  const state = usePresentation(deck, { screenId });
  const count = deck.slides.length;
  const next = deck.slides[state.slide + 1];
  return (
    <section className="presentation-remote ppt-remote" aria-label="التحكم بالعرض">
      <div className={'ppt-now' + (state.black ? ' black' : '')}>
        <small role="status">
          {state.error ||
            (!state.ready
              ? 'انشر العرض لتفعيل التحكم'
              : `الشريحة ${state.slide + 1} من ${count}` + (state.black ? ' · الشاشة سوداء' : ''))}
        </small>
        <img src={deck.slides[state.slide]} alt={'الشريحة ' + (state.slide + 1)} />
        <span dir="ltr">{`${state.slide + 1} / ${count}`}</span>
        <progress value={state.slide + 1} max={count} />
        {next && (
          <small className="ppt-next">
            <img src={next} alt="" />
            التالي: الشريحة {state.slide + 2}
          </small>
        )}
      </div>
      <div className="presentation-remote-buttons ppt-main">
        <button
          className="button white ppt-big"
          aria-label="الشريحة السابقة"
          disabled={!state.ready || state.slide === 0}
          onClick={() => void state.command('previous')}
        >
          <ChevronRight size={30} />
        </button>
        <button
          className="button primary ppt-big"
          aria-label="الشريحة التالية"
          disabled={!state.ready || state.slide >= count - 1}
          onClick={() => void state.command('next')}
        >
          التالي
          <ChevronLeft size={30} />
        </button>
      </div>
      <div className="ppt-row">
        <button
          className="button white"
          disabled={!state.ready}
          onClick={() => void state.command('first')}
        >
          الأولى
        </button>
        <button
          className={'button white' + (state.black ? ' active' : '')}
          aria-pressed={state.black}
          disabled={!state.ready}
          onClick={() => void state.command('black')}
        >
          <Moon size={18} />
          {state.black ? 'إظهار العرض' : 'شاشة سوداء'}
        </button>
        <button
          className="button white"
          disabled={!state.ready}
          onClick={() => void state.command('last')}
        >
          الأخيرة
        </button>
      </div>
      <div className="presentation-thumbnails ppt-grid">
        {deck.slides.map((url, i) => (
          <button
            key={url}
            aria-label={'انتقل إلى الشريحة ' + (i + 1)}
            aria-pressed={state.slide === i}
            disabled={!state.ready}
            onClick={() => void state.command('goto', i)}
          >
            <img src={url} alt="" loading="lazy" />
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
export function PresentationEditor() {
  const { content, edit, data } = useAdmin();
  const file = useRef<HTMLInputElement>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  async function upload(input: File) {
    if (!/\.pptx$/i.test(input.name) || input.size > 100 * 1024 * 1024) {
      setError('اختر ملف PPTX حتى ١٠٠ ميجابايت.');
      return;
    }
    setBusy(true);
    setError('');
    setProgress(0);
    setStage('رفع الملف…');
    try {
      if (!isLocalBackend) {
        const deck = await uploadBrowserPresentation(input, (percent, text) => {
          setProgress(percent);
          setStage(text);
        });
        edit('presentation', deck);
        setStage('العرض جاهز. انشره على الشاشة، ثم استخدم أزرار التحكم.');
        return;
      }
      const job = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        request.current = xhr;
        xhr.open('POST', '/local/presentations?name=' + encodeURIComponent(input.name));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.upload.onload = () => setStage('تجهيز ملف العرض…');
        xhr.onload = () => {
          let body;
          try {
            body = JSON.parse(xhr.responseText);
          } catch {
            reject(Error('تعذر رفع الملف'));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(Error(body.error?.message || 'تعذر رفع الملف'));
        };
        xhr.onerror = () => reject(Error('انقطع الاتصال أثناء الرفع'));
        xhr.onabort = () => reject(Error('أُلغي الرفع'));
        xhr.send(input);
      });
      setStage('تحويل شرائح PowerPoint على الخادم…');
      for (let i = 0; i < 300; i++) {
        const response = await fetch('/local/presentations/' + job.id, {
          signal: AbortSignal.timeout(5000),
        });
        const state = await response.json();
        if (!response.ok) throw Error(state.error?.message || 'تعذر التحقق من التحويل');
        if (state.status === 'error') throw Error(state.error);
        if (state.status === 'ready') {
          edit('presentation', { id: state.id, name: state.name, slides: state.slides });
          setStage('العرض جاهز. انشره على الشاشة، ثم استخدم أزرار التحكم.');
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      throw Error('استغرق التحويل وقتًا طويلًا. أعد المحاولة.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      request.current = null;
    }
  }
  const deck = content.presentation;
  const published = !!deck && data?.current?.content?.presentation?.id === deck.id;
  return (
    <section className="presentation-editor ppt-editor">
      <input
        ref={file}
        hidden
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={(e) => {
          const input = e.target.files?.[0];
          if (input) void upload(input);
          e.target.value = '';
        }}
      />
      <div className="ppt-step">
        <span className="ppt-step-no">١</span>
        <div className="ppt-step-body">
          <b>ملف العرض</b>
          {deck && !busy ? (
            <div className="ppt-file">
              <img src={deck.slides[0]} alt="" />
              <span>
                <bdi>{deck.name}</bdi>
                <small>{deck.slides.length} شريحة</small>
              </span>
              <button className="button white" onClick={() => file.current?.click()}>
                تغيير
              </button>
            </div>
          ) : (
            <button
              className="button primary ppt-pick"
              disabled={busy}
              onClick={() => file.current?.click()}
              aria-label="رفع ملف PowerPoint"
            >
              <FileUp size={20} />
              {busy ? 'جارٍ تجهيز العرض…' : 'اختيار ملف PowerPoint (PPTX)'}
            </button>
          )}
          {busy && (
            <div className="ppt-progress" role="status">
              <progress value={progress} max={100} />
              <small>
                {progress}٪ · {stage}
              </small>
            </div>
          )}
          {!busy && stage && !error && (
            <small className="ppt-ok" role="status">
              {stage}
            </small>
          )}
          {error && <p role="alert">{error}</p>}
          {!deck && !busy && (
            <small>حتى ٢٠٠ شريحة و١٠٠ ميجابايت. يُحوّل على جوالك إلى صور شرائح عالية الدقة.</small>
          )}
        </div>
      </div>
      {deck && data && (
        <div className="ppt-step">
          <span className="ppt-step-no">٢</span>
          <div className="ppt-step-body">
            <b>على التلفزيون</b>
            {published ? (
              data.screen.template?.displayMode === 'presentation' ? (
                <TvPreparation screenId={data.screen.id} slides={deck.slides.length} />
              ) : (
                <small>طبّق وضع «ملف PowerPoint» على الشاشة من التصميم.</small>
              )
            ) : (
              <small className="ppt-hint">
                اضغط «نشر على الشاشة» بالأسفل. يرى الجمهور شاشة الانتظار حتى تجهز كل الشرائح.
              </small>
            )}
          </div>
        </div>
      )}
      {deck && data && (
        <div className="ppt-step">
          <span className="ppt-step-no">٣</span>
          <div className="ppt-step-body">
            <b>التحكم من الجوال</b>
            <Remote key={deck.id + data.screen.id} deck={deck} screenId={data.screen.id} />
          </div>
        </div>
      )}
      <details className="ppt-keys">
        <summary>التحكم من لوحة مفاتيح التلفزيون أو مؤشر العروض</summary>
        <p className="field-hint">
          → أو Page Down أو المسافة للتالي، ← أو Page Up للسابق، Home / End للأولى والأخيرة، B
          للشاشة السوداء، و F5 لملء الشاشة.
        </p>
      </details>
    </section>
  );
}

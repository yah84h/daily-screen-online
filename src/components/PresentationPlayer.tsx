import { useCacheTask } from '@/lib/cacheStatus';
import { preparePresentation } from '@/lib/presentationCache';
import { useEffect, useRef, useState } from 'react';
import { usePresentation, type Presentation, type PresentationContext } from '@/lib/presentation';
export function PresentationPlayer({
  deck,
  context,
  large,
}: {
  deck: Presentation;
  context?: PresentationContext;
  large: boolean;
}) {
  const deckKey = JSON.stringify([deck.id, deck.slides]);
  const [prepared, setPrepared] = useState<{
    key: string;
    urls: string[];
    loaded: number;
    persistent: boolean;
    error: string;
  }>({ key: '', urls: [], loaded: 0, persistent: true, error: '' });
  const [retry, setRetry] = useState(0);
  const ready =
    prepared.key === deckKey &&
    prepared.urls.length === deck.slides.length &&
    deck.slides.length > 0;
  useEffect(() => {
    const controller = new AbortController();
    let release = () => {};
    setPrepared({ key: deckKey, urls: [], loaded: 0, persistent: true, error: '' });
    preparePresentation(deck, controller.signal, (loaded) => {
      if (!controller.signal.aborted) setPrepared((s) => ({ ...s, loaded }));
    })
      .then((result) => {
        if (controller.signal.aborted) {
          result.release();
          return;
        }
        release = result.release;
        setPrepared({
          key: deckKey,
          urls: result.urls,
          loaded: result.urls.length,
          persistent: result.persistent,
          error: '',
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPrepared((s) => ({
            ...s,
            error: /[ء-ي]/.test(error.message || '')
              ? error.message
              : 'تعذر تجهيز العرض. تحقق من الاتصال وصلاحيات صور الشرائح ثم أعد المحاولة.',
          }));
      });
    return () => {
      controller.abort();
      release();
    };
  }, [deckKey, retry]);
  useCacheTask(
    !ready
      ? {
          label: 'تجهيز شرائح PowerPoint',
          loaded: prepared.loaded,
          total: deck.slides.length,
          error: prepared.error || undefined,
        }
      : null,
  );
  const state = usePresentation(deck, context);
  const command = useRef(state.command);
  command.current = state.command;
  useEffect(() => {
    if (!large || !ready) return;
    const handle = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')
      )
        return;
      const actions: Record<string, string> = {
        ArrowRight: 'next',
        ArrowDown: 'next',
        PageDown: 'next',
        Enter: 'next',
        ' ': 'next',
        ArrowLeft: 'previous',
        ArrowUp: 'previous',
        PageUp: 'previous',
        Backspace: 'previous',
        Home: 'first',
        End: 'last',
        b: 'black',
        B: 'black',
        '.': 'black',
      };
      if (e.key === 'F5') {
        e.preventDefault();
        document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      const action = actions[e.key];
      if (action) {
        e.preventDefault();
        void command.current(action);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [large, ready]);

  if (!ready)
    return (
      <div className="presentation-player" data-prepared="false" aria-label={deck.name}>
        <div className="presentation-preparation" role={prepared.error ? 'alert' : 'status'}>
          {prepared.error ? (
            <>
              <b>{prepared.error}</b>
              <button onClick={() => setRetry((n) => n + 1)}>إعادة المحاولة</button>
            </>
          ) : (
            <>
              <b>تجهيز جميع الشرائح قبل العرض</b>
              <progress
                value={prepared.key === deckKey ? prepared.loaded : 0}
                max={deck.slides.length || 1}
              />
              <span>
                {prepared.key === deckKey ? prepared.loaded : 0} / {deck.slides.length}
              </span>
            </>
          )}
        </div>
      </div>
    );
  return (
    <div
      className="presentation-player"
      data-prepared="true"
      data-sync-pending={state.pending}
      data-slide={state.slide}
      data-black={state.black}
      aria-label={deck.name}
    >
      {!state.black && (
        <img
          src={prepared.urls[state.slide] || prepared.urls[0]}
          alt={'الشريحة ' + (state.slide + 1)}
          draggable={false}
        />
      )}
      {large && (
        <div className="presentation-display-controls">
          <button onClick={() => void state.command('previous')} aria-label="الشريحة السابقة">
            السابق
          </button>
          <span>
            {state.slide + 1} / {deck.slides.length}
          </span>
          <button onClick={() => void state.command('next')} aria-label="الشريحة التالية">
            التالي
          </button>
        </div>
      )}
      {!prepared.persistent && large && (
        <small className="presentation-cache-note">
          العرض جاهز لهذه الجلسة؛ تعذر حفظ نسخة على الجهاز.
        </small>
      )}
      {state.error && large && <small className="presentation-connection">{state.error}</small>}
    </div>
  );
}

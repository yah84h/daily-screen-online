/** Verify a downloaded image/audio/video can open before replacing the current show. */
export function waitForMediaReady(
  url: string,
  type: 'image' | 'audio' | 'video' | undefined,
  signal: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const element =
      type === 'image' ? new Image() : document.createElement(type === 'audio' ? 'audio' : 'video');
    const timer = setTimeout(
      () => finish(Error('تعذر تجهيز الملف للتشغيل على هذا المتصفح.')),
      30000,
    );
    const abort = () => finish(new DOMException('Aborted', 'AbortError'));
    function finish(error?: Error) {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      element.onload = null;
      element.onerror = null;
      if (element instanceof HTMLMediaElement) {
        element.onloadeddata = null;
        element.removeAttribute('src');
        element.load();
      }
      error ? reject(error) : resolve();
    }
    element.onerror = () => finish(Error('صيغة أحد الملفات غير مدعومة.'));
    signal.addEventListener('abort', abort, { once: true });
    if (element instanceof HTMLImageElement) element.onload = () => finish();
    else {
      element.preload = 'auto';
      element.muted = true;
      element.onloadeddata = () => finish();
    }
    element.src = url;
  });
}

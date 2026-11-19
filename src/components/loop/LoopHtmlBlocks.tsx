import { memo, useEffect, useMemo, useRef } from 'react';
import { loopHtmlDocument, type LoopHtmlFields } from '@/lib/loopHtml';
import type { LoopHtml } from '@/lib/types';

const Frame = memo(function Frame({ block, fields }: { block: LoopHtml; fields: LoopHtmlFields }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const source = useMemo(() => loopHtmlDocument(block.html), [block.html]);
  // Only post when a value actually changed (the clock ticks every second; most fields don't).
  const last = useRef('');
  // Only the fields this design uses, so a ticking countdown doesn't wake a design without one.
  const used = useMemo(() => {
    if (/school-data|window\.school|\bschool\./.test(block.html)) return null;
    const keys = new Set<string>();
    for (const m of block.html.matchAll(/\{\{\s*(\w+)\s*\}\}|data-school-field=["'](\w+)["']/g))
      keys.add(m[1] || m[2]);
    return keys;
  }, [block.html]);
  const send = (force?: boolean) => {
    const payload = used
      ? Object.fromEntries(Object.entries(fields).filter(([k]) => used.has(k)))
      : fields;
    const json = JSON.stringify(payload);
    if (!force && json === last.current) return;
    last.current = json;
    if (!force && used && !used.size) return;
    frame.current?.contentWindow?.postMessage({ type: 'school-loop-html', payload }, '*');
  };
  useEffect(() => send());
  return (
    <iframe
      ref={frame}
      data-html-id={block.id}
      title={block.name}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={source}
      onLoad={() => send(true)}
      style={{
        left: block.x + '%',
        top: block.y + '%',
        width: block.w + '%',
        height: block.h + '%',
        opacity: block.opacity / 100,
      }}
    />
  );
});

export function LoopHtmlBlocks({
  blocks,
  layer,
  fields,
}: {
  blocks?: LoopHtml[];
  layer: LoopHtml['layer'];
  fields: LoopHtmlFields;
}) {
  const shown = (blocks || []).filter((b) => !b.hidden && b.html.trim() && b.layer === layer);
  if (!shown.length) return null;
  return (
    <div className={'loop-html loop-html-' + layer} aria-hidden="true">
      {shown.map((b) => (
        <Frame key={b.id} block={b} fields={fields} />
      ))}
    </div>
  );
}

/** An uploaded HTML page filling the whole classes background. */
export function LoopHtmlWallpaper({ html, fields }: { html: string; fields: LoopHtmlFields }) {
  return (
    <div className="loop-html-wallpaper">
      <Frame
        block={{
          id: 'wallpaper',
          name: 'خلفية HTML',
          html,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          layer: 'back',
          opacity: 100,
        }}
        fields={fields}
      />
    </div>
  );
}

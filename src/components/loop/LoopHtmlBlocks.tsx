import { memo, useEffect, useMemo, useRef } from 'react';
import { loopHtmlDocument, type LoopHtmlFields } from '@/lib/loopHtml';
import type { LoopHtml } from '@/lib/types';

const Frame = memo(function Frame({ block, fields }: { block: LoopHtml; fields: LoopHtmlFields }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const source = useMemo(() => loopHtmlDocument(block.html), [block.html]);
  const send = () =>
    frame.current?.contentWindow?.postMessage({ type: 'school-loop-html', payload: fields }, '*');
  useEffect(send);
  return (
    <iframe
      ref={frame}
      data-html-id={block.id}
      title={block.name}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={source}
      onLoad={send}
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

import { useRef, useState } from 'react';
import { Screen } from '@/components/Screen';
import {
  loopElements,
  loopSelectors,
  fitLoopPosition,
  type LoopElement,
  type LoopPosition,
} from '@/lib/loopPositions';
import { useAdmin } from './store';
import type { LoopText } from '@/lib/types';
export function LoopCanvas() {
  const { content, template, data, setTemplate } = useAdmin();
  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<LoopElement>('clock');
  const drag = useRef<{
    key: LoopElement;
    mode: 'move' | 'resize';
    x: number;
    y: number;
    rect: LoopPosition;
    width: number;
    height: number;
  } | null>(null);
  const update = (key: LoopElement, r: LoopPosition) =>
    setTemplate((t) => ({
      ...t,
      loopPositions: { ...t.loopPositions, [key]: fitLoopPosition(r) },
    }));
  const begin = () => {
    const screen = root.current?.querySelector('.screen-loop');
    if (!screen) return;
    const bounds = screen.getBoundingClientRect();
    const positions = { ...template.loopPositions };
    for (const key of Object.keys(loopElements) as LoopElement[]) {
      const el = screen.querySelector(loopSelectors[key]);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height)
        positions[key] = fitLoopPosition({
          x: ((r.x - bounds.x) / bounds.width) * 100,
          y: ((r.y - bounds.y) / bounds.height) * 100,
          w: (r.width / bounds.width) * 100,
          h: (r.height / bounds.height) * 100,
        });
    }
    setTemplate((t) => ({ ...t, loopPositions: positions }));
    setEditing(true);
  };
  const r = template.loopPositions?.[selected];
  // Custom texts: drag to move; the corner handle changes width (sideways) and size (up/down).
  const textDrag = useRef<{
    id: string;
    mode: 'move' | 'resize';
    x: number;
    y: number;
    start: LoopText;
    width: number;
    height: number;
    boxHeight: number;
  } | null>(null);
  const changeText = (id: string, patch: Partial<LoopText>) =>
    setTemplate((t) => ({
      ...t,
      loopTexts: (t.loopTexts || []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  const textBoxes = (template.loopTexts || []).map((t) => {
    const screen = root.current?.querySelector('.screen-loop');
    const el = screen?.querySelector(`[data-text-id="${t.id}"]`);
    const h =
      el && screen
        ? (el.getBoundingClientRect().height / screen.getBoundingClientRect().height) * 100
        : t.size * 2.5;
    return (
      <div
        key={t.id}
        className="loop-edit-box loop-text-box"
        role="group"
        aria-label={'نص: ' + t.text.slice(0, 30)}
        style={{ left: t.x + '%', top: t.y + '%', width: t.width + '%', height: h + '%' }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const bounds = root.current!.getBoundingClientRect();
          textDrag.current = {
            id: t.id,
            mode: (e.target as HTMLElement).dataset.resize ? 'resize' : 'move',
            x: e.clientX,
            y: e.clientY,
            start: t,
            width: bounds.width,
            height: bounds.height,
            boxHeight: Math.max(1, h),
          };
        }}
        onPointerMove={(e) => {
          const d = textDrag.current;
          if (!d || d.id !== t.id) return;
          const dx = ((e.clientX - d.x) / d.width) * 100;
          const dy = ((e.clientY - d.y) / d.height) * 100;
          const clamp = (v: number, a: number, b: number) =>
            Math.round(Math.max(a, Math.min(b, v)) * 10) / 10;
          if (d.mode === 'move')
            changeText(t.id, {
              x: clamp(d.start.x + dx, -20, 100),
              y: clamp(d.start.y + dy, -5, 100),
            });
          else
            changeText(t.id, {
              width: clamp(d.start.width + dx, 5, 100),
              size: clamp(d.start.size * (1 + dy / d.boxHeight), 0.8, 14),
            });
        }}
        onPointerUp={() => (textDrag.current = null)}
        onPointerCancel={() => (textDrag.current = null)}
      >
        <span>{t.text.slice(0, 24) || 'نص'}</span>
        <span
          className="loop-resize-handle"
          data-resize="true"
          role="separator"
          aria-label={'تغيير حجم النص ' + t.text.slice(0, 20)}
        >
          ↘
        </span>
      </div>
    );
  });
  return (
    <>
      <div className="loop-canvas-viewport">
        <div
          style={{ width: (editing ? zoom * 100 : 100) + '%' }}
          ref={root}
          className={'loop-canvas' + (editing ? ' editing' : '')}
        >
          <Screen
            content={content}
            template={{ ...template, displayMode: 'loop', rotation: undefined }}
            school={data?.school}
          />
          {editing && (
            <div className="loop-canvas-overlay">
              {textBoxes}
              {(Object.keys(loopElements) as LoopElement[]).map((key) => {
                const p = template.loopPositions?.[key];
                if (!p || !root.current?.querySelector(loopSelectors[key])) return null;
                return (
                  <div
                    key={key}
                    onClick={() => setSelected(key)}
                    tabIndex={0}
                    role="group"
                    aria-label={loopElements[key]}
                    onKeyDown={(e) => {
                      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
                        return;
                      e.preventDefault();
                      update(key, {
                        ...p,
                        x: p.x + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0),
                        y: p.y + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0),
                      });
                    }}
                    className={'loop-edit-box' + (selected === key ? ' selected' : '')}
                    style={{ left: p.x + '%', top: p.y + '%', width: p.w + '%', height: p.h + '%' }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      setSelected(key);
                      e.currentTarget.setPointerCapture(e.pointerId);
                      const bounds = root.current!.getBoundingClientRect();
                      drag.current = {
                        key,
                        mode: (e.target as HTMLElement).dataset.resize ? 'resize' : 'move',
                        x: e.clientX,
                        y: e.clientY,
                        rect: p,
                        width: bounds.width,
                        height: bounds.height,
                      };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (!d || d.key !== key) return;
                      const dx = ((e.clientX - d.x) / d.width) * 100;
                      const dy = ((e.clientY - d.y) / d.height) * 100;
                      update(
                        key,
                        d.mode === 'move'
                          ? { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy }
                          : { ...d.rect, w: d.rect.w + dx, h: d.rect.h + dy },
                      );
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                  >
                    <span>{loopElements[key]}</span>
                    <span
                      className="loop-resize-handle"
                      data-resize="true"
                      role="separator"
                      aria-label={'تغيير حجم ' + loopElements[key]}
                    >
                      ↘
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <h3 className="loop-move-heading">تحريك العناصر وتغيير أحجامها</h3>
      <p className="field-hint">
        الساعة، لوحة التميز، العنوان والشعارات وشريط الأخبار. اختر عنصرًا ثم حرّكه أو غيّر حجمه.
      </p>
      <div className="button-row">
        <button
          type="button"
          className="button white"
          onClick={() => (editing ? setEditing(false) : begin())}
        >
          {editing ? 'إنهاء التحريك' : 'تحريك وتكبير باللمس'}
        </button>
        <button
          type="button"
          className="button white"
          onClick={() => {
            setEditing(false);
            setTemplate((t) => ({ ...t, loopPositions: undefined }));
          }}
        >
          استعادة توزيع العناصر
        </button>
      </div>
      {editing && (
        <div className="loop-position-controls">
          <label>
            تكبير مساحة التحريك · {zoom}×
            <input
              aria-label="تكبير مساحة التحريك"
              type="range"
              min="1"
              max="3"
              step=".25"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
          </label>
          <p className="field-hint">
            اسحب العنصر لتحريكه، أو اسحب الزاوية لتغيير حجمه. استخدم المنزلقات للدقة، ثم احفظ
            الخلفية لتطبيق التغييرات.
          </p>
          <label>
            العنصر
            <select
              aria-label="العنصر المتحرك"
              value={selected}
              onChange={(e) => setSelected(e.target.value as LoopElement)}
            >
              {(Object.keys(loopElements) as LoopElement[])
                .filter(
                  (key) =>
                    template.loopPositions?.[key] &&
                    root.current?.querySelector(loopSelectors[key]),
                )
                .map((key) => (
                  <option key={key} value={key}>
                    {loopElements[key]}
                  </option>
                ))}
            </select>
          </label>
          {r &&
            (['x', 'y', 'w', 'h'] as const).map((axis) => (
              <label key={axis}>
                {{ x: 'الموقع الأفقي', y: 'الموقع الرأسي', w: 'العرض', h: 'الارتفاع' }[axis]} ·{' '}
                {Math.round(r[axis])}%
                <input
                  type="range"
                  aria-label={loopElements[selected] + ' ' + axis}
                  min={axis === 'w' ? 5 : axis === 'h' ? 4 : 0}
                  max={axis === 'w' ? 95 : axis === 'h' ? 85 : 100}
                  step=".5"
                  value={r[axis]}
                  onChange={(e) => update(selected, { ...r, [axis]: +e.target.value })}
                />
              </label>
            ))}
        </div>
      )}
    </>
  );
}

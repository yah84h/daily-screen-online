import type { CSSProperties } from 'react';
export type MediaCrop = { x: number; y: number; zoom: number };
export function mediaCropStyle(crop?: Partial<MediaCrop>): CSSProperties {
  const clamp = (value: number | undefined, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
  const x = clamp(crop?.x, 0, 100, 50);
  const y = clamp(crop?.y, 0, 100, 50);
  const zoom = clamp(crop?.zoom, 100, 250, 100);
  return {
    objectPosition: `${x}% ${y}%`,
    transform: `scale(${zoom / 100})`,
    transformOrigin: `${x}% ${y}%`,
  };
}

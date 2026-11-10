import type { MediaCrop } from '@/lib/mediaCrop';
export function CropEditor({
  value,
  onChange,
  label = 'قص الوسائط',
}: {
  value?: MediaCrop;
  onChange: (crop: MediaCrop) => void;
  label?: string;
}) {
  const crop = { x: 50, y: 50, zoom: 100, ...value };
  return (
    <fieldset className="crop-editor">
      <legend>{label}</legend>
      <p className="field-hint">
        حرّك نقطة التركيز وكبّر الصورة أو الفيديو. القص يغيّر العرض فقط ويحفظ الملف الأصلي.
      </p>
      {(
        [
          ['x', 'التركيز الأفقي', 0, 100],
          ['y', 'التركيز الرأسي', 0, 100],
          ['zoom', 'التكبير', 100, 250],
        ] as const
      ).map(([key, title, min, max]) => (
        <label key={key}>
          {title} · {crop[key]}٪
          <input
            aria-label={label + ' · ' + title}
            type="range"
            min={min}
            max={max}
            value={crop[key]}
            onChange={(event) => onChange({ ...crop, [key]: +event.target.value })}
          />
        </label>
      ))}
      <button
        className="text-button"
        type="button"
        onClick={() => onChange({ x: 50, y: 50, zoom: 100 })}
      >
        استعادة القص
      </button>
    </fieldset>
  );
}

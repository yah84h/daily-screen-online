/**
 * Animated "school wallpaper" for the classes background: the look of the school transition
 * video (deep field, light zigzag band, rows of soft dashes, slow drift), drawn live so every
 * color follows the loop palette (--loop-text field, --loop-background band, --loop-line1 dashes,
 * --loop-line2 band edge) and recolors with any preset or custom color.
 */
const W = 1600,
  H = 900,
  STEP = 30;

/** A stepped ("pixel stair") zigzag edge from top to bottom around x. */
function edge(x: number, amplitude: number, period: number, phase: number) {
  const points: [number, number][] = [];
  for (let y = -STEP; y <= H + STEP; y += STEP) {
    const t = (((y / period + phase) % 1) + 1) % 1;
    const tri = t < 0.5 ? t * 2 : 2 - t * 2; // triangle wave 0..1..0
    const dx = Math.round((tri * amplitude) / STEP) * STEP;
    const last = points[points.length - 1];
    if (last) points.push([x + dx, last[1]]); // horizontal step, then down
    points.push([x + dx, y]);
  }
  return points;
}

const left = edge(470, 240, 600, 0);
const right = edge(1270, 210, 560, 0.5).reverse();
const band = [...left, ...right].map(([x, y]) => `${x},${y}`).join(' ');
const leftLine = left.map(([x, y]) => `${x - 14},${y}`).join(' ');

export function ZigzagWallpaper() {
  return (
    <svg
      className="zigzag-wallpaper"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern id="zigzag-dashes" width="88" height="44" patternUnits="userSpaceOnUse">
          <rect x="6" y="10" width="34" height="7" rx="3.5" />
          <rect x="50" y="32" width="26" height="7" rx="3.5" />
        </pattern>
      </defs>
      <rect className="zz-field" width={W} height={H} />
      <g className="zz-dashes">
        <rect x={-200} y={-100} width={W + 400} height={H + 200} fill="url(#zigzag-dashes)" />
      </g>
      <g className="zz-band">
        <polyline className="zz-edge" points={leftLine} />
        <polygon className="zz-fill" points={band} />
      </g>
    </svg>
  );
}

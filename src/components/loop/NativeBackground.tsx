import { useEffect, useState, useId, useRef } from "react";
import logo from "./school-logo.json";
const curves = [
  {
    p: [
      [-120, 610],
      [400, 710],
      [380, 65],
      [1290, -80],
    ],
    color: "#4b91f7",
    alpha: 0.47,
    phase: 0,
  },
  {
    p: [
      [-140, 700],
      [460, 830],
      [500, 145],
      [1430, -70],
    ],
    color: "#30bed6",
    alpha: 0.37,
    phase: 1.4,
  },
  {
    p: [
      [-180, 790],
      [550, 900],
      [630, 200],
      [1510, -50],
    ],
    color: "#a497d7",
    alpha: 0.28,
    phase: 2.9,
  },
  {
    p: [
      [2550, 2240],
      [2940, 1560],
      [3250, 1940],
      [3970, 1450],
    ],
    color: "#4b91f7",
    alpha: 0.44,
    phase: 2,
  },
  {
    p: [
      [2670, 2240],
      [3030, 1680],
      [3370, 2030],
      [3970, 1570],
    ],
    color: "#30bed6",
    alpha: 0.36,
    phase: 3.6,
  },
  {
    p: [
      [2780, 2240],
      [3130, 1810],
      [3430, 2120],
      [3990, 1700],
    ],
    color: "#a497d7",
    alpha: 0.28,
    phase: 4.5,
  },
];
function curve(c: (typeof curves)[number], t: number) {
  const p = 2 * Math.PI * t;
  const points = c.p.map(([x, y], j) => [
    (x + 44 * Math.sin(p + c.phase + j * 0.6)).toFixed(2),
    (y + 48 * Math.cos(p + c.phase + j * 0.8)).toFixed(2),
  ]);
  return (
    "M" +
    points[0].join(",") +
    " C" +
    points
      .slice(1)
      .map((p) => p.join(","))
      .join(" ")
  );
}
export function SchoolMark() {
  return (
    <svg
      viewBox={`0 0 ${logo.width} ${logo.height}`}
      role="img"
      aria-label="شعار المدرسة"
    >
      <path fill="#4b91f7" d={logo.path} />
    </svg>
  );
}
export default function NativeLoop({
  name,
  customLogo,
  pairedBranding = true,
}: {
  name: string;
  customLogo?: string;
  pairedBranding?: boolean;
}) {
  const artwork = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReduced(q.matches);
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const svg = artwork.current;
    if (!svg) return;
    const paths = Array.from(
        svg.querySelectorAll<SVGPathElement>("[data-wave]"),
      ),
      groups = Array.from(svg.querySelectorAll<SVGGElement>("[data-motion]"));
    if (reduced) {
      paths.forEach((p, i) => p.setAttribute("d", curve(curves[i], 0)));
      groups.forEach((g) => {
        g.removeAttribute("transform");
        g.removeAttribute("opacity");
      });
      return;
    }
    let frame = 0;
    function tick(ms: number) {
      const t = (ms % 20000) / 20000,
        phase = 2 * Math.PI * t;
      paths.forEach((p, i) => p.setAttribute("d", curve(curves[i], t)));
      groups.forEach((g) => {
        const offset = Number(g.dataset.motion),
          haze = g.dataset.haze === "true";
        if (haze) {
          g.setAttribute(
            "transform",
            `translate(${(30 * Math.sin(phase + offset)).toFixed(2)} ${(24 * Math.cos(phase + offset)).toFixed(2)})`,
          );
        } else {
          const p = 2 * Math.PI * ((ms % 18000) / 18000) + offset,
            x = 96 * Math.sin(p) + 20 * Math.sin(2 * p),
            y = 72 * Math.cos(p),
            angle = 7 * Math.sin(p + 0.7),
            scale = 1 + 0.045 * Math.sin(p + 1.2),
            cx = Number(g.dataset.cx),
            cy = Number(g.dataset.cy);
          g.setAttribute(
            "transform",
            `translate(${x.toFixed(2)} ${y.toFixed(2)}) translate(${cx} ${cy}) rotate(${angle.toFixed(2)}) scale(${scale.toFixed(4)}) translate(${-cx} ${-cy})`,
          );
          g.setAttribute("opacity", (0.9 + 0.1 * Math.sin(p + 0.5)).toFixed(3));
        }
      });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);
  return (
    <div
      className="native-loop"
      aria-label="خلفية المدرسة المتحركة بدقة متجهية"
    >
      <svg
        ref={artwork}
        className="native-artwork"
        viewBox="0 0 3840 2160"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={gradientId + "-blue"}>
            <stop offset="0" stopColor="#4b91f7" stopOpacity=".035" />
            <stop offset="1" stopColor="#4b91f7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gradientId + "-cyan"}>
            <stop offset="0" stopColor="#30bed6" stopOpacity=".03" />
            <stop offset="1" stopColor="#30bed6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="3840" height="2160" fill="white" />
        {[
          [-100, 450, 760, 480, "blue"],
          [3700, 1880, 830, 450, "cyan"],
        ].map(([x, y, rx, ry, color], i) => (
          <g key={"haze-" + i} data-motion={i} data-haze="true">
            <ellipse
              cx={Number(x)}
              cy={Number(y)}
              rx={Number(rx)}
              ry={Number(ry)}
              fill={`url(#${gradientId}-${color})`}
            />
          </g>
        ))}
        {curves.map((c, i) => (
          <path
            key={i}
            data-wave={i}
            d={curve(c, 0)}
            stroke={c.color}
            strokeOpacity={c.alpha}
            strokeWidth="4"
            fill="none"
          ></path>
        ))}
        {[
          [3100, 260, 195, 195, 48, "#4b91f7", 0.7],
          [3410, 440, 95, 95, 25, "#30bed6", 2.4],
          [360, 1680, 165, 165, 42, "#a497d7", 4.1],
          [620, 1880, 80, 80, 23, "#30bed6", 1.7],
        ].map(([x, y, w, h, r, color, phase], i) => (
          <g
            key={i}
            data-particle="true"
            data-motion={Number(phase)}
            data-cx={Number(x) + Number(w) / 2}
            data-cy={Number(y) + Number(h) / 2}
          >
            <ellipse
              cx={Number(x) + Number(w) / 2}
              cy={Number(y) + Number(h) / 2}
              rx={Number(w) * 1.15}
              ry={Number(h) * 1.15}
              fill={`url(#${gradientId}-${i % 2 ? "cyan" : "blue"})`}
            />
            <rect
              x={Number(x)}
              y={Number(y)}
              width={Number(w)}
              height={Number(h)}
              rx={Number(r)}
              fill={String(color)}
              fillOpacity=".12"
            />
          </g>
        ))}
      </svg>
      {pairedBranding && (
        <div
          className="native-brand-pair"
          dir="ltr"
          aria-label="وزارة التعليم وأكاديمية طويق"
        >
          <img
            className="ministry-brand"
            src="/branding/ministry-of-education.svg"
            alt="وزارة التعليم"
          />
          <span className="native-brand-divider" aria-hidden="true" />
          <img
            className="tuwaiq-brand"
            src="/branding/tuwaiq-academy.svg"
            alt="أكاديمية طويق"
          />
        </div>
      )}
      {!pairedBranding && !customLogo && (
        <div
          className="native-logo"
          style={{ aspectRatio: logo.width + "/" + logo.height }}
        >
          <SchoolMark />
        </div>
      )}
      {!pairedBranding && customLogo && (
        <img
          className="native-custom-logo"
          src={customLogo}
          alt="شعار المدرسة"
        />
      )}
      <div className="native-school-name">{name}</div>
    </div>
  );
}

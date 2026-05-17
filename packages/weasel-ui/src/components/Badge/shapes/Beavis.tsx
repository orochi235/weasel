import { useLayoutEffect, useRef, useState } from 'react';
import type { ShapeModule } from '../types';

export interface BeavisParams {
  points?: number;
  cornerRadius?: number;
  vertSpikeLen?: number;
  horzSpikeLen?: number;
  cornerSpikeLen?: number;
  spikeBaseWidth?: number;
  rotation?: number;
  axisBias?: number;
  irregularity?: number;
}

const DEFAULTS: Required<BeavisParams> = {
  points: 44,
  cornerRadius: 6,
  vertSpikeLen: 12,
  horzSpikeLen: 8,
  cornerSpikeLen: 4,
  spikeBaseWidth: 3,
  rotation: 0,
  axisBias: 0,
  irregularity: 0,
};

interface PtNormal { x: number; y: number; nx: number; ny: number }

function perimeterAt(s: number, W: number, H: number, r: number): PtNormal {
  const ew = W - 2 * r;
  const eh = H - 2 * r;
  const arcLen = (Math.PI / 2) * r;
  const total = 2 * ew + 2 * eh + 4 * arcLen;
  s = ((s % total) + total) % total;

  if (s < ew) return { x: r + s, y: 0, nx: 0, ny: -1 };
  s -= ew;
  if (s < arcLen) {
    const a = -Math.PI / 2 + s / r;
    return { x: W - r + Math.cos(a) * r, y: r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < eh) return { x: W, y: r + s, nx: 1, ny: 0 };
  s -= eh;
  if (s < arcLen) {
    const a = s / r;
    return { x: W - r + Math.cos(a) * r, y: H - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < ew) return { x: W - r - s, y: H, nx: 0, ny: 1 };
  s -= ew;
  if (s < arcLen) {
    const a = Math.PI / 2 + s / r;
    return { x: r + Math.cos(a) * r, y: H - r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
  }
  s -= arcLen;
  if (s < eh) return { x: 0, y: H - r - s, nx: -1, ny: 0 };
  s -= eh;
  const a = Math.PI + s / r;
  return { x: r + Math.cos(a) * r, y: r + Math.sin(a) * r, nx: Math.cos(a), ny: Math.sin(a) };
}

function spikeLenAt(p: PtNormal, vert: number, horz: number, corner: number): number {
  const e = 0.985;
  if (p.ny < -e || p.ny > e) return vert;
  if (p.nx < -e || p.nx > e) return horz;
  return corner;
}

// CSS-px to perimeter-arc-length conversion at point p, given badge box dims.
function arcLenForCssWidth(p: PtNormal, baseCss: number, boxW: number, boxH: number): number {
  // Tangent (clockwise around perimeter) = (-ny, nx) in viewBox coords.
  const tx = -p.ny;
  const ty = p.nx;
  const sx = boxW / 100;
  const sy = boxH / 100;
  const cssPerArc = Math.sqrt(sx * sx * tx * tx + sy * sy * ty * ty) || 1;
  return baseCss / cssPerArc;
}

interface Seg { vbStart: number; vbLen: number; cssStart: number; cssLen: number }

function buildSegmentTable(r: number, sx: number, sy: number): { table: Seg[]; totalCss: number } {
  const W = 100, H = 100;
  const ew = W - 2 * r;
  const eh = H - 2 * r;
  const arcVb = (Math.PI / 2) * r;
  // Quarter-ellipse arc length via Ramanujan's approximation.
  const a = sx * r, b = sy * r;
  const denom = a + b || 1;
  const h = ((a - b) / denom) ** 2;
  const arcCss = (Math.PI * denom * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)))) / 4;
  const raw = [
    { vb: ew, css: ew * sx },
    { vb: arcVb, css: arcCss },
    { vb: eh, css: eh * sy },
    { vb: arcVb, css: arcCss },
    { vb: ew, css: ew * sx },
    { vb: arcVb, css: arcCss },
    { vb: eh, css: eh * sy },
    { vb: arcVb, css: arcCss },
  ];
  let cumVb = 0, cumCss = 0;
  const table: Seg[] = raw.map(s => {
    const entry = { vbStart: cumVb, vbLen: s.vb, cssStart: cumCss, cssLen: s.css };
    cumVb += s.vb;
    cumCss += s.css;
    return entry;
  });
  return { table, totalCss: cumCss };
}

function cssToVb(cssS: number, table: Seg[], totalCss: number): number {
  cssS = ((cssS % totalCss) + totalCss) % totalCss;
  for (const seg of table) {
    if (cssS <= seg.cssStart + seg.cssLen + 1e-9) {
      const t = seg.cssLen > 0 ? (cssS - seg.cssStart) / seg.cssLen : 0;
      return seg.vbStart + t * seg.vbLen;
    }
  }
  return cssS;
}

function beavisPath(cfg: Required<BeavisParams>, boxW: number, boxH: number) {
  const W = 100, H = 100;
  const r = Math.max(0.5, Math.min(cfg.cornerRadius, Math.min(W, H) / 2));
  const sx = boxW / 100, sy = boxH / 100;
  const { table, totalCss } = buildSegmentTable(r, sx, sy);

  const N = Math.max(4, Math.floor(cfg.points));
  const cssStep = totalCss / N;
  const cssOffset = (cfg.rotation / 360) * totalCss;

  const samplesPerRun = 10;
  let d = '';
  for (let i = 0; i < N; i++) {
    const cssCenter = cssOffset + i * cssStep;
    const sc = cssToVb(cssCenter, table, totalCss);
    const pCenter = perimeterAt(sc, W, H, r);
    const swArc = Math.min(cssStep / Math.max(sx, sy) - 0.05, arcLenForCssWidth(pCenter, cfg.spikeBaseWidth, boxW, boxH));
    const halfArc = Math.max(0.05, swArc / 2);
    const pStart = perimeterAt(sc - halfArc, W, H, r);
    const pEnd = perimeterAt(sc + halfArc, W, H, r);
    const baseLen = spikeLenAt(pCenter, cfg.vertSpikeLen, cfg.horzSpikeLen, cfg.cornerSpikeLen);
    const dominance = Math.abs(pCenter.ny) - Math.abs(pCenter.nx);
    const irrMult = 1 + cfg.irregularity * 0.5 * Math.sin(i * 1.73 + 0.7);
    const lenCss = Math.max(0, baseLen * (1 + cfg.axisBias * dominance) * irrMult);
    // If the spike sits on a corner arc, snap its direction to the appropriate 45° diagonal.
    const onCorner = Math.abs(pCenter.nx) > 0.05 && Math.abs(pCenter.ny) > 0.05;
    const dirX = onCorner ? Math.sign(pCenter.nx) / Math.SQRT2 : pCenter.nx;
    const dirY = onCorner ? Math.sign(pCenter.ny) / Math.SQRT2 : pCenter.ny;
    // Convert a CSS-px outward extent into per-axis viewBox amounts.
    const tipX = pCenter.x + dirX * lenCss * (100 / boxW);
    const tipY = pCenter.y + dirY * lenCss * (100 / boxH);

    if (i === 0) d += `M ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)}`;
    else d += ` L ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)}`;
    d += ` L ${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
    d += ` L ${pEnd.x.toFixed(2)} ${pEnd.y.toFixed(2)}`;

    // Body run from this spike's end to next spike's start - follow perimeter
    const nextCssCenter = cssOffset + (i + 1) * cssStep;
    const nextSc = cssToVb(nextCssCenter, table, totalCss);
    let runStart = sc + halfArc;
    let runEnd = nextSc - halfArc;
    if (runEnd < runStart) runEnd += table[table.length - 1].vbStart + table[table.length - 1].vbLen;
    for (let k = 1; k < samplesPerRun; k++) {
      const s = runStart + (k / samplesPerRun) * (runEnd - runStart);
      const pt = perimeterAt(s, W, H, r);
      d += ` L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }
  }
  return d + ' Z';
}

function BeavisComponent({ variant, focused, params, phase }: {
  variant: 'outline' | 'solid' | 'subtle';
  focused: boolean;
  params: BeavisParams;
  phase: number;
}) {
  const cfg = { ...DEFAULTS, ...params, rotation: (params.rotation ?? DEFAULTS.rotation) + phase * 360 };
  const ref = useRef<SVGGElement>(null);
  const [box, setBox] = useState({ w: 100, h: 100 });

  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const update = () => {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const d = beavisPath(cfg, box.w, box.h);
  const dFocus = beavisPath(
    { ...cfg, vertSpikeLen: cfg.vertSpikeLen + 3, horzSpikeLen: cfg.horzSpikeLen + 2, cornerSpikeLen: cfg.cornerSpikeLen + 1 },
    box.w, box.h,
  );
  return (
    <g ref={ref}>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d={dFocus} />}
    </g>
  );
}

const Beavis: ShapeModule<BeavisParams> = {
  Component: BeavisComponent,
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
  stretches: true,
  defaults: DEFAULTS,
};

export default Beavis;

import { useMemo, useState } from 'react';
import { RangePicker, paintGradientTrack, type Thumb } from '@orochi235/weasel-ui';
import { SceneCanvas, useScene, polygonFromPoints } from '@orochi235/weasel';
import type { RenderLayer } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '@orochi235/weasel-gl';

// Minimal OKLCH → sRGB hex (clamped). Sufficient for a demo gradient.
function oklchToHex(L: number, C: number, Hdeg: number): string {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l_ ** 3, mr = m_ ** 3, sr = s_ ** 3;
  const r = 4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr;
  const g = -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr;
  const bl = -0.0041960863 * lr - 0.7034186147 * mr + 1.707614701 * sr;
  const linToSrgb = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  const toByte = (u: number) => Math.max(0, Math.min(255, Math.round(linToSrgb(u) * 255)));
  const hh = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hh(toByte(r))}${hh(toByte(g))}${hh(toByte(bl))}`;
}

/** Parse `#rrggbb` into RGBA floats (0..1). For vertexColors. */
function hexToRgba01(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, 1];
}

type CThumb = Thumb & { key: 'cTop' | 'cPeak' | 'cBot' };

/** Per-thumb chroma bounds. Drives both the slider's `bounds:` config and
 *  the diagram's range-line annotations, so they can't drift apart. */
const CHROMA_BOUNDS = {
  cTop:  [0, 0.06] as [number, number],
  cPeak: [0, 0.22] as [number, number],
  cBot:  [0, 0.10] as [number, number],
};

interface RampParams {
  hue: number;
  midL: number;
  lRange: [number, number];
  chroma: { cTop: number; cPeak: number; cBot: number };
}

/** Piecewise-linear chroma curve over L. */
function chromaAt(L: number, p: RampParams): number {
  const [lo, hi] = p.lRange;
  if (L <= lo) return p.chroma.cBot;
  if (L >= hi) return p.chroma.cTop;
  if (L <= p.midL) return p.chroma.cBot + (p.chroma.cPeak - p.chroma.cBot) * ((L - lo) / (p.midL - lo));
  return p.chroma.cPeak + (p.chroma.cTop - p.chroma.cPeak) * ((L - p.midL) / (hi - p.midL));
}

/** Tailwind-style index → L. 0 → lightest, 1000 → darkest. */
function lAtIndex(idx: number, lRange: [number, number]): number {
  const t = Math.max(0, Math.min(1, idx / 1000));
  return lRange[1] + t * (lRange[0] - lRange[1]);
}

function colorAtIndex(idx: number, p: RampParams): string {
  const L = lAtIndex(idx, p.lRange);
  return oklchToHex(L, chromaAt(L, p), p.hue);
}

/** Output swatch: row of color tiles, one per index. */
function OutputSwatchRow({ indices, params }: { indices: number[]; params: RampParams }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${indices.length}, 1fr)`, gap: 2 }}>
      {indices.map((idx, i) => {
        const color = colorAtIndex(idx, params);
        const L = lAtIndex(idx, params.lRange);
        const labelColor = L > 0.55 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
        return (
          <div
            key={i}
            style={{
              background: color,
              aspectRatio: '1 / 1.4',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              padding: '4px 6px',
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
              color: labelColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {idx}
          </div>
        );
      })}
    </div>
  );
}

const DIAGRAM_W = 320;
const DIAGRAM_H = 220;
const DIAGRAM_PAD = { l: 28, r: 12, t: 24, b: 28 };
const PLOT_W = DIAGRAM_W - DIAGRAM_PAD.l - DIAGRAM_PAD.r;
const PLOT_H = DIAGRAM_H - DIAGRAM_PAD.t - DIAGRAM_PAD.b;
const MAX_C = 0.22;

const xAt = (L: number) => DIAGRAM_PAD.l + L * PLOT_W;
const yAt = (C: number) => DIAGRAM_PAD.t + (1 - C / MAX_C) * PLOT_H;

/** Chroma curve diagram. Triangle interior is rendered via the kit's WebGL
 *  renderer with per-vertex colors (`PathDrawCommand.vertexColors`) — each
 *  vertex carries the OKLCH color at its (L, C, hue), so the interior fill
 *  smoothly interpolates between the three corner colors. Frame, gridlines,
 *  and control-point markers are an SVG overlay above the canvas. */
function ChromaCurveDiagram({ params }: { params: RampParams }) {
  const [lo, hi] = params.lRange;
  const points = [
    { L: lo,         C: params.chroma.cBot,  label: 'B', color: oklchToHex(lo,         params.chroma.cBot,  params.hue), bounds: CHROMA_BOUNDS.cBot },
    { L: params.midL, C: params.chroma.cPeak, label: 'P', color: oklchToHex(params.midL, params.chroma.cPeak, params.hue), bounds: CHROMA_BOUNDS.cPeak },
    { L: hi,         C: params.chroma.cTop,  label: 'T', color: oklchToHex(hi,         params.chroma.cTop,  params.hue), bounds: CHROMA_BOUNDS.cTop },
  ];

  // Custom render layer: a single 3-vertex polygon with per-vertex colors,
  // interpolated by the kit's `pathFillVColor` shader. The polygon is in
  // canvas-local / world coords (identity view); `viewToMat3(view)` is the
  // standard transform wrapper.
  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'chroma-curve-fill',
    label: 'Chroma curve (vertex colors)',
    draw: (_data, view) => {
      const path = polygonFromPoints(points.map(p => ({ x: xAt(p.L), y: yAt(p.C) })));
      const colors = points.flatMap(p => hexToRgba01(p.color));
      // The vertex-color render path is gated by `cmd.fill` being truthy
      // (see src/renderer/draw.ts:231). Pass a placeholder solid fill;
      // the per-vertex colors override it via the `pathFillVColor` shader.
      const cmd: DrawCommand = {
        kind: 'path',
        path,
        fill: { color: '#fff' },
        vertexColors: colors,
      };
      return [{ kind: 'group', transform: viewToMat3(view), children: [cmd] }];
    },
    // Re-evaluate whenever the curve points move.
  }), [points[0].L, points[0].C, points[0].color, points[1].L, points[1].C, points[1].color, points[2].L, points[2].C, points[2].color]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  const pathD = `M ${xAt(points[0].L)} ${yAt(points[0].C)} L ${xAt(points[1].L)} ${yAt(points[1].C)} L ${xAt(points[2].L)} ${yAt(points[2].C)}`;

  return (
    <div style={{ position: 'relative', width: DIAGRAM_W, height: DIAGRAM_H }}>
      <SceneCanvas
        width={DIAGRAM_W}
        height={DIAGRAM_H}
        className="ckd-canvas"
        scene={scene}
        layers={{
          scene: { drawOne: () => [] },
          curve: { layer, after: 'scene' },
        }}
      />
      <svg
        width={DIAGRAM_W}
        height={DIAGRAM_H}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {/* Plot frame */}
        <rect x={DIAGRAM_PAD.l} y={DIAGRAM_PAD.t} width={PLOT_W} height={PLOT_H} fill="none" stroke="var(--ckd-border-2)" />
        {/* Y gridlines */}
        {[0.05, 0.10, 0.15, 0.20].map(c => (
          <line key={c} x1={DIAGRAM_PAD.l} y1={yAt(c)} x2={DIAGRAM_PAD.l + PLOT_W} y2={yAt(c)} stroke="rgba(255,255,255,0.07)" />
        ))}
        {/* X marker at midL */}
        <line x1={xAt(params.midL)} y1={DIAGRAM_PAD.t} x2={xAt(params.midL)} y2={DIAGRAM_PAD.t + PLOT_H} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 3" />
        {/* Per-vertex slider-range tracks: dashed vertical line at each
         *  point's L, spanning [0, maxBound] of that thumb's chroma slider,
         *  with small perpendicular tails at each end. Drawn before the
         *  curve so the curve+control-points sit on top. */}
        {points.map((p, i) => {
          const x = xAt(p.L);
          const yTop = yAt(p.bounds[1]);
          const yBot = yAt(p.bounds[0]);
          const tail = 4;
          return (
            <g key={`range-${i}`} stroke="rgba(255,255,255,0.35)" strokeWidth={1}>
              <line x1={x} y1={yTop} x2={x} y2={yBot} strokeDasharray="2 2" />
              <line x1={x - tail} y1={yTop} x2={x + tail} y2={yTop} />
              <line x1={x - tail} y1={yBot} x2={x + tail} y2={yBot} />
            </g>
          );
        })}
        {/* Curve outline */}
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.25} />
        {/* Control points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xAt(p.L)} cy={yAt(p.C)} r={5} fill={p.color} stroke="var(--ckd-text)" strokeWidth={1.5} />
            <text x={xAt(p.L)} y={yAt(p.C) - 9} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-muted)" textAnchor="middle">{p.label}</text>
          </g>
        ))}
        {/* Axis labels */}
        <text x={DIAGRAM_PAD.l} y={DIAGRAM_H - 8} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)">L: 0</text>
        <text x={DIAGRAM_PAD.l + PLOT_W} y={DIAGRAM_H - 8} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)" textAnchor="end">1</text>
        <text x={8} y={DIAGRAM_PAD.t + PLOT_H / 2} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)" transform={`rotate(-90 8 ${DIAGRAM_PAD.t + PLOT_H / 2})`} textAnchor="middle">C</text>
      </svg>
    </div>
  );
}

export function PerceptualColorSlidersDemo() {
  const [hue, setHue] = useState(200);
  const midL = 0.65;
  const peakC = 0.16;

  const [lRange, setLRange] = useState<[number, number]>([0.16, 0.97]);

  const [chroma, setChroma] = useState({ cTop: 0.04, cPeak: 0.16, cBot: 0.08 });

  const [indices, setIndices] = useState<number[]>([25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);

  const params: RampParams = { hue, midL, lRange, chroma };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${DIAGRAM_W}px`, gap: 24, padding: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <section>
          <h3 style={{ margin: '0 0 8px' }}>Output swatch</h3>
          <OutputSwatchRow indices={indices} params={params} />
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px' }}>Hue (single thumb)</h3>
          <RangePicker
            min={0} max={360} step={1}
            thumbs={[{ value: hue }]}
            onChange={ts => setHue(ts[0].value)}
            ariaLabel="Hue"
            readoutPlacement="inline-after"
            renderReadout={t => `${t.value}°`}
            renderTrack={paintGradientTrack({ gradient: t => oklchToHex(midL, peakC, t * 360) })}
          />
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px' }}>L range (2-thumb, ordered)</h3>
          <RangePicker
            min={0} max={1} step={0.005}
            constraint="ordered"
            thumbs={[
              { value: lRange[0], label: '↓', shape: 'notched' },
              { value: lRange[1], label: '↑', shape: 'notched' },
            ]}
            onChange={ts => setLRange([ts[0].value, ts[1].value])}
            readoutPlacement="below-thumb"
            renderTrack={paintGradientTrack({
              gradient: t => oklchToHex(t, 0, 0),
              activeRange: lRange,
              hatch: { angleDeg: 135, stripe: 2, gap: 4, dim: 75 },
            })}
          />
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px' }}>Chroma (3-thumb, free, per-thumb bounds)</h3>
          <RangePicker<CThumb>
            min={0} max={0.22} step={0.005}
            constraint="free"
            thumbs={[
              { value: chroma.cTop,  label: 'T', key: 'cTop',  bounds: CHROMA_BOUNDS.cTop  },
              { value: chroma.cPeak, label: 'P', key: 'cPeak', bounds: CHROMA_BOUNDS.cPeak },
              { value: chroma.cBot,  label: 'B', key: 'cBot',  bounds: CHROMA_BOUNDS.cBot  },
            ]}
            onChange={ts => {
              const next = { ...chroma };
              for (const t of ts) next[t.key] = t.value;
              setChroma(next);
            }}
            readoutPlacement="below-thumb"
            renderTrack={paintGradientTrack({
              gradient: t => oklchToHex(midL, t * 0.22, hue),
            })}
          />
        </section>

        <section>
          <h3 style={{ margin: '0 0 8px' }}>Indices band (dynamic, allowShiftAll)</h3>
          <RangePicker
            min={0} max={1000} step={1}
            thumbs={indices.map(value => ({ value }))}
            onChange={ts => setIndices(ts.map(t => Math.round(t.value)).sort((a, b) => a - b))}
            onAddThumb={at => ({ value: Math.round(at) })}
            onRemoveThumb={() => true}
            allowShiftAll
            renderTrack={paintGradientTrack({
              gradient: t => {
                const c = Math.round((1 - t) * 255);
                return `rgb(${c}, ${c}, ${c})`;
              },
            })}
          />
          <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}>{indices.join(', ')}</div>
        </section>
      </div>

      <div style={{ position: 'sticky', top: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--ckd-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>C as function of L</h3>
        <ChromaCurveDiagram params={params} />
        <div style={{ fontSize: 10, color: 'var(--ckd-faint)', marginTop: 8, lineHeight: 1.4 }}>
          Triangle interior rendered via <code>PathDrawCommand.vertexColors</code> — each corner carries its OKLCH color, the kit's <code>pathFillVColor</code> shader interpolates across.
        </div>
      </div>
    </div>
  );
}

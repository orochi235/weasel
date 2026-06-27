import { useEffect, useMemo, useState } from 'react';
import { Slider, chromaAt, oklchToHex, paintGradientTrack, type ChromaCurve, type Thumb } from '@weasel-js/ui';
import { SceneCanvas, hexToRgba, polygonFromPoints, useScene } from '@weasel-js/core';
import type { RenderLayer } from '@weasel-js/core';
import { viewToMat3, type DrawCommand } from '../../../src/renderer';

type CThumb = Thumb & { key: 'cTop' | 'cPeak' | 'cBot' };

/** Three modes drive the per-thumb bounds for both the chroma and L
 *  sliders, plus the diagram's range-line annotations. Tied together so
 *  the slider constraints and the visualization stay in sync. */
type BoundsMode = 'unconstrained' | 'default' | 'conservative';
type ChromaBounds = { cTop: [number, number]; cPeak: [number, number]; cBot: [number, number] };
type LBounds = { dark: [number, number]; light: [number, number] };

const CHROMA_BOUNDS: Record<BoundsMode, ChromaBounds> = {
  unconstrained: { cTop: [0, 0.22], cPeak: [0, 0.22], cBot: [0, 0.22] },
  default:       { cTop: [0, 0.06], cPeak: [0, 0.22], cBot: [0, 0.10] },
  conservative:  { cTop: [0, 0.03], cPeak: [0, 0.11], cBot: [0, 0.05] },
};

/** L bounds: how far each L thumb can reach. At extreme L, OKLCH can
 *  represent very little chroma (everything clips to black or white), so
 *  the default mode keeps each thumb away from those zones. `conservative`
 *  pulls in further; `unconstrained` allows the full [0, 1] range. */
const L_BOUNDS: Record<BoundsMode, LBounds> = {
  unconstrained: { dark: [0,    1], light: [0, 1]    },
  default:       { dark: [0.05, 1], light: [0, 0.97] },
  conservative:  { dark: [0.15, 1], light: [0, 0.90] },
};

interface RampParams {
  hue: number;
  midL: number;
  lRange: [number, number];
  chroma: { cTop: number; cPeak: number; cBot: number };
}

/** Index → L. 0 → lightest, 1000 → darkest. */
function lAtIndex(idx: number, lRange: [number, number]): number {
  const t = Math.max(0, Math.min(1, idx / 1000));
  return lRange[1] - t * (lRange[1] - lRange[0]);
}

function curveOf(p: RampParams): ChromaCurve {
  return { lRange: p.lRange, midL: p.midL, cBot: p.chroma.cBot, cPeak: p.chroma.cPeak, cTop: p.chroma.cTop };
}

function colorAtIndex(idx: number, p: RampParams): string {
  const L = lAtIndex(idx, p.lRange);
  return oklchToHex(L, chromaAt(L, curveOf(p)), p.hue);
}

/** Three-way segmented toggle for bounds mode. Single-selection radio
 *  group styled as inline buttons. */
function BoundsModeToggle({ mode, onChange }: { mode: BoundsMode; onChange: (m: BoundsMode) => void }) {
  const options: BoundsMode[] = ['unconstrained', 'default', 'conservative'];
  return (
    <div role="radiogroup" aria-label="OKLCH bounds mode" style={{ display: 'flex', marginBottom: 10, border: '1px solid var(--ckd-border-2)', borderRadius: 4, overflow: 'hidden', width: 'fit-content' }}>
      {options.map((opt, i) => {
        const active = mode === opt;
        return (
          <label
            key={opt}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') onChange(options[(i + 1) % options.length]);
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') onChange(options[(i - 1 + options.length) % options.length]);
            }}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              cursor: 'pointer',
              background: active ? 'var(--ckd-accent-dim)' : 'transparent',
              color: active ? 'var(--ckd-text)' : 'var(--ckd-muted)',
              borderLeft: i === 0 ? 'none' : '1px solid var(--ckd-border-2)',
              userSelect: 'none',
            }}
          >
            <input
              type="radio"
              name="bounds-mode"
              checked={active}
              onChange={() => onChange(opt)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            {opt}
          </label>
        );
      })}
    </div>
  );
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

const DIAGRAM_W = 512;
const DIAGRAM_H = 352;
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
function ChromaCurveDiagram({ params, bounds }: { params: RampParams; bounds: ChromaBounds }) {
  const [lo, hi] = params.lRange;
  const points = [
    { L: lo,         C: params.chroma.cBot,  label: 'B', color: oklchToHex(lo,         params.chroma.cBot,  params.hue), bounds: bounds.cBot },
    { L: params.midL, C: params.chroma.cPeak, label: 'P', color: oklchToHex(params.midL, params.chroma.cPeak, params.hue), bounds: bounds.cPeak },
    { L: hi,         C: params.chroma.cTop,  label: 'T', color: oklchToHex(hi,         params.chroma.cTop,  params.hue), bounds: bounds.cTop },
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
      const colors = points.flatMap(p => hexToRgba(p.color));
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

  // Bounds mode applies to both the chroma and L sliders, plus the
  // diagram's range tracks. Three-way: unconstrained / default / conservative.
  const [boundsMode, setBoundsMode] = useState<BoundsMode>('default');
  const chromaBounds = CHROMA_BOUNDS[boundsMode];
  const lBounds = L_BOUNDS[boundsMode];

  // Clamp existing values when the mode tightens to keep thumbs in-bounds.
  // (Loosening the mode never invalidates current state, so this is a no-op
  // when transitioning unconstrained ← anything.)
  useEffect(() => {
    setLRange(prev => [
      Math.max(prev[0], lBounds.dark[0]),
      Math.min(prev[1], lBounds.light[1]),
    ]);
    setChroma(prev => ({
      cTop:  Math.min(prev.cTop,  chromaBounds.cTop[1]),
      cPeak: Math.min(prev.cPeak, chromaBounds.cPeak[1]),
      cBot:  Math.min(prev.cBot,  chromaBounds.cBot[1]),
    }));
  }, [boundsMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <Slider
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
          <Slider
            min={0} max={1} step={0.005}
            constraint="ordered"
            thumbs={[
              { value: lRange[0], label: '↓', shape: 'notched', bounds: lBounds.dark  },
              { value: lRange[1], label: '↑', shape: 'notched', bounds: lBounds.light },
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
          <Slider<CThumb>
            min={0} max={0.22} step={0.005}
            constraint="free"
            thumbs={[
              { value: chroma.cTop,  label: 'T', key: 'cTop',  bounds: chromaBounds.cTop  },
              { value: chroma.cPeak, label: 'P', key: 'cPeak', bounds: chromaBounds.cPeak },
              { value: chroma.cBot,  label: 'B', key: 'cBot',  bounds: chromaBounds.cBot  },
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
          <Slider
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
        <BoundsModeToggle mode={boundsMode} onChange={setBoundsMode} />
        <ChromaCurveDiagram params={params} bounds={chromaBounds} />
        <div style={{ fontSize: 10, color: 'var(--ckd-faint)', marginTop: 8, lineHeight: 1.4 }}>
          Triangle interior rendered via <code>PathDrawCommand.vertexColors</code> — each corner carries its OKLCH color, the kit's <code>pathFillVColor</code> shader interpolates across. Dashed range tracks show each thumb's allowed slide range; the toggle above adjusts the L and chroma slider bounds together.
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { RangePicker, paintGradientTrack, type Thumb } from '@orochi235/weasel-ui';

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

type CThumb = Thumb & { key: 'cTop' | 'cPeak' | 'cBot' };

interface RampParams {
  hue: number;
  midL: number;
  lRange: [number, number];
  chroma: { cTop: number; cPeak: number; cBot: number };
}

/** Piecewise-linear chroma curve over L. Three control points: cBot at the
 *  L-axis bottom (lRange[0]), cPeak at the midpoint (midL), cTop at the
 *  top (lRange[1]). Linear inside each segment; clamped to the bot/top
 *  values outside the L range. */
function chromaAt(L: number, p: RampParams): number {
  const [lo, hi] = p.lRange;
  if (L <= lo) return p.chroma.cBot;
  if (L >= hi) return p.chroma.cTop;
  if (L <= p.midL) return p.chroma.cBot + (p.chroma.cPeak - p.chroma.cBot) * ((L - lo) / (p.midL - lo));
  return p.chroma.cPeak + (p.chroma.cTop - p.chroma.cPeak) * ((L - p.midL) / (hi - p.midL));
}

/** Map a Tailwind-style index (0–1000) to an L value: 0 → lightest (top of
 *  L range), 1000 → darkest (bottom). Matches the perceptual-color
 *  experiment's convention. */
function lAtIndex(idx: number, lRange: [number, number]): number {
  const t = Math.max(0, Math.min(1, idx / 1000));
  return lRange[1] + t * (lRange[0] - lRange[1]);
}

function colorAtIndex(idx: number, p: RampParams): string {
  const L = lAtIndex(idx, p.lRange);
  return oklchToHex(L, chromaAt(L, p), p.hue);
}

/** Output swatch: row of color tiles, one per index. Each labeled with its
 *  index value in the bottom-right corner. */
function OutputSwatchRow({ indices, params }: { indices: number[]; params: RampParams }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${indices.length}, 1fr)`, gap: 2 }}>
      {indices.map((idx, i) => {
        const color = colorAtIndex(idx, params);
        // Pick label text color by L: light index gets dark text, dark gets light.
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

/** Small SVG diagram of the chroma curve over L. Three filled circles mark
 *  the (cBot, cPeak, cTop) control points; a piecewise-linear path traces
 *  between them. Axes are L (horizontal, 0→1) and C (vertical, 0→max). */
function ChromaCurveDiagram({ params }: { params: RampParams }) {
  const W = 320, H = 110;
  const PAD_L = 24, PAD_R = 8, PAD_T = 8, PAD_B = 22;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxC = 0.22;
  const xAt = (L: number) => PAD_L + L * plotW;
  const yAt = (C: number) => PAD_T + (1 - C / maxC) * plotH;
  const [lo, hi] = params.lRange;
  const points: Array<{ L: number; C: number; label: string; color: string }> = [
    { L: lo,         C: params.chroma.cBot,  label: 'B', color: oklchToHex(lo,         params.chroma.cBot,  params.hue) },
    { L: params.midL, C: params.chroma.cPeak, label: 'P', color: oklchToHex(params.midL, params.chroma.cPeak, params.hue) },
    { L: hi,         C: params.chroma.cTop,  label: 'T', color: oklchToHex(hi,         params.chroma.cTop,  params.hue) },
  ];
  const pathD = `M ${xAt(points[0].L)} ${yAt(points[0].C)} L ${xAt(points[1].L)} ${yAt(points[1].C)} L ${xAt(points[2].L)} ${yAt(points[2].C)}`;
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      {/* Plot frame */}
      <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} fill="rgba(0,0,0,0.25)" stroke="var(--ckd-border-2)" />
      {/* Y gridlines at C=0.05, 0.10, 0.15, 0.20 */}
      {[0.05, 0.10, 0.15, 0.20].map(c => (
        <line key={c} x1={PAD_L} y1={yAt(c)} x2={PAD_L + plotW} y2={yAt(c)} stroke="rgba(255,255,255,0.07)" />
      ))}
      {/* X marker at midL */}
      <line x1={xAt(params.midL)} y1={PAD_T} x2={xAt(params.midL)} y2={PAD_T + plotH} stroke="rgba(255,255,255,0.10)" strokeDasharray="2 3" />
      {/* Curve */}
      <path d={pathD} fill="none" stroke="var(--ckd-text)" strokeWidth={1.5} />
      {/* Control points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(p.L)} cy={yAt(p.C)} r={5} fill={p.color} stroke="var(--ckd-text)" strokeWidth={1.5} />
          <text x={xAt(p.L)} y={yAt(p.C) - 9} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-muted)" textAnchor="middle">{p.label}</text>
        </g>
      ))}
      {/* Axis labels */}
      <text x={PAD_L} y={H - 6} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)">L: 0</text>
      <text x={PAD_L + plotW} y={H - 6} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)" textAnchor="end">1</text>
      <text x={6} y={PAD_T + plotH / 2} fontSize={10} fontFamily="ui-monospace, monospace" fill="var(--ckd-faint)" transform={`rotate(-90 6 ${PAD_T + plotH / 2})`} textAnchor="middle">C</text>
    </svg>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
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

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
        <div>
          <h3 style={{ margin: '0 0 8px' }}>Chroma (3-thumb, free, per-thumb bounds)</h3>
          <RangePicker<CThumb>
            min={0} max={0.22} step={0.005}
            constraint="free"
            thumbs={[
              { value: chroma.cTop,  label: 'T', key: 'cTop',  bounds: [0, 0.06] },
              { value: chroma.cPeak, label: 'P', key: 'cPeak', bounds: [0, 0.22] },
              { value: chroma.cBot,  label: 'B', key: 'cBot',  bounds: [0, 0.10] },
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
        </div>
        <div>
          <h3 style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--ckd-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>C as function of L</h3>
          <ChromaCurveDiagram params={params} />
        </div>
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
  );
}

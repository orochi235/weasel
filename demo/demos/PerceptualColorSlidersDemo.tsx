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

export function PerceptualColorSlidersDemo() {
  const [hue, setHue] = useState(200);
  const midL = 0.65;
  const peakC = 0.16;

  const [lRange, setLRange] = useState<[number, number]>([0.16, 0.97]);

  const [chroma, setChroma] = useState({ cTop: 0.04, cPeak: 0.16, cBot: 0.08 });

  const [indices, setIndices] = useState<number[]>([25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16, maxWidth: 720 }}>
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

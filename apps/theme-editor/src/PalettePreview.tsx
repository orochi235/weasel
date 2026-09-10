import { useState } from 'react';
import styles from './PaletteLab.module.css';
import type { Palette } from './palette/generate';

const BAR_HEIGHTS = [0.62, 0.4, 0.78, 0.3, 0.55, 0.72, 0.46, 0.66, 0.35, 0.58, 0.5, 0.7, 0.42, 0.6, 0.33, 0.68];

function Marks({ palette, background }: { palette: Palette; background: string }) {
  const n = palette.swatches.length;
  const W = 700;
  const H = 76;
  const slot = (W - 20) / n;
  return (
    <div className={styles.marks} style={{ background }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Bars in every palette color">
        {palette.swatches.map((s, i) => {
          const h = BAR_HEIGHTS[i % BAR_HEIGHTS.length] * (H - 12);
          return (
            <rect
              key={s.hex + i}
              x={10 + i * slot}
              y={H - 6 - h}
              width={slot * 0.72}
              height={h}
              fill={s.hex}
              rx={2}
            />
          );
        })}
      </svg>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Lines in every palette color">
        {palette.swatches.map((s, i) => (
          <polyline
            key={s.hex + i}
            points={Array.from({ length: 9 }, (_, k) => {
              const x = 10 + (k * (W - 20)) / 8;
              // Phase by i/n, not a fixed step: a constant offset wraps past 2*PI
              // once the set is large and series start drawing on top of each other.
              const phase = (i / n) * Math.PI * 2;
              const amplitude = (H / 2 - 9) * (0.72 + 0.28 * ((i % 3) / 2));
              const y = H / 2 - amplitude * Math.sin(k * 0.7 + phase);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ')}
            fill="none"
            stroke={s.hex}
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

export function PalettePreview({ palette, surface }: { palette: Palette; surface: string }) {
  const [copied, setCopied] = useState(false);
  const { stats, swatches } = palette;
  const hexes = swatches.map((s) => s.hex).join(' ');

  const tokenJson = swatches
    .map((s, i) => `    "swatch-${s.name}":${' '.repeat(Math.max(1, 10 - s.name.length))}{ "$value": "${s.hex}" }${i === swatches.length - 1 ? '' : ','}`)
    .join('\n');

  return (
    <div className={styles.previewBody}>
      <div className={styles.stats}>
        <Stat label="mean chroma" value={stats.meanChroma.toFixed(3)} note="Tailwind 500 is 0.187" />
        <Stat label="chroma spread" value={stats.chromaSpread.toFixed(3)} />
        <Stat label="lightness spread" value={stats.lightnessSpread.toFixed(3)} note="working palettes run 0.14–0.26" />
        <Stat label="min hue gap" value={`${stats.minHueGap.toFixed(0)}°`} />
        <Stat
          label="min contrast"
          value={stats.minContrast.toFixed(2)}
          tone={stats.minContrast >= 3 ? 'ok' : 'bad'}
        />
      </div>

      {(['#181a1e', '#f5f5f6'] as const).map((bg) => (
        <section
          key={bg}
          className={styles.pane}
          style={{ background: bg, ['--pane-fg' as string]: bg === '#181a1e' ? '#e6e7e9' : '#25272c' }}
        >
          <header className={styles.paneTitle}>
            {bg === '#181a1e' ? 'dark surface' : 'light surface'}
            {bg === surface && <span className={styles.gated}>contrast gated here</span>}
          </header>
          <div className={styles.swatches}>
            {swatches.map((s, i) => (
              <div key={s.hex + i} className={styles.swatch}>
                <div className={styles.chip} style={{ background: s.hex }} title={`${s.name} ${s.hex}`} />
                <span className={styles.chipName}>
                  {s.anchored ? '◆ ' : ''}
                  {s.name}
                </span>
              </div>
            ))}
          </div>
          <Marks palette={palette} background={bg} />
        </section>
      ))}

      <div className={styles.output}>
        <code className={styles.hexes}>{hexes}</code>
        <button
          type="button"
          className={styles.copy}
          onClick={() => {
            void navigator.clipboard?.writeText(tokenJson);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          }}
        >
          {copied ? 'Copied' : 'Copy as tokens'}
        </button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'ok' | 'bad';
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={tone === 'bad' ? styles.statBad : tone === 'ok' ? styles.statOk : styles.statValue}>
        {value}
      </span>
      {note && <span className={styles.statNote}>{note}</span>}
    </div>
  );
}

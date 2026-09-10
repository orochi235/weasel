import { useMemo, useState } from 'react';
import styles from './PaletteLab.module.css';
import { PinIcon } from './PinIcon';
import { LEGO_COLORS } from './palette/legoColors';
import { anchorFromHex, CRAYONS, crayonAnchor, crayonHex, type Anchor } from './palette/generate';
import { toLch } from './palette/oklch';

export type SourceId = 'named' | 'lego' | 'copic';

interface Swatch {
  readonly key: string;
  readonly label: string;
  readonly hex: string;
  readonly anchor: () => Anchor;
}

export interface SwatchPanelProps {
  anchors: readonly Anchor[];
  onChange: (next: readonly Anchor[]) => void;
  /** Anchors cannot outnumber the set. */
  count: number;
}

/**
 * Banded by quantized chroma, then hue inside the band.
 *
 * Chroma alone scrambles the hues; hue alone puts a vivid red beside a tan.
 * Banding gives each run of rows one vividness with a rainbow across it.
 */
function ordered(swatches: readonly Swatch[], bands: number): Swatch[] {
  const measured = swatches.map((s) => ({ s, ...toLch(s.hex) }));
  if (bands <= 1 || measured.length === 0) {
    return [...measured].sort((a, b) => a.H - b.H).map((x) => x.s);
  }
  // Band edges span the set's own chroma range, so the slider divides what is
  // actually there rather than a fixed 0-to-max that most sets never fill.
  const lo = Math.min(...measured.map((m) => m.C));
  const hi = Math.max(...measured.map((m) => m.C));
  const width = (hi - lo) / bands || 1;
  return measured
    .map((m) => ({ ...m, band: Math.min(bands - 1, Math.floor((m.C - lo) / width)) }))
    .sort((a, b) => b.band - a.band || a.H - b.H)
    .map((x) => x.s);
}

export function SwatchPanel({ anchors, onChange, count }: SwatchPanelProps) {
  const [source, setSource] = useState<SourceId>('named');
  const [hovered, setHovered] = useState<string | null>(null);
  const [hex, setHex] = useState('#e0e11c');
  const [bands, setBands] = useState(6);

  const sets = useMemo<Record<SourceId, Swatch[]>>(
    () => ({
      named: ordered(
        Object.keys(CRAYONS).map((name) => ({
          key: name,
          label: name,
          hex: crayonHex(name),
          anchor: () => crayonAnchor(name),
        })),
        bands,
      ),
      lego: ordered(
        LEGO_COLORS.map((c) => ({
          key: `lego-${c.code}`,
          label: `${c.name} · ${c.code}`,
          hex: c.hex,
          anchor: () => anchorFromHex(c.hex, c.name.toLowerCase().replace(/\s+/g, '-')),
        })),
        bands,
      ),
      copic: [],
    }),
    [bands],
  );

  const swatches = sets[source];
  const full = anchors.length >= count;
  const pinnedHexes = new Set(anchors.map((a) => a.name));

  const add = (make: () => Anchor) => {
    if (full) return;
    const a = make();
    const taken = new Set(anchors.map((x) => x.name));
    let name = a.name;
    for (let n = 2; taken.has(name); n += 1) name = `${a.name}-${n}`;
    onChange([...anchors, { ...a, name }]);
  };
  const unpin = (name: string) => onChange(anchors.filter((a) => a.name !== name));

  const TABS: readonly { id: SourceId; label: string }[] = [
    { id: 'named', label: `Named · ${sets.named.length}` },
    { id: 'lego', label: `LEGO · ${sets.lego.length}` },
    { id: 'copic', label: 'Copic' },
  ];

  return (
    <section className={styles.swatchPanel} aria-label="Color sources">
      <header className={styles.swatchHead}>
        <div className={styles.swatchTabs} role="tablist" aria-label="Color source">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={source === t.id}
              className={source === t.id ? styles.swatchTabOn : styles.swatchTab}
              onClick={() => setSource(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className={styles.bandControl}>
          <span>Chroma bands</span>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={bands}
            onChange={(e) => setBands(Number(e.target.value))}
            aria-label="Number of chroma bands to group into"
          />
          <output>{bands === 1 ? 'off' : bands}</output>
        </label>
        <span className={styles.swatchHover}>{hovered ?? ''}</span>
        <label className={styles.anchorFromHex}>
          <input
            type="text"
            value={hex}
            spellCheck={false}
            onChange={(e) => setHex(e.target.value)}
            className={styles.anchorHexInput}
            aria-label="Hex color to pin"
          />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'}
            onChange={(e) => setHex(e.target.value)}
            className={styles.anchorSwatchInput}
            aria-label="Pick a color to pin"
          />
          <button
            type="button"
            className={styles.copy}
            disabled={full || !/^#[0-9a-f]{6}$/i.test(hex)}
            onClick={() => add(() => anchorFromHex(hex))}
          >
            <PinIcon size={11} /> Pin
          </button>
        </label>
      </header>

      {swatches.length === 0 ? (
        <p className={styles.anchorHint}>
          No source for Copic values yet. They are not derivable — each marker's color is a
          measurement, and guessing 358 of them would put wrong hexes behind real names. Drop a
          list in and this fills itself.
        </p>
      ) : (
        <div className={styles.crayonGrid} onMouseLeave={() => setHovered(null)} role="group">
          {swatches.map((s) => {
            const isPinned = pinnedHexes.has(s.key) || anchors.some((a) => a.name === s.label);
            return (
              <button
                key={s.key}
                type="button"
                className={isPinned ? styles.crayonPinned : styles.crayon}
                style={{ background: s.hex }}
                disabled={!isPinned && full}
                title={`${s.label} ${s.hex}`}
                aria-label={isPinned ? `Unpin ${s.label}` : `Pin ${s.label}`}
                aria-pressed={isPinned}
                onMouseEnter={() => setHovered(`${s.label} · ${s.hex}`)}
                onFocus={() => setHovered(`${s.label} · ${s.hex}`)}
                onClick={() => (isPinned ? unpin(s.label) : add(s.anchor))}
              >
                {isPinned && <PinIcon size={13} className={styles.crayonPin} />}
              </button>
            );
          })}
        </div>
      )}
      {full && <p className={styles.anchorHint}>Every slot is pinned — raise the color count to add more.</p>}
    </section>
  );
}

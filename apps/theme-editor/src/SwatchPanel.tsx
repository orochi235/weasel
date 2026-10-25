import { useMemo, useState } from 'react';
import styles from './PaletteLab.module.css';
import { PinIcon } from './PinIcon';
import { COPIC_COLORS } from './palette/copicColors';
import { LEGO_COLORS } from './palette/legoColors';
import { CRAYONS, crayonAnchor, crayonHex } from './palette/crayons';
import { anchorFromHex, toLch, type Anchor } from '@weasel-js/theme/engine';
import { Button } from '@weasel-js/ui/components/Button';
import { ColorField } from '@weasel-js/ui/components/ColorField';
import { Input } from '@weasel-js/ui/components/Input';
import { Slider } from '@weasel-js/ui/components/Slider';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';

const HEX6 = /^#[0-9a-f]{6}$/i;

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
          key: `lego-${c.name}`,
          label: c.name,
          hex: c.hex,
          anchor: () => anchorFromHex(c.hex, c.name.toLowerCase().replace(/\s+/g, '-')),
        })),
        bands,
      ),
      copic: ordered(
        COPIC_COLORS.map((c) => ({
          key: `copic-${c.code}`,
          label: `${c.code} ${c.name}`,
          hex: c.hex,
          anchor: () => anchorFromHex(c.hex, c.code.toLowerCase()),
        })),
        bands,
      ),
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
    { id: 'copic', label: `Copic · ${sets.copic.length}` },
  ];

  return (
    <section className={styles.swatchPanel} aria-label="Color sources">
    <Tabs className={styles.swatchTabs} selectedKey={source} onSelectionChange={(key) => setSource(key as SourceId)}>
      <header className={styles.swatchHead}>
        <TabList aria-label="Color source" items={TABS}>
          {(t) => <Tab id={t.id}>{t.label}</Tab>}
        </TabList>
        <div className={styles.bandControl}>
          <span>Chroma bands</span>
          <Slider
            className={styles.bandSlider}
            thumbs={[{ value: bands, valueText: bands === 1 ? 'off' : String(bands) }]}
            onInput={([t]) => setBands(t.value)}
            min={1}
            max={12}
            step={1}
            thumbShape="dot"
            trackHeight="var(--wzl-slider-track-h)"
            thumbSize="var(--wzl-slider-thumb-size)"
            readoutPlacement="inline-after"
            renderReadout={(t) => <span className={styles.bandValue}>{t.value === 1 ? 'off' : t.value}</span>}
            ariaLabel="Number of chroma bands to group into"
          />
        </div>
        <span className={styles.swatchHover}>{hovered ?? ''}</span>
        <div className={styles.anchorFromHex}>
          <Input
            value={hex}
            onChange={setHex}
            className={styles.anchorHexInput}
            aria-label="Hex color to pin"
          />
          <ColorField
            value={HEX6.test(hex) ? hex : '#000000'}
            onInput={setHex}
            onChange={setHex}
            aria-label="Pick a color to pin"
          />
          <Button
            size="sm"
            leadingIcon={<PinIcon size={11} />}
            disabled={full || !HEX6.test(hex)}
            onClick={() => add(() => anchorFromHex(hex))}
          >
            Pin
          </Button>
        </div>
      </header>

      <TabPanel id={source} className={styles.swatchTabPanel}>
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
      </TabPanel>
      {full && <p className={styles.anchorHint}>Every slot is pinned — raise the color count to add more.</p>}
    </Tabs>
    </section>
  );
}

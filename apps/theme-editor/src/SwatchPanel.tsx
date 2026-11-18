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
import { SwatchGrid, type SwatchGridOption } from '@weasel-js/ui/components/SwatchGrid';
import { Tab, TabList, TabPanel, Tabs } from '@weasel-js/ui/components/Tabs';

const HEX6 = /^#[0-9a-f]{6}$/i;
const FULL = 'Every slot is pinned — raise the color count to add more.';
/** Swatches to a row of the crayon grid. */
const CRAYON_COLUMNS = 12;

/** What tells one anchor from another: two sources' swatches, or a hex pin, can share a name but not this. */
const colorOf = (a: Anchor): string => `${a.hue}|${a.lightness}|${a.chroma}`;

export type SourceId = 'named' | 'lego' | 'copic';

interface Swatch {
  readonly key: string;
  readonly label: string;
  readonly hex: string;
  /** The name the swatch's anchor takes. Sources share names, so a pinned one is found by its color instead. */
  readonly name: string;
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
          name,
          anchor: () => crayonAnchor(name),
        })),
        bands,
      ),
      lego: ordered(
        LEGO_COLORS.map((c) => {
          const name = c.name.toLowerCase().replace(/\s+/g, '-');
          return { key: `lego-${c.name}`, label: c.name, hex: c.hex, name, anchor: () => anchorFromHex(c.hex, name) };
        }),
        bands,
      ),
      copic: ordered(
        COPIC_COLORS.map((c) => {
          const name = c.code.toLowerCase();
          return { key: `copic-${c.code}`, label: `${c.code} ${c.name}`, hex: c.hex, name, anchor: () => anchorFromHex(c.hex, name) };
        }),
        bands,
      ),
    }),
    [bands],
  );

  const swatches = sets[source];
  const colors = useMemo(() => new Map(swatches.map((s) => [s.key, colorOf(s.anchor())])), [swatches]);
  const full = anchors.length >= count;
  const pinnedByColor = new Map(anchors.map((a) => [colorOf(a), a.name]));
  const pinnedName = (s: Swatch) => pinnedByColor.get(colors.get(s.key)!);

  const add = (make: () => Anchor) => {
    if (full) return;
    const a = make();
    const taken = new Set(anchors.map((x) => x.name));
    let name = a.name;
    for (let n = 2; taken.has(name); n += 1) name = `${a.name}-${n}`;
    onChange([...anchors, { ...a, name }]);
  };
  const unpin = (name: string) => onChange(anchors.filter((a) => a.name !== name));
  const byKey = new Map(swatches.map((s) => [s.key, s]));
  const crayons: SwatchGridOption[] = swatches.map((s) => {
    const pinned = pinnedName(s) !== undefined;
    return {
      id: s.key,
      value: s.hex,
      label: s.label,
      ...(pinned ? { glyph: <PinIcon size={13} className={styles.crayonPin} /> } : {}),
      ...(!pinned && full ? { disabled: true, disabledReason: FULL } : {}),
    };
  });

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
            aria-label="Number of chroma bands to group into"
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
        <SwatchGrid
          className={styles.crayonGrid}
          aria-label="Swatches to pin"
          options={crayons}
          value={swatches.filter((s) => pinnedName(s) !== undefined).map((s) => s.key)}
          columns={CRAYON_COLUMNS}
          onSelect={(key) => {
            const s = key === null ? undefined : byKey.get(key);
            if (!s) return;
            const name = pinnedName(s);
            if (name !== undefined) unpin(name);
            else add(s.anchor);
          }}
          onHoverChange={(o) => setHovered(o && `${o.label} · ${o.value}`)}
        />
      </TabPanel>
      {full && <p className={styles.anchorHint}>{FULL}</p>}
    </Tabs>
    </section>
  );
}

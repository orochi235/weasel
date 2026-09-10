import { PropertyGroup } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import styles from './PaletteLab.module.css';
import { PinIcon } from './PinIcon';
import {
  anchorFromHex,
  CRAYONS,
  crayonAnchor,
  crayonHex,
  toHexPreview,
  type Anchor,
} from './palette/generate';
import { toLch } from './palette/oklch';

export interface AnchorListProps {
  anchors: readonly Anchor[];
  onChange: (next: readonly Anchor[]) => void;
  /** Anchors cannot outnumber the set. */
  count: number;
}

/**
 * Pinned hues. A pinned color keeps its own lightness — that is the point of
 * pinning, since a color gets pinned precisely when the lightness law would
 * have excluded it. Yellow is the sharpest case, not a special one.
 */
export function AnchorList({ anchors, onChange, count }: AnchorListProps) {
  const [hex, setHex] = useState('#e0e11c');
  const [hovered, setHovered] = useState<string | null>(null);

  const replace = (i: number, next: Partial<Anchor>) =>
    onChange(anchors.map((a, j) => (j === i ? { ...a, ...next } : a)));
  const remove = (i: number) => onChange(anchors.filter((_, j) => j !== i));
  const unpinByName = (name: string) => onChange(anchors.filter((a) => a.name !== name));
  const add = (a: Anchor) => {
    if (anchors.length >= count) return;
    const taken = new Set(anchors.map((x) => x.name));
    let name = a.name;
    for (let n = 2; taken.has(name); n += 1) name = `${a.name}-${n}`;
    onChange([...anchors, { ...a, name }]);
  };

  const full = anchors.length >= count;
  const pinned = new Set(anchors.map((a) => a.name));

  /**
   * Banded by chroma, then hue within the band.
   *
   * Sorting by chroma alone scrambles the hues, and sorting by hue alone mixes
   * a vivid red next to a tan. Quantizing chroma first puts each band on its own
   * run of rows, and the hue sort makes that run a rainbow you can point into.
   */
  const names = useMemo(() => {
    const BAND = 0.04;
    return Object.keys(CRAYONS)
      .map((name) => {
        const { C, H } = toLch(crayonHex(name));
        return { name, band: Math.round(C / BAND), hue: H };
      })
      .sort((a, b) => b.band - a.band || a.hue - b.hue)
      .map((x) => x.name);
  }, []);

  return (
    <PropertyGroup title="Anchors">
      {anchors.length === 0 && (
        <p className={styles.anchorHint}>
          Nothing pinned — every color comes from the lightness law. Pin one when the law would
          otherwise give you a different color than the name.
        </p>
      )}

      {anchors.map((a, i) => (
        <div key={`${a.name}-${i}`} className={styles.anchorRow}>
          <label className={styles.anchorChipEdit} title={`Edit ${a.name}`}>
            <span className={styles.anchorChip} style={{ background: toHexPreview(a) }} />
            <input
              type="color"
              value={toHexPreview(a)}
              onChange={(e) => replace(i, anchorFromHex(e.target.value, a.name))}
              aria-label={`Edit ${a.name}`}
            />
          </label>
          <span className={styles.anchorName} title={a.name}>
            {a.name}
          </span>
          <label className={styles.anchorField}>
            <span className={styles.anchorFieldLabel}>h</span>
            <input
              type="number"
              min={0}
              max={359}
              value={a.hue}
              onChange={(e) => replace(i, { hue: Number(e.target.value) })}
              className={styles.anchorNumber}
              aria-label={`${a.name} hue`}
            />
          </label>
          <label className={styles.anchorField}>
            <span className={styles.anchorFieldLabel}>L</span>
            <input
              type="number"
              min={0.3}
              max={0.97}
              step={0.01}
              value={a.lightness}
              onChange={(e) => replace(i, { lightness: Number(e.target.value) })}
              className={styles.anchorNumber}
              aria-label={`${a.name} lightness`}
            />
          </label>
          <button
            type="button"
            className={styles.anchorX}
            onClick={() => remove(i)}
            aria-label={`Unpin ${a.name}`}
            title={`Unpin ${a.name}`}
          >
            <svg viewBox="0 0 10 10" width={10} height={10} aria-hidden="true">
              <path
                d="M1.5 1.5 L8.5 8.5 M8.5 1.5 L1.5 8.5"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      ))}

      <div className={styles.anchorAdd}>
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
            onClick={() => add(anchorFromHex(hex))}
          >
            <PinIcon size={11} /> Pin
          </button>
        </label>

        <div
          className={styles.crayonGrid}
          onMouseLeave={() => setHovered(null)}
          role="group"
          aria-label="Named colors"
        >
          {names.map((name) => {
            const isPinned = pinned.has(name);
            return (
              <button
                key={name}
                type="button"
                className={isPinned ? styles.crayonPinned : styles.crayon}
                style={{ background: crayonHex(name) }}
                disabled={!isPinned && full}
                title={isPinned ? `Unpin ${name}` : name}
                aria-label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
                aria-pressed={isPinned}
                onMouseEnter={() => setHovered(name)}
                onFocus={() => setHovered(name)}
                onClick={() => (isPinned ? unpinByName(name) : add(crayonAnchor(name)))}
              >
                {isPinned && <PinIcon size={13} className={styles.crayonPin} />}
              </button>
            );
          })}
        </div>
        <p className={styles.crayonCaption}>{hovered ?? `${names.length} named colors`}</p>

        {full && (
          <p className={styles.anchorHint}>Every slot is pinned — raise the color count to add more.</p>
        )}
      </div>
    </PropertyGroup>
  );
}

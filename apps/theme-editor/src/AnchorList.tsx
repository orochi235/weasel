import { PropertyGroup } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import styles from './PaletteLab.module.css';
import { PinIcon } from './PinIcon';
import {
  anchorFromHex,
  CRAYONS,
  crayonAnchor,
  crayonHex,
  SUGGESTED_ANCHORS,
  toHexPreview,
  type Anchor,
} from './palette/generate';

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
  const [query, setQuery] = useState('');

  const replace = (i: number, next: Partial<Anchor>) =>
    onChange(anchors.map((a, j) => (j === i ? { ...a, ...next } : a)));
  const remove = (i: number) => onChange(anchors.filter((_, j) => j !== i));
  const add = (a: Anchor) => {
    if (anchors.length >= count) return;
    const taken = new Set(anchors.map((x) => x.name));
    let name = a.name;
    for (let n = 2; taken.has(name); n += 1) name = `${a.name}-${n}`;
    onChange([...anchors, { ...a, name }]);
  };

  const full = anchors.length >= count;
  const pinned = new Set(anchors.map((a) => a.name));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = Object.keys(CRAYONS);
    if (!q) return SUGGESTED_ANCHORS.map((sa) => ({ name: sa.name as string, note: sa.note }));
    return names
      .filter((n) => n.includes(q))
      .slice(0, 12)
      .map((n) => ({ name: n, note: '' }));
  }, [query]);

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
          <span
            className={styles.anchorChip}
            style={{ background: toHexPreview(a) }}
            aria-hidden="true"
          />
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

        <input
          type="search"
          value={query}
          placeholder={`Search ${Object.keys(CRAYONS).length} named colors`}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.anchorSearch}
          aria-label="Search named colors"
        />

        <div className={styles.anchorPresets}>
          {matches.map((m) => (
            <button
              key={m.name}
              type="button"
              className={styles.anchorPreset}
              disabled={full || pinned.has(m.name)}
              title={m.note || m.name}
              onClick={() => add(crayonAnchor(m.name))}
            >
              <span
                className={styles.anchorChip}
                style={{ background: crayonHex(m.name) }}
                aria-hidden="true"
              />
              {m.name}
            </button>
          ))}
        </div>
        {full && (
          <p className={styles.anchorHint}>Every slot is pinned — raise the color count to add more.</p>
        )}
      </div>
    </PropertyGroup>
  );
}

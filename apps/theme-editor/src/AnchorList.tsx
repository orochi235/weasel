import { NumberRow, PropertyGroup, SliderRow } from '@weasel-js/ui';
import { useState } from 'react';
import styles from './PaletteLab.module.css';
import {
  anchorFromHex,
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
 * Pinned hues. A pinned color keeps its own lightness — that is the whole
 * point, since the reason to pin one is usually that the lightness law would
 * not have chosen it. Yellow is the sharpest case, not a special case.
 */
export function AnchorList({ anchors, onChange, count }: AnchorListProps) {
  const [hex, setHex] = useState('#e0e11c');

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

  return (
    <PropertyGroup title="Anchors">
      {anchors.length === 0 && (
        <p className={styles.anchorHint}>
          Nothing pinned — every color comes from the lightness law. Pin one when the law would
          exclude it.
        </p>
      )}

      {anchors.map((a, i) => (
        <div key={`${a.name}-${i}`} className={styles.anchor}>
          <div className={styles.anchorHead}>
            <span
              className={styles.anchorChip}
              style={{ background: toHexPreview(a) }}
              aria-hidden="true"
            />
            <span className={styles.anchorName}>{a.name}</span>
            <button
              type="button"
              className={styles.anchorRemove}
              onClick={() => remove(i)}
              aria-label={`Unpin ${a.name}`}
            >
              Unpin
            </button>
          </div>
          <NumberRow label="Hue" value={a.hue} onChange={(v) => replace(i, { hue: v })} />
          <SliderRow
            label="Lightness"
            value={a.lightness}
            min={0.3}
            max={0.97}
            step={0.01}
            onChange={(v) => replace(i, { lightness: v })}
          />
        </div>
      ))}

      <div className={styles.anchorAdd}>
        <label className={styles.anchorFromHex}>
          <span>From a hex</span>
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
            Pin
          </button>
        </label>

        <div className={styles.anchorPresets}>
          {SUGGESTED_ANCHORS.map((a) => (
            <button
              key={a.name}
              type="button"
              className={styles.anchorPreset}
              disabled={full}
              title={a.note}
              onClick={() => add({ name: a.name, hue: a.hue, lightness: a.lightness })}
            >
              <span
                className={styles.anchorChip}
                style={{ background: toHexPreview(a) }}
                aria-hidden="true"
              />
              {a.name}
            </button>
          ))}
        </div>
        {full && <p className={styles.anchorHint}>Every slot is pinned — raise the color count to add more.</p>}
      </div>
    </PropertyGroup>
  );
}

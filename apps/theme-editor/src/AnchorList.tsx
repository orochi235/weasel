import { PropertyGroup } from '@weasel-js/ui';

import styles from './PaletteLab.module.css';
import { anchorFromHex, toHexPreview, type Anchor } from './palette/generate';

export interface AnchorListProps {
  anchors: readonly Anchor[];
  onChange: (next: readonly Anchor[]) => void;
}

/**
 * Pinned hues. A pinned color keeps its own lightness — that is the point of
 * pinning, since a color gets pinned precisely when the lightness law would
 * have excluded it. Yellow is the sharpest case, not a special one.
 */
export function AnchorList({ anchors, onChange }: AnchorListProps) {

  const replace = (i: number, next: Partial<Anchor>) =>
    onChange(anchors.map((a, j) => (j === i ? { ...a, ...next } : a)));
  const remove = (i: number) => onChange(anchors.filter((_, j) => j !== i));



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

      {anchors.length > 0 && (
        <p className={styles.anchorHint}>
          Pinned colors keep their own lightness. Pick more from the panel below.
        </p>
      )}
    </PropertyGroup>
  );
}

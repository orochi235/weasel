import { anchorFromHex, toHexPreview, type Anchor } from '@weasel-js/theme/engine';
import { Button, CLOSE_BUTTON_PROPS } from '@weasel-js/ui/components/Button';
import { ColorField } from '@weasel-js/ui/components/ColorField';
import { NumberField } from '@weasel-js/ui/components/NumberField';
import { PropertyGroup } from '@weasel-js/ui/components/Properties';

import styles from './PaletteLab.module.css';

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
  const recolor = (i: number, hex: string) => replace(i, anchorFromHex(hex, anchors[i]!.name));
  // A cleared field commits NaN; the anchor keeps the value it had.
  const setNumber = (i: number, key: 'hue' | 'lightness', value: number) => {
    if (Number.isFinite(value)) replace(i, { [key]: value });
  };

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
          <ColorField
            value={toHexPreview(a)}
            onInput={(hex) => recolor(i, hex)}
            onChange={(hex) => recolor(i, hex)}
            aria-label={`Edit ${a.name}`}
          />
          <span className={styles.anchorName} title={a.name}>
            {a.name}
          </span>
          <NumberField
            className={styles.anchorNumber}
            label="h"
            orientation="row"
            width="fit"
            hideSteppers
            aria-label={`${a.name} hue`}
            minValue={0}
            maxValue={359}
            value={a.hue}
            onChange={(v) => setNumber(i, 'hue', v)}
          />
          <NumberField
            className={styles.anchorNumber}
            label="L"
            orientation="row"
            width="fit"
            hideSteppers
            aria-label={`${a.name} lightness`}
            minValue={0.3}
            maxValue={0.97}
            step={0.01}
            value={a.lightness}
            onChange={(v) => setNumber(i, 'lightness', v)}
          />
          <Button {...CLOSE_BUTTON_PROPS} aria-label={`Unpin ${a.name}`} tooltip={`Unpin ${a.name}`} onClick={() => remove(i)} />
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

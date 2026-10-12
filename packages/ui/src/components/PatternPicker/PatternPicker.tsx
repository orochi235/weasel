import { useId, type CSSProperties, type ReactElement } from 'react';
import {
  composePatternTransform,
  decomposePatternTransform,
  isTilePaint,
  seedTile,
  TILE_KINDS,
  type PatternPaint,
  type TileKind,
  type TilePaint,
  type TilePatternSpec,
} from '@weasel-js/core';
import { unit } from '@weasel-js/quantity';
import { tilePreviewCssUrl } from '@weasel-js/svg';
import { UnitField } from '../NumberField';
import { ToggleBar } from '../ToggleBar';
import f from '../field.module.css';
import s from './PatternPicker.module.css';

/** Tile sizes the picker offers, coarse enough that each reads as a
 *  distinct texture rather than a nudge. */
const TILE_SIZES: readonly { value: number; label: string }[] = [
  { value: 4, label: 'S' },
  { value: 8, label: 'M' },
  { value: 16, label: 'L' },
  { value: 32, label: 'XL' },
];

const DEFAULT_TILE_SIZE = 8;

/** Every swatch previews at one size so the grid compares tiles, not scales. */
const PREVIEW_SIZE = 16;

const DEGREES = unit('°', { places: 1 });

/** Rotation in degrees, folded into (-180, 180]. */
function toDegrees(rad: number): number {
  const deg = (rad * 180) / Math.PI;
  const folded = ((((deg + 180) % 360) + 360) % 360) - 180;
  return folded === -180 ? 180 : folded;
}

/** `value` with its transform's rotation replaced, the transform dropped when
 *  nothing is left of it. */
function withRotation(value: PatternPaint, degrees: number): PatternPaint {
  const parts = decomposePatternTransform(value.transform);
  const [a, b, c, d] = composePatternTransform({ ...parts, rotation: (degrees * Math.PI) / 180 });
  const { transform: _drop, ...rest } = value;
  const identity = Math.abs(a - 1) < 1e-9 && Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9 && Math.abs(d - 1) < 1e-9;
  return identity ? rest : { ...rest, transform: [a, b, c, d] };
}

/** A tile paint seeded from a color, at one of the picker's sizes. */
export function seedPattern(
  tile: TileKind,
  from: string,
  size: number = DEFAULT_TILE_SIZE,
): TilePaint {
  return { ...seedTile(tile, from), size };
}

/** Props for {@link PatternPicker}. */
export interface PatternPickerProps {
  /** The pattern paint being edited. */
  value: PatternPaint;
  /** The color new tiles are seeded with — the paint's own, normally. */
  color: string;
  /** Committed value: one call per click. A tile pick, a size change and a
   *  committed rotation are each a complete gesture, so there is no `onInput`. */
  onChange: (next: PatternPaint) => void;
  className?: string;
}

/**
 * Grid of tile swatches over a size switch and a rotation field, each swatch
 * previewing the real tile at the current color. Rotation edits only the
 * rotation part of the paint's `transform`; scale and skew survive it.
 *
 * The preview shares its shape mapper with what the renderer paints, so a
 * swatch cannot drift from the texture it selects.
 */
export function PatternPicker(props: PatternPickerProps): ReactElement {
  const { value, color, onChange, className } = props;
  // A `texture` paint names no tile, so the picker shows none selected and
  // replaces it wholesale on the next click.
  const tile = isTilePaint(value) ? value : null;
  const size = tile?.size ?? DEFAULT_TILE_SIZE;
  const rotationId = useId();

  const pick = (kind: TileKind): void => {
    const seeded = seedPattern(kind, color, size);
    onChange(value.transform ? { ...seeded, transform: value.transform } : seeded);
  };

  const resize = (nextSize: number): void => {
    if (!tile) return;
    onChange({ ...tile, size: nextSize });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      <div className={s.grid}>
        {TILE_KINDS.map((kind) => {
          const preview: TilePatternSpec = { ...seedTile(kind, color), size: PREVIEW_SIZE };
          const selected = tile?.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              className={[s.swatch, selected && s.swatchActive].filter(Boolean).join(' ')}
              style={{ ['--tile-preview' as string]: tilePreviewCssUrl(preview) } as CSSProperties}
              title={kind}
              aria-label={kind}
              aria-pressed={selected}
              onClick={() => pick(kind)}
            />
          );
        })}
      </div>
      <ToggleBar<number>
        items={TILE_SIZES}
        value={size}
        size="sm"
        ariaLabel="Tile size"
        onChange={(v) => v != null && resize(v)}
      />
      <div className={`${f.field} ${f.control} ${f.fit} ${f.row}`}>
        <label className={f.label} htmlFor={rotationId}>Rotation</label>
        <UnitField
          id={rotationId}
          width="fit"
          steppers
          value={toDegrees(decomposePatternTransform(value.transform).rotation)}
          step={15}
          display={DEGREES}
          onChange={(deg) => onChange(withRotation(value, deg))}
        />
      </div>
    </div>
  );
}

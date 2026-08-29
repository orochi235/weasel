import type { ReactElement } from 'react';
import type { CSSProperties } from 'react';
import type { FillStyle, TilePatternSpec } from '@weasel-js/core';
import { tilePreviewCssUrl } from '@weasel-js/svg';
import { ToggleBar } from '../ToggleBar';
import s from './PatternPicker.module.css';

/** The `pattern` member of the paint union. */
export type PatternFill = Extract<FillStyle, { fill: 'pattern' }>;

const TILES: readonly TilePatternSpec['tile'][] = ['hatch', 'crosshatch', 'dots', 'chunks'];

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

/** The spec a pattern paint carries, if it carries one. A consumer-built
 *  `TextureHandle` has no spec, so the picker shows no tile selected and
 *  replaces it wholesale on the next click. */
function specOf(fill: PatternFill): TilePatternSpec | null {
  return 'tile' in fill.pattern ? fill.pattern : null;
}

/**
 * A pattern seeded from a color. `units: 'bounds'` anchors the tile to the
 * node's box, so the texture travels with the shape.
 */
export function seedPattern(
  tile: TilePatternSpec['tile'],
  from: string,
  size: number = DEFAULT_TILE_SIZE,
): PatternFill {
  const spec: TilePatternSpec = { tile, color: from, size };
  // `chunks` is a scatter over a ground rather than a line texture; without a
  // background it reads as loose specks on whatever sits beneath.
  if (tile === 'chunks') spec.bg = '#00000000';
  return { fill: 'pattern', pattern: spec, units: 'bounds' };
}

/** Props for {@link PatternPicker}. */
export interface PatternPickerProps {
  /** The pattern paint being edited. */
  value: PatternFill;
  /** The color new tiles are seeded with — the paint's own, normally. */
  color: string;
  /** Committed value: one call per click. A tile pick and a size change are
   *  each a complete gesture, so there is no `onInput`. */
  onChange: (next: PatternFill) => void;
  className?: string;
}

/**
 * Grid of tile swatches over a size switch, each swatch previewing the real
 * tile at the current color.
 *
 * The preview shares its shape mapper with what the renderer paints, so a
 * swatch cannot drift from the texture it selects.
 */
export function PatternPicker(props: PatternPickerProps): ReactElement {
  const { value, color, onChange, className } = props;
  const spec = specOf(value);
  const size = spec?.size ?? DEFAULT_TILE_SIZE;

  const pick = (tile: TilePatternSpec['tile']): void => {
    onChange(seedPattern(tile, color, size));
  };

  const resize = (nextSize: number): void => {
    if (!spec) return;
    onChange({ ...value, pattern: { ...spec, size: nextSize } });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      <div className={s.grid}>
        {TILES.map((tile) => {
          const preview: TilePatternSpec = { tile, color, size: PREVIEW_SIZE };
          if (tile === 'chunks') preview.bg = '#00000000';
          const selected = spec?.tile === tile;
          return (
            <button
              key={tile}
              type="button"
              className={[s.swatch, selected && s.swatchActive].filter(Boolean).join(' ')}
              style={{ ['--tile-preview' as string]: tilePreviewCssUrl(preview) } as CSSProperties}
              title={tile}
              aria-label={tile}
              aria-pressed={selected}
              onClick={() => pick(tile)}
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
    </div>
  );
}

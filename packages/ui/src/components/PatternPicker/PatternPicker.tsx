import { useId, useRef, type ChangeEvent, type CSSProperties, type ReactElement } from 'react';
import {
  composePatternTransform,
  decomposePatternTransform,
  isImagePatternPaint,
  isTilePaint,
  seedTile,
  TILE_KINDS,
  type ImagePatternPaint,
  type PatternPaint,
  type TileKind,
  type TilePaint,
  type TilePatternSpec,
} from '@weasel-js/core';
import { RAD_TO_DEG, wrapAngle } from '@weasel-js/geom';
import { unit } from '@weasel-js/quantity';
import { tilePreviewCssUrl } from '@weasel-js/svg';
import { Icon } from '../../icons';
import { icon } from '../../icons.gen';
import { UnitField } from '../NumberField';
import { ToggleBar } from '../ToggleBar';
import f from '../field.module.css';
import { readImageFile, type ReadImage } from './readImageFile';
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

/** An image tile's longest side at each size step. A picture needs more room
 *  than a line texture to read as itself. */
const IMAGE_TILE_SIZES: readonly { value: number; label: string }[] = [
  { value: 32, label: 'S' },
  { value: 64, label: 'M' },
  { value: 128, label: 'L' },
  { value: 256, label: 'XL' },
];

const DEFAULT_IMAGE_TILE_SIZE = 128;

/** Every swatch previews at one size so the grid compares tiles, not scales. */
const PREVIEW_SIZE = 16;

const DEGREES = unit('°', { places: 1 });

/** Rotation in degrees, folded into (-180, 180]. */
function toDegrees(rad: number): number {
  return wrapAngle(rad) * RAD_TO_DEG;
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

/**
 * An image paint of `image`, its tile scaled so the longest side is `longest`
 * units with the picture's own proportions. `units: 'bounds'` anchors it to
 * the node's box, as a seeded tile is.
 */
export function seedImagePattern(
  image: ReadImage,
  longest: number = DEFAULT_IMAGE_TILE_SIZE,
): ImagePatternPaint {
  return { kind: 'image', src: image.src, units: 'bounds', ...imageExtent(image, longest) };
}

function imageExtent(size: { width: number; height: number }, longest: number): { width: number; height: number } {
  const k = longest / Math.max(size.width, size.height, Number.MIN_VALUE);
  return { width: size.width * k, height: size.height * k };
}

/** Props for {@link PatternPicker}. */
export interface PatternPickerProps {
  /** The pattern paint being edited. */
  value: PatternPaint;
  /** The color new tiles are seeded with — the paint's own, normally. */
  color: string;
  /** Committed value: one call per click. A tile pick, an image upload, a
   *  size change and a committed rotation are each a complete gesture, so
   *  there is no `onInput`. */
  onChange: (next: PatternPaint) => void;
  className?: string;
  /** Turn a picked file into the stored image. Defaults to embedding it as a
   *  `data:` URI, downscaled; a consumer storing images elsewhere returns a
   *  URL of its own here. */
  readImage?: (file: File) => Promise<ReadImage>;
}

/**
 * Grid of tile swatches over a size switch and a rotation field, each swatch
 * previewing the real tile at the current color. The last swatch uploads an
 * image to tile, and previews the one in use. Rotation edits only the
 * rotation part of the paint's `transform`; scale and skew survive it.
 *
 * The preview shares its shape mapper with what the renderer paints, so a
 * swatch cannot drift from the texture it selects.
 */
export function PatternPicker(props: PatternPickerProps): ReactElement {
  const { value, color, onChange, className, readImage = readImageFile } = props;
  // A `texture` paint names no tile, so the picker shows none selected and
  // replaces it wholesale on the next click.
  const tile = isTilePaint(value) ? value : null;
  const image = isImagePatternPaint(value) ? value : null;
  const size = tile?.size ?? DEFAULT_TILE_SIZE;
  const rotationId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const withTransform = (next: PatternPaint): PatternPaint =>
    (value.transform ? { ...next, transform: value.transform } : next);

  const pick = (kind: TileKind): void => {
    onChange(withTransform(seedPattern(kind, color, size)));
  };

  const upload = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    readImage(file).then(
      (read) => onChange(withTransform(seedImagePattern(read))),
      (err: unknown) => console.warn(`weasel PatternPicker: "${file.name}" could not be read as an image`, err),
    );
  };

  const resize = (nextSize: number): void => {
    if (tile) onChange({ ...tile, size: nextSize });
    else if (image) onChange({ ...image, ...imageExtent(imageSize(image), nextSize) });
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
        <button
          type="button"
          className={[s.swatch, s.imageSwatch, image && s.swatchActive].filter(Boolean).join(' ')}
          style={image ? { ['--tile-preview' as string]: `url(${JSON.stringify(image.src)})` } as CSSProperties : undefined}
          title="Upload an image to tile"
          aria-label="image"
          aria-pressed={image !== null}
          onClick={() => fileInput.current?.click()}
        >
          {image ? null : <Icon name={icon('add')} size={14} />}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className={s.fileInput}
          tabIndex={-1}
          aria-hidden
          data-testid="pattern-image-file"
          onChange={upload}
        />
      </div>
      <ToggleBar<number>
        items={image ? IMAGE_TILE_SIZES : TILE_SIZES}
        value={image ? longestSide(image) : size}
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

function longestSide(paint: ImagePatternPaint): number {
  const { width, height } = imageSize(paint);
  return Math.round(Math.max(width, height));
}

/** An image paint's tile extent. Both sides are written on upload; a paint
 *  from elsewhere missing one is treated as square. */
function imageSize(paint: ImagePatternPaint): { width: number; height: number } {
  const w = paint.width ?? paint.height ?? DEFAULT_IMAGE_TILE_SIZE;
  const h = paint.height ?? paint.width ?? DEFAULT_IMAGE_TILE_SIZE;
  return { width: w, height: h };
}

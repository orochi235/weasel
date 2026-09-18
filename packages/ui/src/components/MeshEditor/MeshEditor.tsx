import { type ReactElement } from 'react';
import {
  asPaint,
  isMeshGradientFill,
  type ColorSpace,
  type FillStyle,
  type MeshGradientFill,
} from '@weasel-js/core';
import { ColorField } from '../ColorField';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import { paintPreviewCss } from '../../paintPreview';
import s from './MeshEditor.module.css';

const SPACES: readonly ToggleBarItem<ColorSpace>[] = [
  { value: 'rgb', label: 'sRGB' },
  { value: 'oklab', label: 'OKLab' },
  { value: 'oklch', label: 'OKLCh' },
];

/** Props for {@link MeshEditor}. `onInput` fires throughout a gesture and
 *  `onChange` once at its end. */
export interface MeshEditorProps {
  value: MeshGradientFill;
  /** Emitted as a `FillStyle`, which is what every paint control passes
   *  around — `FillStyle`'s discriminant stays closed over the built-in
   *  members, so a registered kind's own shape only travels through it. */
  onInput?: (next: FillStyle) => void;
  onChange: (next: FillStyle) => void;
  /** Show the sRGB / OKLab / OKLCh switch. Default true. */
  spaceSwitch?: boolean;
  className?: string;
}

/**
 * Editor for a mesh gradient's colors.
 *
 * Geometry is absent for the same reason it is absent from `GradientEditor`:
 * a patch's twelve control points are a thing to drag on the artwork, not a
 * column of numbers in a panel. What is left is what a panel is good at — the
 * color at each corner, and the space the four of them blend through.
 *
 * Corners are numbered in the patch's own walk order, which is the order the
 * paint stores them in, so a corner's number is stable while it is dragged.
 */
export function MeshEditor(props: MeshEditorProps): ReactElement {
  const { value, onInput, onChange, spaceSwitch = true, className } = props;
  const space = value.interpolate ?? 'rgb';

  const withCorner = (patchIndex: number, corner: number, color: string): FillStyle => asPaint({
    ...value,
    patches: value.patches.map((patch, i) => {
      if (i !== patchIndex) return patch;
      const [a, b, c, d] = patch.colors;
      const next: [string, string, string, string] = [a, b, c, d];
      next[corner] = color;
      return { ...patch, colors: next };
    }),
  });

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      {value.patches.map((patch, patchIndex) => (
        // A patch has no id; its position in the list is its identity, the way
        // a gradient stop's is.
        <div key={patchIndex} className={s.patch}>
          <span
            className={s.preview}
            aria-hidden="true"
            style={{ background: previewOf(value, patchIndex) }}
          />
          <div className={s.corners}>
            {patch.colors.map((color, corner) => (
              <ColorField
                key={corner}
                value={color}
                alpha
                aria-label={`Patch ${patchIndex + 1} corner ${corner + 1}`}
                className={s.corner}
                onInput={(next) => onInput?.(withCorner(patchIndex, corner, next))}
                onChange={(next) => onChange(withCorner(patchIndex, corner, next))}
              />
            ))}
          </div>
        </div>
      ))}

      {spaceSwitch && (
        <ToggleBar<ColorSpace>
          items={SPACES}
          value={space}
          size="sm"
          ariaLabel="Blend space"
          onChange={(next) => next && onChange(asPaint({ ...value, interpolate: next }))}
        />
      )}
    </div>
  );
}

/** One patch as a swatch: the paint with the other patches taken out, so a
 *  multi-patch mesh shows which row belongs to which part of it. */
function previewOf(value: MeshGradientFill, patchIndex: number): string | undefined {
  return paintPreviewCss(
    { ...value, patches: [value.patches[patchIndex]] } as unknown as FillStyle,
  );
}

/** Narrowing for a consumer rendering this behind a kind switch. */
export function isMeshPaint(fill: FillStyle | null | undefined): fill is FillStyle & MeshGradientFill {
  return isMeshGradientFill(fill);
}

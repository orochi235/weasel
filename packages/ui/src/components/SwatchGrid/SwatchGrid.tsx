import { useRef, type ReactElement, type ReactNode } from 'react';
import type { RunAlign } from '@weasel-js/geom';
import { useTrackShape } from '../Along/alongContext';
import { SwatchButton, swatchesIn, swatchId, swatchKeyDown, useSwatchApply, useSwatchStop, type SwatchChange } from './SwatchButton';
import { tiling } from '../../tiling';
import { SwatchRings } from './SwatchRings';
import s from './SwatchGrid.module.css';

/** One swatch. `value: null` is the "no paint" swatch. */
export interface SwatchGridOption {
  /** The swatch's paint, a CSS color. */
  value: string | null;
  /** What tells this swatch apart: the key a palette's `value` names and its `onChange` hands back. Give one where
   *  two swatches share a color. Default: `value`. */
  id?: string;
  /** Accessible name and tooltip. Defaults to the value, or "None". */
  label?: string;
  /** Drawn centered over the paint: a letter, an icon. Only seen; the label is what is heard. */
  glyph?: ReactNode;
  /** The glyph's color. Default: the text color around the palette. */
  ink?: string;
}

/** Props for {@link SwatchGrid}. */
export interface SwatchGridProps {
  options: readonly SwatchGridOption[];
  /** The id of the swatch to mark current, if any matches: its color unless it names an `id`. */
  value?: string | null;
  /** A click, Enter or Space on a swatch, with its id and the swatch. */
  onChange: SwatchChange;
  /** The alternate target — shift-click, right-click (the browser menu is
   *  suppressed) and Shift+Enter. Drawing apps route this to the slot that
   *  isn't focused: click for fill, shift-click for stroke. */
  onAltChange?: SwatchChange;
  /** Swatches per row; also the step for ArrowUp/ArrowDown. Default 6. */
  columns?: number;
  /** Where the last row sits in a grid when it is shorter than the rest. Default: the nearest `Along`'s, else
   *  `'start'`. On a ring the `Along`'s own decides. */
  align?: RunAlign;
  'aria-label'?: string;
  className?: string;
}

/**
 * A palette: a grid of color swatches that apply on click. Keyboard focus
 * roves — one tab stop, on the current swatch, with the arrows moving by one
 * across and by a row up and down.
 *
 * The grid applies nothing itself. `onChange` and `onAltChange` hand the
 * swatch to the app, which decides what "apply" means: set its active paint,
 * write the selection through `useOngoingAction`'s `commit`, or both.
 *
 * Inside a curved `Along`, each row lies on a ring of its
 * own, row k shifted k rows in toward the shape's center of curvature, the
 * way a color wheel's rim reads. There each arrow moves to the neighbor
 * along the ring or on the next ring in or out that lies its way on screen.
 */
export function SwatchGrid(props: SwatchGridProps): ReactElement {
  const along = useTrackShape();
  if (along !== null && along.shape.kind !== 'line') {
    const { options, value, columns = 6, onChange, onAltChange, className } = props;
    return (
      <SwatchRings
        shape={along.shape}
        align={along.align}
        onChange={onChange}
        onAltChange={onAltChange}
        groups={[{ key: 'grid', label: props['aria-label'], options, value, columns, className }]}
      />
    );
  }
  return <SwatchGridLine {...props} align={props.align ?? along?.align ?? 'start'} />;
}

function SwatchGridLine(props: SwatchGridProps): ReactElement {
  const { options, value, className } = props;
  const apply = useSwatchApply(props.onChange, props.onAltChange);
  const columns = props.columns ?? 6;
  const lastRow = props.align ?? 'start';
  const tiles = tiling(options.length, { columns, lastRow });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = value === undefined ? -1 : options.findIndex((o) => swatchId(o) === value);
  const tab = useSwatchStop(current, options.length);
  const swatches = () => swatchesIn(rootRef.current);

  return (
    <div
      ref={rootRef}
      className={[s.grid, tiles.className, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label']}
      style={tiles.style}
      onBlur={tab.onBlur}
    >
      {options.map((o, i) => (
        <SwatchButton
          key={swatchId(o) ?? `none-${i}`}
          option={o}
          tabStop={i === tab.stop}
          current={i === current}
          apply={apply}
          onKeyDown={swatchKeyDown(i, options, columns, apply, swatches, lastRow)}
          onFocus={() => tab.focused(i)}
          data={tiles.item(i)}
        />
      ))}
    </div>
  );
}

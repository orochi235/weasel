import { useRef, type CSSProperties, type ReactElement } from 'react';
import type { RunAlign, TrackShape } from '@weasel-js/geom';
import { useTrackShape } from '../Along/alongContext';
import { rowLead, SwatchButton, swatchesIn, swatchKeyDown, useSwatchApply } from './SwatchButton';
import { SwatchRings } from './SwatchRings';
import s from './SwatchGrid.module.css';

/** One swatch. `value: null` is the "no paint" swatch. */
export interface SwatchGridOption {
  value: string | null;
  /** Accessible name and tooltip. Defaults to the value, or "None". */
  label?: string;
}

/** Props for {@link SwatchGrid}. */
export interface SwatchGridProps {
  options: readonly SwatchGridOption[];
  /** The swatch to mark current, if any matches. */
  value?: string | null;
  /** A click, Enter or Space on a swatch. */
  onChange: (value: string | null) => void;
  /** The alternate target — shift-click, right-click (the browser menu is
   *  suppressed) and Shift+Enter. Drawing apps route this to the slot that
   *  isn't focused: click for fill, shift-click for stroke. */
  onAltChange?: (value: string | null) => void;
  /** Swatches per row; also the step for ArrowUp/ArrowDown. Default 6. */
  columns?: number;
  /** A track shape to lay the rows along. A curved one lays each row on a ring of its own, row k shifted k rows in
   *  toward the shape's center of curvature; a line keeps the grid. Default: the nearest `Along`'s shape, else none. */
  shape?: TrackShape;
  /** Where a row shorter than its run sits: a ring on a curved shape, the last row in a grid. Default: the nearest
   *  `Along`'s, else `'center'` on a ring and `'start'` in a grid. */
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
 * color to the app, which decides what "apply" means: set its active paint,
 * write the selection through `useOngoingAction`'s `commit`, or both.
 *
 * Given a curved shape, or inside an `Along`, each row lies on a ring of its
 * own, row k shifted k rows in toward the shape's center of curvature, the
 * way a color wheel's rim reads. There each arrow moves to the neighbor
 * along the ring or on the next ring in or out that lies its way on screen.
 */
export function SwatchGrid(props: SwatchGridProps): ReactElement {
  const along = useTrackShape();
  const shape = props.shape ?? along?.shape;
  if (shape !== undefined && shape.kind !== 'line') {
    const { options, value, columns = 6, onChange, onAltChange, className } = props;
    return (
      <SwatchRings
        shape={shape}
        align={props.align ?? along?.align ?? 'center'}
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
  const lead = rowLead(options.length, columns, props.align ?? 'start');
  const lastStart = options.length - (options.length % columns || columns);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = value === undefined ? -1 : options.findIndex((o) => o.value === value);
  const tabStop = current >= 0 ? current : 0;
  const swatches = () => swatchesIn(rootRef.current);

  return (
    <div
      ref={rootRef}
      className={[s.grid, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label']}
      style={{ '--tracks': 2 * columns, '--lead': lead } as CSSProperties}
    >
      {options.map((o, i) => (
        <SwatchButton
          key={o.value ?? `none-${i}`}
          option={o}
          tabStop={i === tabStop}
          current={i === current}
          apply={apply}
          onKeyDown={swatchKeyDown(i, options, columns, apply, swatches, lead)}
          data={{ 'data-row-lead': i === lastStart && lead > 0 ? '' : undefined }}
        />
      ))}
    </div>
  );
}

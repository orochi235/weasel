import { useRef, type ReactElement, type ReactNode } from 'react';
import type { RunAlign } from '@weasel-js/geom';
import { useRun } from '../Run';
import type { HoldProps } from '../Disabled';
import { ownHold, useControlHold } from '../Disabled/controlHold';
import {
  heldApply, SwatchButton, swatchesIn, swatchId, swatchKeyDown, swatchMarks, useSwatchApply, useSwatchStop, type SwatchSelect, type SwatchValue,
} from './SwatchButton';
import { tiling } from '../../tiling';
import { SwatchRings } from './SwatchRings';
import s from './SwatchGrid.module.css';

/** One swatch. `value: null` is the "no paint" swatch. */
export interface SwatchGridOption {
  /** The swatch's paint, a CSS color. */
  value: string | null;
  /** What tells this swatch apart: the key a palette's `value` names and its `onSelect` hands back. Give one where
   *  two swatches share a color. Default: `value`. */
  id?: string;
  /** Accessible name and tooltip. Defaults to the value, or "None". */
  label?: string;
  /** Drawn centered over the paint: a letter, an icon. Only seen; the label is what is heard. */
  glyph?: ReactNode;
  /** The glyph's color. Default: the text color around the palette. */
  ink?: string;
  /** The swatch applies nothing. It stays reachable by the arrows, so its reason can be read. */
  disabled?: boolean;
  /** Why it is disabled: its tooltip and description while `disabled`. */
  disabledReason?: string;
}

/** Props for {@link SwatchGrid}. Disabled or read-only, its swatches apply nothing; the arrows still move among them
 *  unless it is disabled with no reason, which takes it out of the tab order. */
export interface SwatchGridProps extends HoldProps {
  options: readonly SwatchGridOption[];
  /** The id of the swatch to mark current, if any matches: its color unless it names an `id`. A list of ids makes
   *  every swatch a toggle, pressed while its id is listed, as a set of pinned colors is; a click hands the swatch
   *  back either way, for the app to add or take out. */
  value?: SwatchValue;
  /** A click, Enter or Space on a swatch, with its id and the swatch. */
  onSelect: SwatchSelect;
  /** The alternate target — shift-click, right-click (the browser menu is
   *  suppressed) and Shift+Enter. Drawing apps route this to the slot that
   *  isn't focused: click for fill, shift-click for stroke. */
  onAltSelect?: SwatchSelect;
  /** The swatch under the pointer or holding focus, and `null` as the pointer leaves or focus goes: for a readout
   *  naming it. */
  onHoverChange?: (option: SwatchGridOption | null) => void;
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
 * The grid applies nothing itself. `onSelect` and `onAltSelect` hand the
 * swatch to the app, which decides what "apply" means: set its active paint,
 * write the selection through `useOngoingAction`'s `commit`, or both.
 *
 * Inside a curved `Along`, each row lies on a ring of its
 * own, row k shifted k rows in toward the shape's center of curvature, the
 * way a color wheel's rim reads. There each arrow moves to the neighbor
 * along the ring or on the next ring in or out that lies its way on screen.
 */
export function SwatchGrid(props: SwatchGridProps): ReactElement {
  const run = useRun();
  if (run.shape !== undefined && run.shape.kind !== 'line') {
    const { options, value, columns = 6, onSelect, onAltSelect, onHoverChange, className } = props;
    return (
      <SwatchRings
        {...ownHold(props)}
        shape={run.shape}
        align={run.align ?? 'center'}
        onSelect={onSelect}
        onAltSelect={onAltSelect}
        onHoverChange={onHoverChange}
        groups={[{ key: 'grid', label: props['aria-label'], options, value, columns, className }]}
      />
    );
  }
  return <SwatchGridLine {...props} align={props.align ?? run.align ?? 'start'} />;
}

function SwatchGridLine(props: SwatchGridProps): ReactElement {
  const { options, value, className, onHoverChange: hover } = props;
  const hold = useControlHold(props);
  const apply = heldApply(useSwatchApply(props.onSelect, props.onAltSelect), hold);
  const columns = props.columns ?? 6;
  const lastRow = props.align ?? 'start';
  const tiles = tiling(options.length, { columns, lastRow });
  const rootRef = useRef<HTMLDivElement | null>(null);

  const marks = swatchMarks(options, value);
  const tab = useSwatchStop(marks.first, options.length);
  const swatches = () => swatchesIn(rootRef.current);

  return hold.wrap(
    <div
      ref={rootRef}
      className={[s.grid, tiles.className, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label']}
      style={tiles.style}
      data-held={hold.held}
      onBlur={(e) => {
        tab.onBlur(e);
        if (hover && !e.currentTarget.contains(e.relatedTarget as Node | null)) hover(null);
      }}
      onPointerLeave={hover && (() => hover(null))}
    >
      {options.map((o, i) => (
        <SwatchButton
          key={swatchId(o) ?? `none-${i}`}
          option={o}
          tabStop={!hold.unreachable && i === tab.stop}
          current={marks.marked(i)}
          toggle={marks.toggles}
          apply={apply}
          {...hold.focus}
          onKeyDown={swatchKeyDown(i, options, columns, apply, swatches, lastRow)}
          onFocus={() => {
            tab.focused(i);
            hover?.(o);
          }}
          onPointerEnter={hover && (() => hover(o))}
          {...tiles.item(i)}
        />
      ))}
    </div>
  );
}

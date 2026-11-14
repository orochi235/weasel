import { type ReactElement, type ReactNode } from 'react';
import { selection, type MultipleSelection, type SingleSelection } from '@weasel-js/ui-input';
import { SegmentSweeper, SWEEP_INDEX_ATTR, useSweepGuard, type SegmentSweep } from '../segmentSweep';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps, useSegmentedTiling, type SegmentedGridProps } from '../segmentedRow';
import { tilingRoving } from '../../tiling';
import { selectionRoving } from '../../selectionRoving';
import type { SegmentedVariant } from '../segmentedVariant';
import type { ControlSize } from '../Density';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';
import type { Orientation } from '../orientation';

/** One segment of a {@link ToggleBar}, identified by its `value`. */
export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  /** Why it is disabled. Given, a disabled one keeps its tooltip, which reads the reason after its name, stays
   *  focusable, and gives the reason to assistive tech as its description; without one it is natively disabled. */
  disabledReason?: string;
} & SegmentTooltipFields;

/** Visual treatment of a {@link ToggleBar}. */
export type ToggleBarVariant = SegmentedVariant;

/** What a {@link ToggleBar} takes whichever selection mode it is in. */
export type ToggleBarCommonProps = SegmentedGridProps & {
  'aria-label'?: string;
  className?: string;
  height?: number;
  /** Size variant. `sm` is ~60% of the default height with reduced padding
   *  and font size — sized for dense surfaces like lab control panels.
   *  Default: the nearest `Density` scope's, else `md`. */
  size?: ControlSize;
  /** Which way the segments run. Defaults to the way the row the bar sits in runs; a vertical bar keeps its labels upright. */
  orientation?: Orientation;
  /** Visual variant. `minimal` strips the pill track and glass treatment;
   *  selection becomes a flat accent. For dense diagnostic surfaces. */
  variant?: ToggleBarVariant;
};

/**
 * Props for {@link ToggleBar}, discriminated on `mode`: one value or `null` (`'single'`, the default), or a list of
 * them (`'multiple'`). Either takes `mixedValues`; see {@link SingleSelection} and {@link MultipleSelection}.
 */
export type ToggleBarProps<V extends string | number = string> =
  | (ToggleBarCommonProps & { items: readonly ToggleBarItem<V>[] } & SingleSelection<V>)
  | (ToggleBarCommonProps & { items: readonly ToggleBarItem<V>[] } & MultipleSelection<V> & {
      /**
       * Let a drag across the segments toggle every one it reaches: the press
       * decides on or off (on, unless the pressed segment is on) and each
       * segment swept is set to that, with `onChange` called as each one
       * changes. Escape or a lost pointer puts `value` back. `true` sweeps
       * from any segment; a function decides per press. A segment that runs
       * a drag of its own takes the press instead.
       */
      sweep?: SegmentSweep<NoInfer<V>>;
    });

/**
 * Segmented control for choosing among a fixed set of values — one of them
 * (`mode: 'single'`, the default) or any number (`mode: 'multiple'`).
 *
 * Single mode ignores a click on the already-selected segment unless
 * `allowDeselect` is set, and its arrow keys move the selection with the
 * focus, as a radio group's do; `followsFocus: false` makes its segments
 * toggle buttons whose arrows only move focus, the way multiple mode's do,
 * with Space and Enter pressing the focused segment. Selection is ui-input's
 * `selection` model.
 */
export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement {
  const { items, 'aria-label': ariaLabel, className, height, size, variant, orientation } = props;
  const values = items.map((it) => it.value);
  const model = selection<V>(props, values);
  const usable = (i: number): boolean => items[i] !== undefined && !items[i].disabled;
  // Radios choose as the arrows move; segments that only take focus are toggle buttons.
  const radios = model.mode === 'single' && model.followsFocus;
  const sweep = props.mode === 'multiple' ? props.sweep : undefined;
  const guard = useSweepGuard();

  const press = (i: number) => () => {
    if (usable(i) && !guard.sweeping()) model.press(i);
  };

  const tiles = useSegmentedTiling(props);
  const roving = useRovingTabIndex({
    itemSelector: `.${s.segment}`,
    ...(tiles ? tilingRoving(tiles) : {}),
    ...selectionRoving(model, items.length, usable),
  });

  // Segment labels drawn as `FitLabel`s shorten together when the bar is
  // squeezed or will not fit where it sits.
  const fit = useFitScope(roving.rootRef);

  const row = (
    <SegmentedRow
      roving={roving}
      role={radios ? 'radiogroup' : 'group'}
      ariaLabel={ariaLabel}
      className={className}
      tiling={tiles}
      height={height}
      size={size}
      variant={variant}
      orientation={orientation}
      wrap={(segments) => <FitScope value={fit}>{segments}</FitScope>}
      segments={items.map((item, i) => {
        const state = model.stateOf(i);
        return {
          key: String(item.value),
          state,
          draw: (place) => (
            <SegmentTooltip content={segmentTooltipContent(item)} disabled={item.disabled} disabledReason={item.disabledReason}>
              <button
                type="button"
                role={radios ? 'radio' : undefined}
                aria-checked={radios ? state === 'on' : undefined}
                aria-pressed={radios ? undefined : state === 'mixed' ? 'mixed' : state === 'on'}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={segmentClassName(state, place)}
                {...segmentPlaceProps(place)}
                {...(sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}
                onClick={press(i)}
              >
                {item.label}
              </button>
            </SegmentTooltip>
          ),
        };
      })}
    />
  );
  if (!sweep) return row;
  return (
    <>
      {row}
      <SegmentSweeper rootRef={roving.rootRef} values={values} sweepable={usable} model={model} sweep={sweep} swept={guard.swept} />
    </>
  );
}

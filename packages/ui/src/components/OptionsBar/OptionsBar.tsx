import { type ReactElement, type ReactNode } from 'react';
import { selectionOfEach, type OwnSelection } from '@weasel-js/ui-input';
import { SegmentSweeper, SWEEP_INDEX_ATTR, useSweepGuard, type SegmentSweep } from '../segmentSweep';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps, useSegmentedTiling, type SegmentedGridProps } from '../segmentedRow';
import { tilingRoving } from '../../tiling';
import type { SegmentedVariant } from '../segmentedVariant';
import type { ControlSize } from '../Density';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { selectionRoving } from '../../selectionRoving';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';
import type { Orientation } from '../Run';

/**
 * One segment of an {@link OptionsBar}. Unlike `ToggleBar`, each item carries
 * its own selected state and its own `onChange`.
 */
export type OptionsBarItem<V extends string | number = string> = OwnSelection & {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  /** Why it is disabled. Given, a disabled one keeps its tooltip, which reads the reason after its name, stays
   *  focusable, and gives the reason to assistive tech as its description; without one it is natively disabled. */
  disabledReason?: string;
} & SegmentTooltipFields;

/** Visual treatment of an {@link OptionsBar}. */
export type OptionsBarVariant = SegmentedVariant;

/** Props for {@link OptionsBar}. */
export type OptionsBarProps<V extends string | number = string> = SegmentedGridProps & {
  items: readonly OptionsBarItem<V>[];
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
  variant?: OptionsBarVariant;
  /** Let a drag across the segments set every one it reaches to what the press set the pressed one to, calling
   *  each one's `onChange` as it changes. Escape or a lost pointer puts them back. `true` sweeps from any
   *  segment; a function decides per press. */
  sweep?: SegmentSweep<NoInfer<V>>;
};

/**
 * Segmented strip of independent on/off options, each owning its own state.
 * Use it when the segments are unrelated booleans; use `ToggleBar` when they
 * are values of one setting.
 */
export function OptionsBar<V extends string | number = string>(props: OptionsBarProps<V>): ReactElement {
  const { items, 'aria-label': ariaLabel, className, height, size, variant, orientation } = props;

  const model = selectionOfEach(items);
  const usable = (i: number): boolean => items[i] !== undefined && !items[i].disabled;
  const { sweep } = props;
  const guard = useSweepGuard();
  const toggle = (i: number) => {
    if (usable(i) && !guard.sweeping()) model.press(i);
  };

  const tiles = useSegmentedTiling(props);
  const roving = useRovingTabIndex({
    itemSelector: `.${s.segment}`,
    ...(tiles ? tilingRoving(tiles) : {}),
    ...selectionRoving(model, items.length, usable),
  });
  const fit = useFitScope(roving.rootRef);

  const row = (
    <SegmentedRow
      roving={roving}
      role="group"
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
                aria-pressed={item.selected}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={segmentClassName(state, place)}
                {...segmentPlaceProps(place)}
                {...(sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}
                onClick={() => toggle(i)}
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
      <SegmentSweeper rootRef={roving.rootRef} values={items.map((it) => it.value)} sweepable={usable} model={model} sweep={sweep} swept={guard.swept} />
    </>
  );
}

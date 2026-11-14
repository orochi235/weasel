import { type ReactElement, type ReactNode } from 'react';
import {
  selection,
  selectionOfEach,
  stepsOf,
  type MultipleSelection,
  type OwnSelection,
  type SelectionModel,
  type SingleSelection,
  type Sweep,
} from '@weasel-js/ui-input';
import { SegmentSweeper, SWEEP_INDEX_ATTR, useSweepGuard, type SegmentSweep } from './segmentSweep';
import s from './segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps, useSegmentedTiling, type SegmentedGridProps, type SegmentState } from './segmentedRow';
import type { SegmentedVariant } from './segmentedVariant';
import { tilingRoving } from '../../tiling';
import { selectionRoving } from '../../selectionRoving';
import type { ControlSize } from '../Density';
import { useRovingTabIndex, type UseRovingTabIndexOptions } from '../../useRovingTabIndex';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';
import type { Orientation } from '../Run';

/** What a press on a {@link SegmentedBar}'s segment does: choose one value (`'single'`), flip one of a list of
 *  values (`'multiple'`), flip a segment that owns its own state (`'each'`), or fire and select nothing
 *  (`'momentary'`). */
export type SegmentedMode = 'single' | 'multiple' | 'each' | 'momentary';

/** One segment of a {@link SegmentedBar}, identified by its `value`. */
export type SegmentedBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  /** Why it is disabled. Given, a disabled one keeps its tooltip, which reads the reason after its name, stays
   *  focusable, and gives the reason to assistive tech as its description; without one it is natively disabled. */
  disabledReason?: string;
} & SegmentTooltipFields;

/** A segment of an `'each'` bar: it carries its own on/off state and its own `onChange`. */
export type SegmentedEachItem<V extends string | number = string> = SegmentedBarItem<V> & OwnSelection;

/** A segment of a `'momentary'` bar. Its `onAction` fires on a press, in place of the bar's. */
export type SegmentedMomentaryItem<V extends string | number = string> = SegmentedBarItem<V> & { onAction?: () => void };

/** Where a bar's segments come from: a list of items, or every step of a `Sweep`, labeled by it. */
export type SegmentedSource<V extends string | number, I> =
  | { items: readonly I[]; steps?: never }
  | { /** One segment per step, walked by `stepsOf` as `Sequence` walks it. */ steps: Sweep<V>; items?: never };

/** What a {@link SegmentedBar} takes in every mode. */
export type SegmentedBarCommonProps = SegmentedGridProps & {
  'aria-label'?: string;
  className?: string;
  height?: number;
  /** Size variant. `sm` is ~60% of the default height with reduced padding and font size, for dense surfaces like
   *  lab control panels. Default: the nearest `Density` scope's, else `md`. */
  size?: ControlSize;
  /** Which way the segments run. Defaults to the way the row the bar sits in runs; a vertical bar keeps its labels upright. */
  orientation?: Orientation;
  /** `minimal` strips the pill track and glass treatment, and selection becomes a flat accent. */
  variant?: SegmentedVariant;
};

/** A drag across the segments sets every one it reaches to what the press set the pressed one to, each change
 *  reported as it happens. Escape or a lost pointer puts them back. `true` sweeps from any segment; a function
 *  decides per press. A segment that runs a drag of its own takes the press instead. */
type Sweepable<V> = { sweep?: SegmentSweep<NoInfer<V>> };

/**
 * Props for {@link SegmentedBar}, discriminated on `mode`:
 *
 * - `'single'` (the default): one value or `null`; see `SingleSelection`.
 * - `'multiple'`: a list of values; see `MultipleSelection`.
 * - `'each'`: items that each own a boolean, for unrelated on/off options.
 * - `'momentary'`: buttons that fire and stay unselected: each item's `onAction`, else the bar's.
 */
export type SegmentedBarProps<V extends string | number = string> =
  | (SegmentedBarCommonProps & SegmentedSource<V, SegmentedBarItem<V>> & SingleSelection<V>)
  | (SegmentedBarCommonProps & SegmentedSource<V, SegmentedBarItem<V>> & MultipleSelection<V> & Sweepable<V>)
  | (SegmentedBarCommonProps & { mode: 'each'; items: readonly SegmentedEachItem<V>[] } & Sweepable<V>)
  | (SegmentedBarCommonProps & SegmentedSource<V, SegmentedMomentaryItem<V>> & {
      mode: 'momentary';
      /** Called with the pressed segment's value, unless the item has an `onAction` of its own. */
      onAction?: (value: V) => void;
    });

/** The items `props` lists, or one per step of its `steps`. */
function itemsOf<V extends string | number>(props: SegmentedBarProps<V>): readonly SegmentedMomentaryItem<V>[] {
  if (props.items) return props.items;
  const sweep = (props as { steps: Sweep<V> }).steps;
  return stepsOf(sweep).steps.map((value) => ({ value, label: sweep.label(value) }));
}

/** How a bar's mode reads in its markup and its keys. */
interface Behavior {
  role: string;
  /** The ARIA a segment in `state` wears. */
  aria(state: SegmentState): Record<string, string | boolean | undefined>;
  press(index: number): void;
  keys: Pick<UseRovingTabIndexOptions, 'tabStopIndex' | 'onNavigate' | 'onActivate'>;
  /** The selection, for a mode that has one. */
  model?: SelectionModel;
}

function behaviorOf<V extends string | number>(
  props: SegmentedBarProps<V>,
  items: readonly SegmentedMomentaryItem<V>[],
  usable: (index: number) => boolean,
): Behavior {
  if (props.mode === 'momentary') {
    const fire = (i: number): void => {
      const item = items[i];
      if (item === undefined || item.disabled) return;
      if (item.onAction) item.onAction();
      else props.onAction?.(item.value);
    };
    return { role: 'toolbar', aria: () => ({}), press: fire, keys: { onActivate: fire } };
  }
  const model = props.mode === 'each' ? selectionOfEach(props.items) : selection<V>(props, items.map((it) => it.value));
  const keys = selectionRoving(model, items.length, usable);
  const press = (i: number): void => model.press(i);
  // Radios choose as the arrows move; segments that only take focus are toggle buttons.
  if (model.mode === 'single' && model.followsFocus) {
    return { role: 'radiogroup', aria: (state) => ({ role: 'radio', 'aria-checked': state === 'on' }), press, keys, model };
  }
  return { role: 'group', aria: (state) => ({ 'aria-pressed': state === 'mixed' ? 'mixed' : state === 'on' }), press, keys, model };
}

/**
 * A segmented row of buttons in one pill-shaped well, whose `mode` says what a press does (see
 * {@link SegmentedBarProps}). Its segments come from `items` or from the steps of a `Sweep`.
 *
 * In `'single'` mode a click on the segment that is on does nothing unless `allowDeselect` is set, and the arrow keys
 * move the selection with the focus, as a radio group's do; `followsFocus: false` makes its segments toggle buttons
 * whose arrows only move focus, as in `'multiple'` and `'each'`, with Space and Enter pressing the focused one.
 * A `'momentary'` bar is a toolbar of plain buttons; for buttons driven by the kit's actions registry, use
 * `ActionBar`.
 */
export function SegmentedBar<V extends string | number = string>(props: SegmentedBarProps<V>): ReactElement {
  const { 'aria-label': ariaLabel, className, height, size, variant, orientation } = props;
  const items = itemsOf(props);
  const usable = (i: number): boolean => items[i] !== undefined && !items[i].disabled;
  const behavior = behaviorOf(props, items, usable);
  const sweep = props.mode === 'multiple' || props.mode === 'each' ? props.sweep : undefined;
  const guard = useSweepGuard();
  const press = (i: number): void => {
    if (usable(i) && !guard.sweeping()) behavior.press(i);
  };

  const tiles = useSegmentedTiling(props);
  const roving = useRovingTabIndex({ itemSelector: `.${s.segment}`, ...(tiles ? tilingRoving(tiles) : {}), ...behavior.keys });
  // Segment labels drawn as `FitLabel`s shorten together when the bar is squeezed or will not fit where it sits.
  const fit = useFitScope(roving.rootRef);

  const row = (
    <SegmentedRow
      roving={roving}
      role={behavior.role}
      ariaLabel={ariaLabel}
      className={className}
      tiling={tiles}
      height={height}
      size={size}
      variant={variant}
      orientation={orientation}
      wrap={(segments) => <FitScope value={fit}>{segments}</FitScope>}
      segments={items.map((item, i) => {
        const state = behavior.model?.stateOf(i) ?? 'off';
        return {
          key: String(item.value),
          state,
          draw: (place) => (
            <SegmentTooltip content={segmentTooltipContent(item)} disabled={item.disabled} disabledReason={item.disabledReason}>
              <button
                type="button"
                {...behavior.aria(state)}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={segmentClassName(state, place)}
                {...segmentPlaceProps(place)}
                {...(sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}
                onClick={() => press(i)}
              >
                {item.label}
              </button>
            </SegmentTooltip>
          ),
        };
      })}
    />
  );
  if (!sweep || !behavior.model) return row;
  return (
    <>
      {row}
      <SegmentSweeper rootRef={roving.rootRef} values={items.map((it) => it.value)} sweepable={usable} model={behavior.model} sweep={sweep} swept={guard.swept} />
    </>
  );
}

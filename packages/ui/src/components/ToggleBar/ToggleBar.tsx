import { useRef, type ReactElement, type ReactNode } from 'react';
import { SWEEP_INDEX_ATTR, ToggleSweep, type ToggleBarSweep } from './ToggleSweep';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentedTiling, segmentPlaceProps, type SegmentedGridProps, type SegmentState } from '../segmentedRow';
import { tilingRoving } from '../../tiling';
import type { SegmentedSize, SegmentedVariant } from '../segmentedVariant';
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

/** Segment height and type scale for a {@link ToggleBar}. */
export type ToggleBarSize = SegmentedSize;
/** Visual treatment of a {@link ToggleBar}. */
export type ToggleBarVariant = SegmentedVariant;

/** What a {@link ToggleBar} takes whichever selection mode it is in. */
export type ToggleBarCommonProps = SegmentedGridProps & {
  ariaLabel?: string;
  className?: string;
  height?: number;
  /** Size variant. `sm` is ~60% of the default height with reduced padding
   *  and font size — sized for dense surfaces like lab control panels. */
  size?: ToggleBarSize;
  /** Which way the segments run. Defaults to the way the row the bar sits in runs; a vertical bar keeps its labels upright. */
  orientation?: Orientation;
  /** Visual variant. `minimal` strips the pill track and glass treatment;
   *  selection becomes a flat accent. For dense diagnostic surfaces. */
  variant?: ToggleBarVariant;
};

/**
 * Props for {@link ToggleBar}, discriminated on `mode`. Single mode is
 * controlled by one value or `null`; multiple mode by an array, and only it
 * accepts `mixedValues`.
 */
export type ToggleBarProps<V extends string | number = string> =
  | (ToggleBarCommonProps & {
      mode?: 'single';
      items: readonly ToggleBarItem<V>[];
      value: V | null;
      onChange: (next: V | null) => void;
      allowDeselect?: boolean;
    })
  | (ToggleBarCommonProps & {
      mode: 'multiple';
      items: readonly ToggleBarItem<V>[];
      value: readonly V[];
      /**
       * Values that are neither on nor off — the sources this bar
       * aggregates disagree (a text range that is bold in part of it, a
       * multi-selection whose nodes differ). Rendered `aria-pressed="mixed"`.
       * `value` wins where the two lists overlap. Clicking a mixed segment
       * turns it fully on.
       */
      mixedValues?: readonly V[];
      onChange: (next: V[]) => void;
      /**
       * Let a drag across the segments toggle every one it reaches: the press
       * decides on or off (on, unless the pressed segment is on) and each
       * segment swept is set to that, with `onChange` called as each one
       * changes. Escape or a lost pointer puts `value` back. `true` sweeps
       * from any segment; a function decides per press. A segment that runs
       * a drag of its own takes the press instead.
       */
      sweep?: ToggleBarSweep<NoInfer<V>>;
    });

/** Each value's segment state under `props`: on where `value` holds it, mixed where only `mixedValues` does (multiple
 *  mode alone takes it), else off. */
function segmentStates<V extends string | number>(props: ToggleBarProps<V>): (value: V) => SegmentState {
  if (props.mode !== 'multiple') return (value) => (props.value === value ? 'on' : 'off');
  const { value: on, mixedValues: mixed } = props;
  return (value) => (on.includes(value) ? 'on' : mixed?.includes(value) ? 'mixed' : 'off');
}

/**
 * Segmented control for choosing among a fixed set of values — one of them
 * (`mode: 'single'`, the default) or any number (`mode: 'multiple'`).
 *
 * Single mode ignores a click on the already-selected segment unless
 * `allowDeselect` is set, and its arrow keys move the selection with the
 * focus, as a radio group's do. In multiple mode the arrow keys only move
 * focus; Space and Enter flip the focused segment.
 */
export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant, orientation } = props;
  const mode = props.mode ?? 'single';

  const stateOf = segmentStates(props);
  const sweep = mode === 'multiple' ? (props as { sweep?: ToggleBarSweep<V> }).sweep : undefined;
  // Set as a sweep ends and cleared before the next task: the click its release makes is not a toggle.
  const justSwept = useRef(false);
  const swept = (): void => {
    justSwept.current = true;
    setTimeout(() => { justSwept.current = false; }, 0);
  };

  const handleClick = (index: number) => () => {
    const item = items[index];
    if (item.disabled || justSwept.current) return;
    if (mode === 'multiple') {
      const current = props.value as readonly V[];
      const next = current.includes(item.value)
        ? current.filter(v => v !== item.value)
        : [...current, item.value];
      (props.onChange as (n: V[]) => void)(next);
    } else {
      const current = props.value as V | null;
      if (current === item.value) {
        if ((props as { allowDeselect?: boolean }).allowDeselect) {
          (props.onChange as (n: V | null) => void)(null);
        }
        return;
      }
      (props.onChange as (n: V | null) => void)(item.value);
    }
  };

  const selectedIndex = mode === 'single'
    ? items.findIndex(it => it.value === (props.value as V | null))
    : -1;

  const tiles = segmentedTiling(props);
  const roving = useRovingTabIndex({
    itemSelector: `.${s.segment}`,
    ...(tiles ? tilingRoving(tiles) : {}),
    tabStopIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    onNavigate: mode === 'single'
      ? (index) => (props.onChange as (n: V | null) => void)(items[index].value)
      : undefined,
    onActivate: mode === 'multiple' ? (index) => handleClick(index)() : undefined,
  });

  // Segment labels drawn as `FitLabel`s shorten together when the bar is
  // squeezed or will not fit where it sits.
  const fit = useFitScope(roving.rootRef);

  const row = (
    <SegmentedRow
      roving={roving}
      role={mode === 'multiple' ? 'group' : 'radiogroup'}
      ariaLabel={ariaLabel}
      className={className}
      tiling={tiles}
      height={height}
      size={size}
      variant={variant}
      orientation={orientation}
      wrap={(segments) => <FitScope value={fit}>{segments}</FitScope>}
      segments={items.map((item, i) => {
        const state = stateOf(item.value);
        const selected = state === 'on';
        const mixed = state === 'mixed';
        return {
          key: String(item.value),
          state,
          draw: (place) => (
            <SegmentTooltip content={segmentTooltipContent(item)} disabled={item.disabled} disabledReason={item.disabledReason}>
              <button
                type="button"
                role={mode === 'multiple' ? undefined : 'radio'}
                aria-checked={mode === 'multiple' ? undefined : selected}
                aria-pressed={mode === 'multiple' ? (mixed ? 'mixed' : selected) : undefined}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={segmentClassName(state, place)}
                {...segmentPlaceProps(place)}
                {...(sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}
                onClick={handleClick(i)}
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
      <ToggleSweep
        rootRef={roving.rootRef}
        values={items.map((it) => it.value)}
        sweepable={(i) => items[i] !== undefined && !items[i].disabled}
        stateOf={(i) => stateOf(items[i]!.value)}
        value={props.value as readonly V[]}
        onChange={props.onChange as (next: V[]) => void}
        sweep={sweep}
        swept={swept}
      />
    </>
  );
}

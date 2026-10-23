import { type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps, type SegmentState } from '../segmentedRow';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';

/** One segment of a {@link ToggleBar}, identified by its `value`. */
export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
} & SegmentTooltipFields;

/** Segment height and type scale for a {@link ToggleBar}. */
export type ToggleBarSize = 'sm' | 'md';
/** Visual treatment of a {@link ToggleBar}. */
export type ToggleBarVariant = 'default' | 'minimal' | 'flat';

/** What a {@link ToggleBar} takes whichever selection mode it is in. */
export type ToggleBarCommonProps = {
  ariaLabel?: string;
  className?: string;
  height?: number;
  /** Size variant. `sm` is ~60% of the default height with reduced padding
   *  and font size — sized for dense surfaces like lab control panels. */
  size?: ToggleBarSize;
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
    });

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
  const { items, ariaLabel, className, height, size, variant } = props;
  const mode = props.mode ?? 'single';

  const isSelected = (value: V): boolean => {
    if (mode === 'multiple') return (props.value as readonly V[]).includes(value);
    return (props.value as V | null) === value;
  };

  /** Mixed only in multiple mode, and only where `value` doesn't already
   *  claim the segment. */
  const isMixed = (value: V): boolean => {
    if (mode !== 'multiple') return false;
    const mixed = (props as { mixedValues?: readonly V[] }).mixedValues;
    return mixed !== undefined && mixed.includes(value) && !isSelected(value);
  };

  const handleClick = (index: number) => () => {
    const item = items[index];
    if (item.disabled) return;
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

  const roving = useRovingTabIndex({
    itemSelector: `.${s.segment}`,
    tabStopIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    onNavigate: mode === 'single'
      ? (index) => (props.onChange as (n: V | null) => void)(items[index].value)
      : undefined,
    onActivate: mode === 'multiple' ? (index) => handleClick(index)() : undefined,
  });

  // Segment labels drawn as `FitLabel`s shorten together when the bar is
  // squeezed or will not fit where it sits.
  const fit = useFitScope(roving.rootRef);

  return (
    <SegmentedRow
      roving={roving}
      role={mode === 'multiple' ? 'group' : 'radiogroup'}
      ariaLabel={ariaLabel}
      className={className}
      height={height}
      size={size}
      variant={variant}
      wrap={(segments) => <FitScope value={fit}>{segments}</FitScope>}
      segments={items.map((item, i) => {
        const selected = isSelected(item.value);
        const mixed = isMixed(item.value);
        const state: SegmentState = selected ? 'on' : mixed ? 'mixed' : 'off';
        return {
          key: String(item.value),
          state,
          draw: (place) => (
            <SegmentTooltip content={segmentTooltipContent(item)} disabled={item.disabled}>
              <button
                type="button"
                role={mode === 'multiple' ? undefined : 'radio'}
                aria-checked={mode === 'multiple' ? undefined : selected}
                aria-pressed={mode === 'multiple' ? (mixed ? 'mixed' : selected) : undefined}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={segmentClassName(state, place)}
                {...segmentPlaceProps(place)}
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
}

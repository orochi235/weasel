import { type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps } from '../segmentedRow';
import type { SegmentedSize, SegmentedVariant } from '../segmentedVariant';
import { useRovingTabIndex } from '../../useRovingTabIndex';

/**
 * One segment of an {@link OptionsBar}. Unlike `ToggleBar`, each item carries
 * its own selected state and its own `onChange`.
 */
export type OptionsBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  selected: boolean;
  onChange: (next: boolean) => void;
};

/** Segment height and type scale for an {@link OptionsBar}. */
export type OptionsBarSize = SegmentedSize;
/** Visual treatment of an {@link OptionsBar}. */
export type OptionsBarVariant = SegmentedVariant;

/** Props for {@link OptionsBar}. */
export type OptionsBarProps<V extends string | number = string> = {
  items: readonly OptionsBarItem<V>[];
  ariaLabel?: string;
  className?: string;
  height?: number;
  /** Size variant. `sm` is ~60% of the default height with reduced padding
   *  and font size — sized for dense surfaces like lab control panels. */
  size?: OptionsBarSize;
  /** Visual variant. `minimal` strips the pill track and glass treatment;
   *  selection becomes a flat accent. For dense diagnostic surfaces. */
  variant?: OptionsBarVariant;
};

/**
 * Segmented strip of independent on/off options, each owning its own state.
 * Use it when the segments are unrelated booleans; use `ToggleBar` when they
 * are values of one setting.
 */
export function OptionsBar<V extends string | number = string>(props: OptionsBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;

  const toggle = (index: number) => {
    const item = items[index];
    if (item.disabled) return;
    item.onChange(!item.selected);
  };

  const roving = useRovingTabIndex({ itemSelector: `.${s.segment}`, onActivate: toggle });

  return (
    <SegmentedRow
      roving={roving}
      role="group"
      ariaLabel={ariaLabel}
      className={className}
      height={height}
      size={size}
      variant={variant}
      segments={items.map((item, i) => {
        const state = item.selected ? ('on' as const) : ('off' as const);
        return {
          key: String(item.value),
          state,
          draw: (place) => (
            <button
              type="button"
              aria-pressed={item.selected}
              aria-label={item.ariaLabel}
              disabled={item.disabled}
              className={segmentClassName(state, place)}
              {...segmentPlaceProps(place)}
              onClick={() => toggle(i)}
            >
              {item.label}
            </button>
          ),
        };
      })}
    />
  );
}

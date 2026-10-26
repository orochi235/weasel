import { type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps } from '../segmentedRow';
import type { SegmentedSize, SegmentedVariant } from '../segmentedVariant';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { SegmentTooltip, segmentTooltipContent, type SegmentTooltipFields } from '../segmentTooltip';

/**
 * One button in an {@link ButtonBar}. `value` is only a React key; the item
 * carries no selected state.
 */
export type ButtonBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  onAction: () => void;
} & SegmentTooltipFields;

/** Segment height and type scale for an {@link ButtonBar}. */
export type ButtonBarSize = SegmentedSize;
/** Visual treatment of an {@link ButtonBar}. */
export type ButtonBarVariant = SegmentedVariant;

/** Props for {@link ButtonBar}. */
export type ButtonBarProps<V extends string | number = string> = {
  items: readonly ButtonBarItem<V>[];
  ariaLabel?: string;
  className?: string;
  height?: number;
  size?: ButtonBarSize;
  variant?: ButtonBarVariant;
};

/**
 * Segmented strip of momentary buttons — each press fires and nothing stays
 * selected. Shares the look and the arrow-key navigation of `ToggleBar` and
 * `OptionsBar`.
 *
 * This is a plain callback bar. For buttons driven by the kit's actions
 * registry, use `ActionBar` instead.
 */
export function ButtonBar<V extends string | number = string>(props: ButtonBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;

  const fire = (index: number) => {
    const item = items[index];
    if (item.disabled) return;
    item.onAction();
  };

  const roving = useRovingTabIndex({ itemSelector: `.${s.segment}`, onActivate: fire });

  return (
    <SegmentedRow
      roving={roving}
      role="toolbar"
      ariaLabel={ariaLabel}
      className={className}
      height={height}
      size={size}
      variant={variant}
      segments={items.map((item, i) => ({
        key: String(item.value),
        state: 'off' as const,
        draw: (place) => (
          <SegmentTooltip content={segmentTooltipContent(item)} disabled={item.disabled}>
            <button
              type="button"
              aria-label={item.ariaLabel}
              disabled={item.disabled}
              className={segmentClassName('off', place)}
              {...segmentPlaceProps(place)}
              onClick={() => fire(i)}
            >
              {item.label}
            </button>
          </SegmentTooltip>
        ),
      }))}
    />
  );
}

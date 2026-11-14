import { type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { SegmentedRow, segmentClassName, segmentPlaceProps, useSegmentedTiling, type SegmentedGridProps } from '../segmentedRow';
import { tilingRoving } from '../../tiling';
import type { SegmentedVariant } from '../segmentedVariant';
import type { ControlSize } from '../Density';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { SegmentTooltip, useSegmentAccess, type SegmentTooltipFields } from '../segmentTooltip';
import { holdScope, type DisableableProps } from '../Disabled';
import type { Orientation } from '../Run';

/**
 * One button in an {@link ButtonBar}. `value` is only a React key; the item
 * carries no selected state.
 */
export type ButtonBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  onAction: () => void;
} & SegmentTooltipFields & DisableableProps;

/** Visual treatment of an {@link ButtonBar}. */
export type ButtonBarVariant = SegmentedVariant;

/** Props for {@link ButtonBar}. */
export type ButtonBarProps<V extends string | number = string> = SegmentedGridProps & DisableableProps & {
  items: readonly ButtonBarItem<V>[];
  'aria-label'?: string;
  className?: string;
  height?: number;
  /** Default: the nearest `Density` scope's, else `md`. */
  size?: ControlSize;
  /** Which way the segments run. Defaults to the way the row the bar sits in runs; a vertical bar keeps its labels upright. */
  orientation?: Orientation;
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
  const { items, 'aria-label': ariaLabel, className, height, size, variant, orientation } = props;

  const held = useSegmentAccess(props).state !== 'enabled';
  const fire = (index: number) => {
    const item = items[index];
    if (held || item.disabled) return;
    item.onAction();
  };

  const tiles = useSegmentedTiling(props);
  const roving = useRovingTabIndex({ itemSelector: `.${s.segment}`, ...(tiles ? tilingRoving(tiles) : {}), onActivate: fire });

  return <>{holdScope(props, (
    <SegmentedRow
      roving={roving}
      role="toolbar"
      ariaLabel={ariaLabel}
      className={className}
      tiling={tiles}
      height={height}
      size={size}
      variant={variant}
      orientation={orientation}
      segments={items.map((item, i) => ({
        key: String(item.value),
        state: 'off' as const,
        draw: (place) => (
          <SegmentTooltip tip={item} disabled={item.disabled} disabledReason={item.disabledReason}>
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
  ))}</>;
}

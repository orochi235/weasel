import { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
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
export type ButtonBarSize = 'sm' | 'md';
/** Visual treatment of an {@link ButtonBar}. */
export type ButtonBarVariant = 'default' | 'minimal';

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

  const roving = useRovingTabIndex({ items, itemClassName: s.segment, onActivate: fire });

  const style: CSSProperties | undefined = height !== undefined
    ? ({ ['--wzl-tb-height' as string]: `${height}px` } as CSSProperties)
    : undefined;

  const rootCls = [
    s.root,
    size && s[`size_${size}`],
    variant && s[`variant_${variant}`],
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={roving.rootRef}
      className={rootCls}
      role="toolbar"
      aria-label={ariaLabel}
      style={style}
    >
      {items.map((item, i) => (
        <SegmentTooltip key={item.value} content={segmentTooltipContent(item)} disabled={item.disabled}>
          <button
            type="button"
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            tabIndex={roving.tabIndexFor(i)}
            className={s.segment}
            onClick={() => fire(i)}
            onKeyDown={roving.onKeyDown(i)}
          >
            {item.label}
          </button>
        </SegmentTooltip>
      ))}
    </div>
  );
}

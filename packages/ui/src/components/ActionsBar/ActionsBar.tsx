import { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { useRovingTabIndex } from '../../useRovingTabIndex';

/**
 * One button in an {@link ActionsBar}. `value` is only a React key; the item
 * carries no selected state.
 */
export type ActionsBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  onAction: () => void;
};

/** Segment height and type scale for an {@link ActionsBar}. */
export type ActionsBarSize = 'sm' | 'md';
/** Visual treatment of an {@link ActionsBar}. */
export type ActionsBarVariant = 'default' | 'minimal';

/** Props for {@link ActionsBar}. */
export type ActionsBarProps<V extends string | number = string> = {
  items: readonly ActionsBarItem<V>[];
  ariaLabel?: string;
  className?: string;
  height?: number;
  size?: ActionsBarSize;
  variant?: ActionsBarVariant;
};

/**
 * Segmented strip of momentary buttons — each press fires and nothing stays
 * selected. Shares the look and the arrow-key navigation of `ToggleBar` and
 * `OptionsBar`.
 *
 * This is a plain callback bar. For buttons driven by the kit's actions
 * registry, use `ActionBar` instead.
 */
export function ActionsBar<V extends string | number = string>(props: ActionsBarProps<V>): ReactElement {
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
        <button
          key={item.value}
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
      ))}
    </div>
  );
}

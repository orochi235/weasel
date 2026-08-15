import { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import s from '../segmentedControl.module.css';
import { useRovingTabIndex } from '../../useRovingTabIndex';

export type OptionsBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  selected: boolean;
  onChange: (next: boolean) => void;
};

export type OptionsBarSize = 'sm' | 'md';
export type OptionsBarVariant = 'default' | 'minimal';

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

export function OptionsBar<V extends string | number = string>(props: OptionsBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;

  const toggle = (index: number) => {
    const item = items[index];
    if (item.disabled) return;
    item.onChange(!item.selected);
  };

  const roving = useRovingTabIndex({ items, itemClassName: s.segment, onActivate: toggle });

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
      role="group"
      aria-label={ariaLabel}
      style={style}
    >
      {items.map((item, i) => {
        const cls = `${s.segment}${item.selected ? ` ${s.segmentSelected}` : ''}`;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={item.selected}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            tabIndex={roving.tabIndexFor(i)}
            className={cls}
            onClick={() => toggle(i)}
            onKeyDown={roving.onKeyDown(i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

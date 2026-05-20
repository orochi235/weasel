import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import s from './OptionsBar.module.css';

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

function firstEnabledIndex(items: readonly OptionsBarItem<string | number>[]): number {
  for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
  return -1;
}

function lastEnabledIndex(items: readonly OptionsBarItem<string | number>[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i].disabled) return i;
  return -1;
}

function nextEnabledIndex(items: readonly OptionsBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function prevEnabledIndex(items: readonly OptionsBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from - k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

export function OptionsBar<V extends string | number = string>(props: OptionsBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const tabStopIndex = firstEnabledIndex(items);

  const toggle = (index: number) => {
    const item = items[index];
    if (item.disabled) return;
    item.onChange(!item.selected);
  };

  const focusSegment = (index: number) => {
    const root = rootRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>(`.${s.segment}`);
    buttons[index]?.focus();
  };

  const handleKeyDown = (index: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = -1;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = prevEnabledIndex(items, index);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = nextEnabledIndex(items, index);
        break;
      case 'Home':
        nextIndex = firstEnabledIndex(items);
        break;
      case 'End':
        nextIndex = lastEnabledIndex(items);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        toggle(index);
        return;
      default:
        return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    e.preventDefault();
    focusSegment(nextIndex);
  };

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
      ref={rootRef}
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
            tabIndex={i === tabStopIndex ? 0 : -1}
            className={cls}
            onClick={() => toggle(i)}
            onKeyDown={handleKeyDown(i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

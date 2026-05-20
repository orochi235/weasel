import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import s from './ActionsBar.module.css';

export type ActionsBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  onAction: () => void;
};

export type ActionsBarSize = 'sm' | 'md';
export type ActionsBarVariant = 'default' | 'minimal';

export type ActionsBarProps<V extends string | number = string> = {
  items: readonly ActionsBarItem<V>[];
  ariaLabel?: string;
  className?: string;
  height?: number;
  size?: ActionsBarSize;
  variant?: ActionsBarVariant;
};

function firstEnabledIndex(items: readonly ActionsBarItem<string | number>[]): number {
  for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
  return -1;
}

function lastEnabledIndex(items: readonly ActionsBarItem<string | number>[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i].disabled) return i;
  return -1;
}

function nextEnabledIndex(items: readonly ActionsBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function prevEnabledIndex(items: readonly ActionsBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from - k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

export function ActionsBar<V extends string | number = string>(props: ActionsBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const tabStopIndex = firstEnabledIndex(items);

  const fire = (index: number) => {
    const item = items[index];
    if (item.disabled) return;
    item.onAction();
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
        fire(index);
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
          tabIndex={i === tabStopIndex ? 0 : -1}
          className={s.segment}
          onClick={() => fire(i)}
          onKeyDown={handleKeyDown(i)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

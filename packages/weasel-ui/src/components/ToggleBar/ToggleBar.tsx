import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import s from './ToggleBar.module.css';

export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type CommonProps = {
  ariaLabel?: string;
  className?: string;
  height?: number;
};

export type ToggleBarProps<V extends string | number = string> =
  | (CommonProps & {
      mode?: 'single';
      items: readonly ToggleBarItem<V>[];
      value: V | null;
      onChange: (next: V | null) => void;
      allowDeselect?: boolean;
    })
  | (CommonProps & {
      mode: 'multiple';
      items: readonly ToggleBarItem<V>[];
      value: readonly V[];
      onChange: (next: V[]) => void;
    });

function firstEnabledIndex(items: readonly ToggleBarItem<string | number>[]): number {
  for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
  return -1;
}

function lastEnabledIndex(items: readonly ToggleBarItem<string | number>[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i].disabled) return i;
  return -1;
}

function nextEnabledIndex(items: readonly ToggleBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function prevEnabledIndex(items: readonly ToggleBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from - k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height } = props;
  const mode = props.mode ?? 'single';
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (value: V): boolean => {
    if (mode === 'multiple') return (props.value as readonly V[]).includes(value);
    return (props.value as V | null) === value;
  };

  let tabStopIndex = -1;
  if (mode === 'single') {
    const sel = items.findIndex(it => it.value === (props.value as V | null));
    tabStopIndex = sel >= 0 && !items[sel].disabled ? sel : firstEnabledIndex(items);
  } else {
    tabStopIndex = firstEnabledIndex(items);
  }

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
        if (mode === 'multiple') {
          e.preventDefault();
          handleClick(index)();
        }
        return;
      default:
        return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    e.preventDefault();
    if (mode === 'single') {
      const item = items[nextIndex];
      (props.onChange as (n: V | null) => void)(item.value);
    }
    focusSegment(nextIndex);
  };

  const style: CSSProperties | undefined = height !== undefined
    ? ({ ['--wzl-tb-height' as string]: `${height}px` } as CSSProperties)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={className ? `${s.root} ${className}` : s.root}
      role={mode === 'multiple' ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      style={style}
    >
      {items.map((item, i) => {
        const selected = isSelected(item.value);
        const cls = `${s.segment}${selected ? ` ${s.segmentSelected}` : ''}`;
        return (
          <button
            key={item.value}
            type="button"
            role={mode === 'multiple' ? undefined : 'radio'}
            aria-checked={mode === 'multiple' ? undefined : selected}
            aria-pressed={mode === 'multiple' ? selected : undefined}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            tabIndex={i === tabStopIndex ? 0 : -1}
            className={cls}
            onClick={handleClick(i)}
            onKeyDown={handleKeyDown(i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

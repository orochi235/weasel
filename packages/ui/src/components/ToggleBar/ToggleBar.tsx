import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import s from './ToggleBar.module.css';

export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

export type ToggleBarSize = 'sm' | 'md';
export type ToggleBarVariant = 'default' | 'minimal';

type CommonProps = {
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
      /**
       * Values that are neither on nor off — the sources this bar
       * aggregates disagree (a text range that is bold in part of it, a
       * multi-selection whose nodes differ). Rendered `aria-pressed="mixed"`,
       * the ARIA tri-state a toggle button actually has, rather than
       * `SelectionPanel`'s reduced-opacity-plus-`title` workaround for
       * `Switch`, which has no indeterminate state to render.
       *
       * `value` wins where the two lists overlap, so a caller that can't
       * cheaply keep them disjoint doesn't get an ambiguous segment.
       *
       * Clicking a mixed segment turns it fully **on**, matching the
       * everywhere-else convention (and `toggleFlagInRange`'s rule for a
       * partially-styled text range) that a mixed toggle resolves toward
       * the affirmative rather than clearing.
       */
      mixedValues?: readonly V[];
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
  const { items, ariaLabel, className, height, size, variant } = props;
  const mode = props.mode ?? 'single';
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (value: V): boolean => {
    if (mode === 'multiple') return (props.value as readonly V[]).includes(value);
    return (props.value as V | null) === value;
  };

  /** Mixed only in multiple mode, and only where `value` doesn't already
   *  claim the segment. Single mode has nothing to be mixed about — its
   *  aggregate is one value or none. */
  const isMixed = (value: V): boolean => {
    if (mode !== 'multiple') return false;
    const mixed = (props as { mixedValues?: readonly V[] }).mixedValues;
    return mixed !== undefined && mixed.includes(value) && !isSelected(value);
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
      role={mode === 'multiple' ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      style={style}
    >
      {items.map((item, i) => {
        const selected = isSelected(item.value);
        const mixed = isMixed(item.value);
        const cls = [s.segment, selected && s.segmentSelected, mixed && s.segmentMixed]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={item.value}
            type="button"
            role={mode === 'multiple' ? undefined : 'radio'}
            aria-checked={mode === 'multiple' ? undefined : selected}
            aria-pressed={mode === 'multiple' ? (mixed ? 'mixed' : selected) : undefined}
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

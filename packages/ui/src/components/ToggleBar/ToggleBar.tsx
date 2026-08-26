import { type CSSProperties, type ReactElement, type ReactNode } from 'react';
import s from './ToggleBar.module.css';
import { useRovingTabIndex } from '../../useRovingTabIndex';

/** One segment of a {@link ToggleBar}, identified by its `value`. */
export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

/** Segment height and type scale for a {@link ToggleBar}. */
export type ToggleBarSize = 'sm' | 'md';
/** Visual treatment of a {@link ToggleBar}. */
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

/**
 * Props for {@link ToggleBar}, discriminated on `mode`. Single mode is
 * controlled by one value or `null`; multiple mode by an array, and only it
 * accepts `mixedValues`.
 */
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

/**
 * Segmented control for choosing among a fixed set of values — one of them
 * (`mode: 'single'`, the default) or any number (`mode: 'multiple'`).
 *
 * Single mode ignores a click on the already-selected segment unless
 * `allowDeselect` is set. Arrow keys move focus without changing the value;
 * Space and Enter commit.
 */
export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height, size, variant } = props;
  const mode = props.mode ?? 'single';

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

  const selectedIndex = mode === 'single'
    ? items.findIndex(it => it.value === (props.value as V | null))
    : -1;

  const roving = useRovingTabIndex({
    items,
    itemClassName: s.segment,
    // Single mode is a radiogroup: the tab stop is the current value, and
    // arrow keys move the selection with the focus. Multiple mode is a set of
    // independent toggles — focus alone moves, and Space/Enter flips.
    tabStopIndex: selectedIndex >= 0 && !items[selectedIndex].disabled ? selectedIndex : undefined,
    onNavigate: mode === 'single'
      ? (index) => (props.onChange as (n: V | null) => void)(items[index].value)
      : undefined,
    onActivate: mode === 'multiple' ? (index) => handleClick(index)() : undefined,
  });

  const style: CSSProperties | undefined = height !== undefined
    ? ({ ['--tb-h' as string]: `${height}px` } as CSSProperties)
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
            tabIndex={roving.tabIndexFor(i)}
            className={cls}
            onClick={handleClick(i)}
            onKeyDown={roving.onKeyDown(i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

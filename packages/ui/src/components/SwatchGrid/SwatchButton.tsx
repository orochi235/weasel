import { useState, type ButtonHTMLAttributes, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactElement } from 'react';
import { tileKey, type LastRow } from '@weasel-js/ui-input';
import { inlineDirection } from '../../useRovingTabIndex';
import { useRecordRecentColor } from '../RecentColors/RecentColorsProvider';
import type { ControlHold } from '../Disabled/controlHold';
import { describedBy, useHoldReason } from '../Disabled/HoldReason';
import { composeHandler, type DataAttributes } from '../../nativeProps';
import type { SwatchGridOption } from './SwatchGrid';
import s from './SwatchGrid.module.css';

function nameOf(o: SwatchGridOption): string {
  return o.label ?? o.value ?? 'None';
}

/** What tells a swatch apart from the rest: its `id`, else its color. */
export function swatchId(o: SwatchGridOption): string | null {
  return o.id ?? o.value;
}

/** A palette's `value`: the id of its one current swatch, or a list of the ids pressed, which makes every swatch a
 *  toggle. */
export type SwatchValue = string | null | readonly (string | null)[];

/** Which of `options` a palette's `value` marks, whether they are toggles, and the first marked, or -1. */
export function swatchMarks(options: readonly SwatchGridOption[], value: SwatchValue | undefined): {
  toggles: boolean;
  marked: (i: number) => boolean;
  first: number;
} {
  if (value === undefined || value === null || typeof value === 'string') {
    const current = value === undefined ? -1 : options.findIndex((o) => swatchId(o) === value);
    return { toggles: false, marked: (i) => i === current, first: current };
  }
  const ids = new Set(value);
  const marked = (i: number) => ids.has(swatchId(options[i]!));
  return { toggles: true, marked, first: options.findIndex((_, i) => marked(i)) };
}

/** What a palette is told when a swatch applies: the swatch's id (its color unless it names one), and the swatch. */
export type SwatchChange = (id: string | null, option: SwatchGridOption) => void;

/** What a palette does with a swatch: apply it to either target, recording its color as recent. */
export interface SwatchApply {
  onChange: (option: SwatchGridOption) => void;
  onAltChange: ((option: SwatchGridOption) => void) | undefined;
}

/** Applies that call `onChange` or `onAltChange` with the swatch's id and record its color into the nearest recent
 *  colors. */
export function useSwatchApply(onChange: SwatchChange, onAltChange?: SwatchChange): SwatchApply {
  const record = useRecordRecentColor();
  const recorded = (to: SwatchChange) => (o: SwatchGridOption): void => {
    to(swatchId(o), o);
    if (o.value !== null) record(o.value);
  };
  return { onChange: recorded(onChange), onAltChange: onAltChange && recorded(onAltChange) };
}

/** `apply`, or, held, applies that apply nothing. */
export function heldApply(apply: SwatchApply, hold: ControlHold): SwatchApply {
  return { onChange: hold.gate(apply.onChange), onAltChange: hold.gate(apply.onAltChange) };
}

const GRID_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** The swatches of one palette, under `root`, in order. */
export const swatchesIn = (root: Element | null): HTMLElement[] => [...(root?.querySelectorAll<HTMLElement>('[data-swatch]') ?? [])];

/** The key handler of swatch `i`: arrows rove focus among `swatches()`, Shift+Enter applies to the alternate target. */
export function swatchKeyDown(i: number, options: readonly SwatchGridOption[], columns: number, apply: SwatchApply, swatches: () => HTMLElement[], lastRow: LastRow = 'start') {
  return (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Enter') {
      if (e.shiftKey && apply.onAltChange) {
        e.preventDefault();
        if (!options[i]!.disabled) apply.onAltChange(options[i]!);
      }
      return;
    }
    if (!GRID_KEYS.has(e.key)) return;
    e.preventDefault();
    const next = tileKey(i, e.key, options.length, { columns, lastRow }, { dir: inlineDirection(e.currentTarget) });
    if (next !== null && next !== i) swatches()[next]?.focus();
  };
}

/** Which of a palette's `count` swatches holds its one tab stop: the focused one while focus is inside, so Tab
 *  leaves the palette from wherever the arrows took it, else `current`, else the first. Each swatch reports its focus
 *  through `focused`, and the palette's root takes `onBlur`. */
export function useSwatchStop(current: number, count: number): {
  stop: number;
  focused: (i: number) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
} {
  const [inside, setInside] = useState<number | null>(null);
  return {
    stop: inside !== null && inside < count ? inside : current >= 0 ? current : 0,
    focused: setInside,
    onBlur: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setInside(null);
    },
  };
}

/** Props of {@link SwatchButton}. Every native `<button>` attribute and handler but the ones it writes itself
 *  passes through: a palette's roving keys and focus, the data attributes a layout reads off the swatch, and the
 *  attributes its palette's hold puts on it (`aria-disabled`, `aria-readonly`, `aria-describedby`). */
export type SwatchButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label' | 'aria-current' | 'tabIndex' | 'children'
> & DataAttributes & {
  option: SwatchGridOption;
  /** Whether this swatch is its palette's one tab stop. */
  tabStop: boolean;
  /** Whether to mark this swatch current, or, a toggle, pressed. */
  current: boolean;
  /** Whether the swatch is a toggle, `current` read as `aria-pressed` rather than `aria-current`. */
  toggle?: boolean;
  /** What a click, a shift-click and a right-click apply to: {@link useSwatchApply}'s. A caller's `onClick` or
   *  `onContextMenu` runs first, and one that calls `preventDefault()` applies nothing. */
  apply: SwatchApply;
};

/** One swatch: its color over the checker, its glyph centered over that in its ink, named by its label, applying on
 *  click and to the alternate target on shift-click or right-click. A `disabled` swatch applies nothing and stays
 *  reachable by the arrows, as an item of a composite does, saying its `disabledReason` where it has one. */
export function SwatchButton(
  { option: o, tabStop, current, toggle = false, apply, className, style, onClick, onContextMenu, ...native }: SwatchButtonProps,
): ReactElement {
  const name = nameOf(o);
  const off = o.disabled === true;
  const reason = useHoldReason(off ? o.disabledReason : undefined);
  const paint = {
    ...style,
    ...(o.value === null ? {} : { '--swatch': o.value }),
    ...(o.ink === undefined ? {} : { '--swatch-ink': o.ink }),
  } as CSSProperties;
  return reason.wrap(
    <button
      title={reason.describedBy ? undefined : name}
      {...native}
      type="button"
      className={className ? `${s.swatch} ${className}` : s.swatch}
      aria-label={name}
      tabIndex={tabStop ? 0 : -1}
      aria-current={!toggle && current ? 'true' : undefined}
      aria-pressed={toggle ? current : undefined}
      {...(off ? { 'aria-disabled': true, 'data-disabled': '' } : {})}
      aria-describedby={describedBy(native['aria-describedby'], reason.describedBy)}
      data-swatch=""
      {...(o.value === null ? { 'data-none': '' } : {})}
      style={paint}
      onClick={composeHandler(onClick, (e) => {
        if (off) return;
        if (e.shiftKey && apply.onAltChange) apply.onAltChange(o);
        else apply.onChange(o);
      })}
      onContextMenu={composeHandler(
        onContextMenu,
        apply.onAltChange ? (e) => { e.preventDefault(); if (!off) apply.onAltChange?.(o); } : undefined,
      )}
    >
      {o.glyph != null && <span className={s.glyph} aria-hidden="true">{o.glyph}</span>}
    </button>,
  );
}

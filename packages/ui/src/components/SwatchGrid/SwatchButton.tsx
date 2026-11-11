import { useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactElement } from 'react';
import { tileKey, type LastRow } from '@weasel-js/ui-input';
import { inlineDirection } from '../../useRovingTabIndex';
import { useRecordRecentColor } from '../RecentColors/RecentColorsProvider';
import type { SwatchGridOption } from './SwatchGrid';
import s from './SwatchGrid.module.css';

function nameOf(o: SwatchGridOption): string {
  return o.label ?? o.value ?? 'None';
}

/** What tells a swatch apart from the rest: its `id`, else its color. */
export function swatchId(o: SwatchGridOption): string | null {
  return o.id ?? o.value;
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

const GRID_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** The swatches of one palette, under `root`, in order. */
export const swatchesIn = (root: Element | null): HTMLElement[] => [...(root?.querySelectorAll<HTMLElement>('[data-swatch]') ?? [])];

/** The key handler of swatch `i`: arrows rove focus among `swatches()`, Shift+Enter applies to the alternate target. */
export function swatchKeyDown(i: number, options: readonly SwatchGridOption[], columns: number, apply: SwatchApply, swatches: () => HTMLElement[], lastRow: LastRow = 'start') {
  return (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Enter') {
      if (e.shiftKey && apply.onAltChange) {
        e.preventDefault();
        apply.onAltChange(options[i]!);
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

/** Props of {@link SwatchButton}. */
export interface SwatchButtonProps {
  option: SwatchGridOption;
  /** Whether this swatch is its palette's one tab stop. */
  tabStop: boolean;
  /** Whether to mark this swatch current. */
  current: boolean;
  /** What a click, a shift-click and a right-click apply to: {@link useSwatchApply}'s. */
  apply: SwatchApply;
  /** Keys on the swatch: a palette's roving focus. Enter and Space click it without one. */
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus?: () => void;
  className?: string;
  style?: CSSProperties;
  /** Data attributes a layout reads off the swatch. */
  data?: Record<`data-${string}`, string | undefined>;
}

/** One swatch: its color over the checker, its glyph centered over that in its ink, named by its label, applying on
 *  click and to the alternate target on shift-click or right-click. */
export function SwatchButton({ option: o, tabStop, current, apply, onKeyDown, onFocus, className, style, data }: SwatchButtonProps): ReactElement {
  const name = nameOf(o);
  const paint = {
    ...style,
    ...(o.value === null ? {} : { '--swatch': o.value }),
    ...(o.ink === undefined ? {} : { '--swatch-ink': o.ink }),
  } as CSSProperties;
  return (
    <button
      type="button"
      className={className ? `${s.swatch} ${className}` : s.swatch}
      aria-label={name}
      title={name}
      tabIndex={tabStop ? 0 : -1}
      aria-current={current ? 'true' : undefined}
      data-swatch=""
      {...data}
      {...(o.value === null ? { 'data-none': '' } : {})}
      style={paint}
      onClick={(e) => {
        if (e.shiftKey && apply.onAltChange) apply.onAltChange(o);
        else apply.onChange(o);
      }}
      onContextMenu={apply.onAltChange ? (e) => { e.preventDefault(); apply.onAltChange?.(o); } : undefined}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      {o.glyph != null && <span className={s.glyph} aria-hidden="true">{o.glyph}</span>}
    </button>
  );
}

import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import type { RunAlign } from '@weasel-js/geom';
import { inlineDirection, rovingTarget } from '../../useRovingTabIndex';
import { useRecordRecentColor } from '../RecentColors/RecentColorsProvider';
import type { SwatchGridOption } from './SwatchGrid';
import s from './SwatchGrid.module.css';

function nameOf(o: SwatchGridOption): string {
  return o.label ?? o.value ?? 'None';
}

/** What a palette does with a swatch: apply it to either target, recording it as recent. */
export interface SwatchApply {
  onChange: (value: string | null) => void;
  onAltChange: ((value: string | null) => void) | undefined;
}

/** `onChange` and `onAltChange` that also record what they apply into the nearest recent colors. */
export function useSwatchApply(onChange: (value: string | null) => void, onAltChange?: (value: string | null) => void): SwatchApply {
  const record = useRecordRecentColor();
  return {
    onChange: (v) => {
      onChange(v);
      if (v !== null) record(v);
    },
    onAltChange: onAltChange && ((v) => {
      onAltChange(v);
      if (v !== null) record(v);
    }),
  };
}

const GRID_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/** How far a last row shorter than `columns` sits from the start, in half-columns, for `count` swatches. */
export function rowLead(count: number, columns: number, align: RunAlign): number {
  const short = count % columns;
  if (short === 0 || align === 'start') return 0;
  return align === 'end' ? 2 * (columns - short) : columns - short;
}

/** Where Up or Down moves focus from swatch `i` of `count`, `columns` to a row, the last row shifted
 *  `lead` half-columns along: to the swatch over or under this one. -1 for any other key. */
export function nextSwatch(key: string, i: number, count: number, columns: number, lead = 0): number {
  const last = count - 1;
  const lastStart = count - (count % columns || columns);
  switch (key) {
    case 'ArrowUp': {
      if (i < columns) return i;
      return i < lastStart ? i - columns : lastStart - columns + Math.floor((lead + 2 * (i - lastStart)) / 2);
    }
    case 'ArrowDown': {
      if (i + columns < lastStart) return i + columns;
      if (i >= lastStart) return i;
      // A swatch straddling two columns sits under the left one; under this one is it, or else the one ending halfway.
      const under = Math.ceil((2 * (i % columns) - lead) / 2);
      if (under >= 0 && lastStart + under <= last) return lastStart + under;
      return lead % 2 === 1 && under - 1 >= 0 && lastStart + under - 1 <= last ? lastStart + under - 1 : i;
    }
    default: return -1;
  }
}

/** The swatches of one palette, under `root`, in order. */
export const swatchesIn = (root: Element | null): HTMLElement[] => [...(root?.querySelectorAll<HTMLElement>('[data-swatch]') ?? [])];

/** The key handler of swatch `i`: arrows rove focus among `swatches()`, Shift+Enter applies to the alternate target. */
export function swatchKeyDown(i: number, options: readonly SwatchGridOption[], columns: number, apply: SwatchApply, swatches: () => HTMLElement[], lead = 0) {
  return (e: KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'Enter') {
      if (e.shiftKey && apply.onAltChange) {
        e.preventDefault();
        apply.onAltChange(options[i]!.value);
      }
      return;
    }
    if (!GRID_KEYS.has(e.key)) return;
    e.preventDefault();
    const next = e.key === 'ArrowUp' || e.key === 'ArrowDown'
      ? nextSwatch(e.key, i, options.length, columns, lead)
      : rovingTarget(i, e.key, options.map(() => true), 'horizontal', inlineDirection(e.currentTarget));
    if (next !== null && next !== i) swatches()[next]?.focus();
  };
}

/** Props of {@link SwatchButton}. */
export interface SwatchButtonProps {
  option: SwatchGridOption;
  tabStop: boolean;
  current: boolean;
  apply: SwatchApply;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
  /** Data attributes a layout reads off the swatch. */
  data?: Record<`data-${string}`, string | undefined>;
}

/** One swatch: its color over the checker, named by its label, applying on click and to the alternate target on
 *  shift-click or right-click. */
export function SwatchButton({ option: o, tabStop, current, apply, onKeyDown, className, style, data }: SwatchButtonProps): ReactElement {
  const name = nameOf(o);
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
      style={o.value === null ? style : ({ ...style, '--swatch': o.value } as CSSProperties)}
      onClick={(e) => {
        if (e.shiftKey && apply.onAltChange) apply.onAltChange(o.value);
        else apply.onChange(o.value);
      }}
      onContextMenu={apply.onAltChange ? (e) => { e.preventDefault(); apply.onAltChange?.(o.value); } : undefined}
      onKeyDown={onKeyDown}
    />
  );
}

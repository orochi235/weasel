import type { CSSProperties, KeyboardEvent, ReactElement } from 'react';
import { inlineDirection, rovingGridTarget } from '../../useRovingTabIndex';
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

/** The indices of `count` swatches, `columns` to a row. */
function rowsOf(count: number, columns: number): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i < count; i += columns) rows.push(Array.from({ length: Math.min(columns, count - i) }, (_, k) => i + k));
  return rows;
}

/** The swatches of one palette, under `root`, in order. */
export const swatchesIn = (root: Element | null): HTMLElement[] => [...(root?.querySelectorAll<HTMLElement>('[data-swatch]') ?? [])];

/** The key handler of swatch `i`: arrows rove focus among `swatches()`, Shift+Enter applies to the alternate target. */
export function swatchKeyDown(i: number, options: readonly SwatchGridOption[], columns: number, apply: SwatchApply, swatches: () => HTMLElement[]) {
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
    const next = rovingGridTarget(i, e.key, options.map(() => true), rowsOf(options.length, columns), inlineDirection(e.currentTarget));
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

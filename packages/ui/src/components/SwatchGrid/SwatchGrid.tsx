import { useRef, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react';
import s from './SwatchGrid.module.css';

/** One swatch. `value: null` is the "no paint" swatch. */
export interface SwatchGridOption {
  value: string | null;
  /** Accessible name and tooltip. Defaults to the value, or "None". */
  label?: string;
}

/** Props for {@link SwatchGrid}. */
export interface SwatchGridProps {
  options: readonly SwatchGridOption[];
  /** The swatch to mark current, if any matches. */
  value?: string | null;
  /** A click, Enter or Space on a swatch. */
  onChange: (value: string | null) => void;
  /** The alternate target — shift-click, right-click (the browser menu is
   *  suppressed) and Shift+Enter. Drawing apps route this to the slot that
   *  isn't focused: click for fill, shift-click for stroke. */
  onAltChange?: (value: string | null) => void;
  /** Swatches per row; also the step for ArrowUp/ArrowDown. Default 6. */
  columns?: number;
  'aria-label'?: string;
  className?: string;
}

function nameOf(o: SwatchGridOption): string {
  return o.label ?? o.value ?? 'None';
}

/**
 * A palette: a grid of color swatches that apply on click. Keyboard focus
 * roves — one tab stop, on the current swatch, with the arrows moving by one
 * across and by a row up and down.
 *
 * The grid applies nothing itself. `onChange` and `onAltChange` hand the
 * color to the app, which decides what "apply" means: set its active paint,
 * write the selection through `useOngoingAction`'s `commit`, or both.
 */
export function SwatchGrid(props: SwatchGridProps): ReactElement {
  const { options, value, onChange, onAltChange, className } = props;
  const columns = props.columns ?? 6;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = value === undefined ? -1 : options.findIndex((o) => o.value === value);
  const tabStop = current >= 0 ? current : 0;

  const focusAt = (i: number): void => {
    rootRef.current?.querySelectorAll<HTMLElement>('button')[i]?.focus();
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLButtonElement>): void => {
    const last = options.length - 1;
    let next = -1;
    switch (e.key) {
      case 'ArrowLeft': next = Math.max(0, i - 1); break;
      case 'ArrowRight': next = Math.min(last, i + 1); break;
      case 'ArrowUp': next = i - columns >= 0 ? i - columns : i; break;
      case 'ArrowDown': next = i + columns <= last ? i + columns : i; break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      case 'Enter':
        if (e.shiftKey && onAltChange) {
          e.preventDefault();
          onAltChange(options[i].value);
        }
        return;
      default: return;
    }
    e.preventDefault();
    if (next !== i) focusAt(next);
  };

  return (
    <div
      ref={rootRef}
      className={[s.grid, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label']}
      style={{ '--columns': columns } as CSSProperties}
    >
      {options.map((o, i) => {
        const name = nameOf(o);
        return (
          <button
            key={o.value ?? `none-${i}`}
            type="button"
            className={s.swatch}
            aria-label={name}
            title={name}
            tabIndex={i === tabStop ? 0 : -1}
            aria-current={i === current ? 'true' : undefined}
            {...(o.value === null
              ? { 'data-none': '' }
              : { style: { '--swatch': o.value } as CSSProperties })}
            onClick={(e) => {
              if (e.shiftKey && onAltChange) onAltChange(o.value);
              else onChange(o.value);
            }}
            onContextMenu={onAltChange ? (e) => { e.preventDefault(); onAltChange(o.value); } : undefined}
            onKeyDown={onKeyDown(i)}
          />
        );
      })}
    </div>
  );
}

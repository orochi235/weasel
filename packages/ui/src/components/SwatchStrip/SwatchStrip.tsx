import { useId, useState, type ReactElement } from 'react';
import { getAlpha01 } from '@weasel-js/core';
import { SwatchGrid, type SwatchGridOption } from '../SwatchGrid';
import { Select } from '../Select';
import {
  RecentColorsProvider,
  normalizeRecentColor,
  useRecentColors,
  useRecentColorsStore,
  type RecentColorsStore,
} from '../RecentColors';
import { BUILTIN_PALETTES, type SwatchPalette } from './palettes';
import s from './SwatchStrip.module.css';

/** Props for {@link SwatchStrip}. */
export interface SwatchStripProps {
  /** The color to mark current, in either row. `null` marks "no paint". */
  value?: string | null;
  /** A swatch applied: click, Enter or Space. */
  onChange: (value: string | null) => void;
  /** The alternate target, as on {@link SwatchGrid}: shift-click,
   *  right-click, Shift+Enter. */
  onAltChange?: (value: string | null) => void;
  /** The preset palettes on offer. Default {@link BUILTIN_PALETTES}. More
   *  than one adds a picker. */
  palettes?: readonly SwatchPalette[];
  /** The shown palette's id, controlled. */
  palette?: string;
  /** The shown palette's id to start on, uncontrolled. Default: the first. */
  defaultPalette?: string;
  onPaletteChange?: (id: string) => void;
  /** Where the recent row reads from and applies record into. Default: the
   *  nearest {@link RecentColorsProvider}'s. With neither there is no recent
   *  row. */
  store?: RecentColorsStore;
  /** Swatches per row, for the recent row and any palette that sets none.
   *  Default 10. */
  columns?: number;
  'aria-label'?: string;
  className?: string;
}

/** A color as a screen reader should hear it: the hex, and the opacity
 *  when it is not opaque. Any other CSS color reads as written. */
export function describeColor(color: string): string {
  const c = normalizeRecentColor(color) ?? color;
  if (!c.startsWith('#') || c.length !== 9) return c;
  const alpha = Math.round(getAlpha01(c) * 100);
  return alpha === 100 ? c.slice(0, 7) : `${c.slice(0, 7)}, ${alpha}% opacity`;
}

function same(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return normalizeRecentColor(a) === normalizeRecentColor(b);
}

/**
 * The swatches a color picker sits beside: the recently used colors, most
 * recent first, above a preset palette. Applying any swatch records it, so
 * it moves to the head of the recent row — as does a color committed
 * through any other picker under the same {@link RecentColorsProvider}.
 *
 * Like {@link SwatchGrid} it applies nothing itself; `onChange` and
 * `onAltChange` hand the color to the app.
 */
export function SwatchStrip(props: SwatchStripProps): ReactElement {
  const { value, onChange, onAltChange, className } = props;
  const palettes = props.palettes ?? BUILTIN_PALETTES;
  const columns = props.columns ?? 10;
  const ctxStore = useRecentColorsStore();
  const store = props.store ?? ctxStore;
  const recent = useRecentColors(store);
  const recentHeading = useId();

  const [ownPalette, setOwnPalette] = useState(props.defaultPalette);
  const paletteId = props.palette ?? ownPalette;
  const shown = palettes.find((p) => p.id === paletteId) ?? palettes[0];
  const choosePalette = (id: string): void => {
    setOwnPalette(id);
    props.onPaletteChange?.(id);
  };

  const recentOptions: SwatchGridOption[] = recent.map((c) => ({ value: c, label: describeColor(c) }));
  // Match on the color, not its spelling, so `#F00` lights `#ff0000ff`.
  const currentIn = (options: readonly SwatchGridOption[]): string | null | undefined =>
    value === undefined ? undefined : options.find((o) => same(o.value, value))?.value;

  const grids = (
    <>
      {store && (
        <section className={s.section} aria-labelledby={recentHeading}>
          <div id={recentHeading} className={s.heading}>Recent</div>
          {recentOptions.length > 0 ? (
            <SwatchGrid
              aria-label="Recent colors"
              options={recentOptions}
              value={currentIn(recentOptions)}
              columns={columns}
              onChange={onChange}
              onAltChange={onAltChange}
            />
          ) : (
            <p className={s.empty}>No recent colors</p>
          )}
        </section>
      )}
      {shown && (
        <section className={s.section}>
          {palettes.length > 1 ? (
            <Select<string>
              label="Palette"
              orientation="row"
              options={palettes.map((p) => ({ value: p.id, label: p.name }))}
              selectedKey={shown.id}
              onSelectionChange={choosePalette}
            />
          ) : (
            <div className={s.heading}>{shown.name}</div>
          )}
          <SwatchGrid
            key={shown.id}
            aria-label={shown.name}
            options={shown.colors}
            value={currentIn(shown.colors)}
            columns={shown.columns ?? columns}
            onChange={onChange}
            onAltChange={onAltChange}
          />
        </section>
      )}
    </>
  );

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label'] ?? 'Swatches'}
    >
      {/* A store given by prop is where applies here record too. */}
      {props.store && props.store !== ctxStore
        ? <RecentColorsProvider store={props.store}>{grids}</RecentColorsProvider>
        : grids}
    </div>
  );
}

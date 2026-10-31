import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactElement, ReactNode } from 'react';
import { qty, type Display, type Quantity } from '@weasel-js/quantity';
import { Slider, type BoundsCtx, type Thumb } from '../Slider';
import type { ContinuousScaleFactory } from '@weasel-js/plot/scales';
import s from './BandEditor.module.css';
import { bandBounds, type Band } from './bands';
import { bandName } from './retag';
import { pct } from './track';

/** One arrow-key step, as a fraction of the track; `shift` takes ten. */
const KEY_STEP = 0.01;

/** A seam draws nothing of its own: its line is the stylesheet's. */
const SEAM_SHAPE = { render: () => null };

export interface BandStripProps<T, F extends Quantity> {
  /** The bands as drawn right now, mid-drag or not. */
  bands: Band<T>[];
  /** The same, with each `from` in the shape the consumer gave it. */
  shown: Band<T, F>[];
  /** The range's ends as drawn: the strip runs between them, and they bound the first and last seam. */
  lo: number;
  hi: number;
  /** Places a value along the strip, `lo` to `hi`. */
  scale: ContinuousScaleFactory;
  /** A value's place on the whole drawn axis, which an edge pulled past the track stretches, and back. */
  toUnit: (value: number) => number;
  fromUnit: (unit: number) => number;
  /** Values a dragged seam snaps to within `snapPx`; alt defeats it. */
  snapTo: number[] | undefined;
  snapPx: number;
  display: Display;
  selectedIndex: number | null | undefined;
  renderBand: ((band: Band<T, F>, index: number) => ReactNode) | undefined;
  onBandPointerDown: (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onBandFocus: (index: number) => () => void;
  onBandContextMenu: (index: number) => (e: ReactMouseEvent<HTMLButtonElement>) => void;
  /** The seams' values, live during a drag. */
  onInput: (seams: number[]) => void;
  /** The seams' values at the end of a drag or on a keystroke. */
  onChange: (seams: number[]) => void;
  onCancel: () => void;
}

const values = (thumbs: readonly Thumb[]): number[] => thumbs.map((t) => t.value);

/**
 * The bands as a `Slider`: each seam is a thumb held between its neighbors,
 * and each band is the region between two seams, which a drag moves whole.
 */
export function BandStrip<T, F extends Quantity>(props: BandStripProps<T, F>): ReactElement {
  const { bands, shown, lo, hi, scale, display, selectedIndex } = props;
  const neighbors = ({ thumbs, index }: BoundsCtx): [number, number] =>
    [thumbs[index - 1]?.value ?? lo, thumbs[index + 1]?.value ?? hi];
  const thumbs: Thumb[] = bands.slice(1).map((band, k) => ({
    value: band.from,
    label: `Seam ${k + 1}`,
    valueText: qty(shown[k + 1]!.from, display).spoken,
    bounds: neighbors,
  }));
  const { toUnit, fromUnit } = props;

  const renderRegion = ({ index: i }: { index: number }): ReactNode => {
    const [from, to] = bandBounds(bands, i, lo, hi);
    const isSelected = selectedIndex === i;
    const pinned = i === 0 || i === bands.length - 1;
    return (
      <button
        type="button"
        className={[s.band, isSelected && s.selected, bands[i]!.locked && s.locked, pinned && s.pinned].filter(Boolean).join(' ')}
        aria-label={bandName(shown, i, from, to, display)}
        aria-pressed={isSelected}
        data-band-index={i}
        onPointerDown={props.onBandPointerDown(i)}
        onFocus={props.onBandFocus(i)}
        onContextMenu={props.onBandContextMenu(i)}
      >
        <span className={s.bandContent}>{props.renderBand?.(shown[i]!, i)}</span>
      </button>
    );
  };

  // Narrower than the axis only while an end is pulled inward, which leaves the track it vacated empty.
  const box = { '--be-from': pct(toUnit(lo)), '--be-to': pct(toUnit(hi)) } as CSSProperties;
  return (
    <div className={s.stripBox} style={box} data-band-strip="">
      <Slider
        className={s.strip}
        thumbs={thumbs}
        min={lo}
        max={hi}
        scale={scale}
        stops={props.snapTo}
        showStops={false}
        stopSnapPx={props.snapPx}
        keyStep={(thumb, steps) => fromUnit(toUnit(thumb.value) + steps * KEY_STEP)}
        trackClick="none"
        thumbFit="overhang"
        thumbShape={SEAM_SHAPE}
        renderRegion={renderRegion}
        regionDrag
        onInput={(next) => props.onInput(values(next))}
        onChange={(next) => props.onChange(values(next))}
        onCancel={props.onCancel}
      />
    </div>
  );
}

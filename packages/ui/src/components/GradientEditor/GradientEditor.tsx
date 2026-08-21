import { useCallback, type ReactElement } from 'react';
import {
  sampleGradientStops,
  withGradientKind,
  type GradStop,
  type GradientFill,
  type GradientKind,
} from '@weasel-js/core';
import { Slider, type Thumb } from '../Slider';
import { ColorField } from '../ColorField';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import { paintGradientTrack } from '../../paintGradientTrack';
import s from './GradientEditor.module.css';

const KINDS: readonly ToggleBarItem<GradientKind>[] = [
  { value: 'linear-gradient', label: 'Linear' },
  { value: 'radial-gradient', label: 'Radial' },
  { value: 'conic-gradient', label: 'Conic' },
];

/** Fewer than two stops is not a gradient any renderer can ramp between. */
const MIN_STOPS = 2;

/**
 * Props for {@link GradientEditor}. `onInput` fires throughout a gesture and
 * `onChange` once at its end.
 */
export interface GradientEditorProps {
  /** The gradient being edited. */
  value: GradientFill;
  /**
   * Live value during a gesture — a stop drag, a color-picker scrub. Wire
   * it for preview; it fires many times per gesture and must not be
   * written to history.
   */
  onInput?: (next: GradientFill) => void;
  /** Committed value: one call per completed gesture. Pair with an
   *  undoable write. */
  onChange: (next: GradientFill) => void;
  /** Show the linear / radial / conic switch. Default true; turn it off
   *  when the surrounding UI already owns the kind. */
  kindSwitch?: boolean;
  className?: string;
}

type StopThumb = Thumb & { color: string };

/**
 * Editor for a gradient's kind and stop list.
 *
 * Geometry (`from`/`to`, `center`, `radius`, `angle`) is deliberately not
 * edited here — on a canvas that belongs on the artwork, via
 * `<GradientHandles>`. This component owns the parts with no spatial
 * meaning, so it composes into a properties panel at any width.
 *
 * Stops are addressed by their position in `value.stops`, which is never
 * reordered — dragging one stop past another leaves both indices alone, so
 * a drag can cross a neighbour without the two swapping under the pointer.
 * Rendering sorts a copy.
 */
export function GradientEditor(props: GradientEditorProps): ReactElement {
  const { value, onInput, onChange, kindSwitch = true, className } = props;
  const stops = value.stops;

  const withStops = useCallback(
    (next: GradStop[]): GradientFill => ({ ...value, stops: next }),
    [value],
  );

  const thumbs: StopThumb[] = stops.map((stop) => ({ value: stop.offset, color: stop.color }));

  const applyThumbs = (next: StopThumb[]): GradStop[] =>
    next.map((t) => ({ offset: t.value, color: t.color }));

  const setStopColor = (index: number, color: string): GradStop[] =>
    stops.map((stop, i) => (i === index ? { ...stop, color } : stop));

  // Sorted view for the swatch row, carrying each stop's real index so a
  // recolor writes back to the right entry.
  const ordered = stops
    .map((stop, index) => ({ stop, index }))
    .sort((a, b) => a.stop.offset - b.stop.offset);

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      {kindSwitch && (
        <ToggleBar<GradientKind>
          items={KINDS}
          value={value.fill}
          size="sm"
          ariaLabel="Gradient kind"
          onChange={(kind) => kind && onChange(withGradientKind(value, kind))}
        />
      )}

      <Slider<StopThumb>
        min={0}
        max={1}
        step={0.005}
        constraint="free"
        thumbs={thumbs}
        ariaLabel="Gradient stops"
        readoutPlacement="none"
        onInput={(next) => onInput?.(withStops(applyThumbs(next)))}
        onChange={(next) => onChange(withStops(applyThumbs(next)))}
        onAddThumb={(at) => ({ value: at, color: sampleGradientStops(stops, at) })}
        onRemoveThumb={() => stops.length > MIN_STOPS}
        renderTrack={paintGradientTrack({
          gradient: (t) => sampleGradientStops(stops, t),
          samples: 32,
        })}
      />

      <div className={s.swatches}>
        {ordered.map(({ stop, index }) => (
          <ColorField
            key={index}
            value={stop.color}
            alpha
            aria-label={`Stop ${index + 1} at ${Math.round(stop.offset * 100)}%`}
            className={s.swatch}
            onInput={(hex) => onInput?.(withStops(setStopColor(index, hex)))}
            onChange={(hex) => onChange(withStops(setStopColor(index, hex)))}
          />
        ))}
      </div>
    </div>
  );
}

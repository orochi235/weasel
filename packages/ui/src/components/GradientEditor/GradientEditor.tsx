import { type ReactElement, type ReactNode } from 'react';
import {
  isGradientFill,
  sampleGradientStops,
  switchGradientKind,
  useGradientKinds,
  usePaintKind,
  type ColorSpace,
  type FillStyle,
  type GradStop,
  type GradientFill,
  type PaintKind,
} from '@weasel-js/core';
import { nativeSvgKind, nativeSvgSpace } from '@weasel-js/svg';
import { Slider, type Thumb } from '../Slider';
import { ColorField } from '../ColorField';
import { MeshEditor, isMeshPaint } from '../MeshEditor';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import { paintGradientTrack } from '../../paintGradientTrack';
import s from './GradientEditor.module.css';

const SPACES: readonly ToggleBarItem<ColorSpace>[] = [
  { value: 'rgb', label: 'sRGB' },
  { value: 'oklab', label: 'OKLab' },
  { value: 'oklch', label: 'OKLCh' },
];

/** Fewer than two stops is not a gradient any renderer can ramp between. */
const MIN_STOPS = 2;

/**
 * Props for {@link GradientEditor}. `onInput` fires throughout a gesture and
 * `onChange` once at its end.
 */
export interface GradientEditorProps {
  /** The gradient being edited: a paint of any gradient kind — one that
   *  `listGradientKinds` returns. */
  value: FillStyle;
  /**
   * Live value during a gesture — a stop drag, a color-picker scrub. Wire
   * it for preview; it fires many times per gesture and must not be
   * written to history.
   */
  onInput?: (next: FillStyle) => void;
  /** Committed value: one call per completed gesture. Pair with an
   *  undoable write. */
  onChange: (next: FillStyle) => void;
  /** Show the kind switch — every registered gradient kind. Default true;
   *  turn it off when the surrounding UI already owns the kind. */
  kindSwitch?: boolean;
  /** Show the sRGB / OKLab / OKLCh switch, which writes `interpolate`.
   *  Default true. */
  spaceSwitch?: boolean;
  /**
   * Offer only what an SVG file carries natively: the linear and radial
   * gradients, which SVG has elements for, blended in sRGB, the only space
   * every SVG renderer honors. A conic or mesh gradient exports as a weasel
   * element that other renderers paint as one flat color, and an OKLab or
   * OKLCh blend exports as an attribute they ignore. A value already outside
   * that set keeps its own kind and space on offer, so it can be switched
   * back. Default false.
   */
  svg?: boolean;
  className?: string;
}

type StopThumb = Thumb & { color: string };

/**
 * Editor for a gradient's kind and colors: the stop list of a linear, radial
 * or conic gradient, a mesh's corner colors, or a registered kind's own
 * `Editor`. Switching kind goes through `switchGradientKind`, so the colors
 * carry across.
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
  const { value, onInput, onChange, kindSwitch = true, spaceSwitch = true, svg = false, className } = props;
  const kind: PaintKind = value.fill ?? 'solid';
  const space: ColorSpace = (value as { interpolate?: ColorSpace }).interpolate ?? 'rgb';

  const entry = usePaintKind(kind);
  const kinds: readonly ToggleBarItem<PaintKind>[] = useGradientKinds()
    .filter((entry) => !svg || nativeSvgKind(entry.id) || entry.id === kind)
    .map((entry) => ({ value: entry.id, label: entry.label }));
  const spaces = SPACES.filter((item) => !svg || nativeSvgSpace(item.value) || item.value === space);

  const switchKind = (next: PaintKind): void => {
    const converted = switchGradientKind(value, next);
    if (converted && converted !== value) onChange(converted);
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      {kindSwitch && (
        <ToggleBar<PaintKind>
          items={kinds}
          value={kind}
          size="sm"
          ariaLabel="Gradient kind"
          onChange={(next) => next && switchKind(next)}
        />
      )}

      {renderBody()}
    </div>
  );

  function renderBody(): ReactElement {
    const spaceBar = spaceSwitch && spaces.length > 1 && (
      <ToggleBar<ColorSpace>
        items={spaces}
        value={space}
        size="sm"
        ariaLabel="Blend space"
        onChange={(next) => next && onChange({ ...value, interpolate: next } as FillStyle)}
      />
    );
    // A registered `Editor` wins even for a built-in id, as it does in `PaintInput`.
    if (entry?.Editor) {
      const Editor = entry.Editor;
      return <><Editor value={value} onInput={onInput} onChange={onChange} />{spaceBar}</>;
    }
    if (isGradientFill(value)) {
      return <StopsBody value={value} spaceBar={spaceBar} onInput={onInput} onChange={onChange} />;
    }
    if (isMeshPaint(value)) {
      return <><MeshEditor value={value} spaceSwitch={false} onInput={onInput} onChange={onChange} />{spaceBar}</>;
    }
    return <div className={s.noEditor}>{entry?.label ?? kind}: no editor</div>;
  }
}

/** The stop slider and swatch row of a linear, radial or conic gradient. */
function StopsBody(props: {
  value: GradientFill;
  spaceBar: ReactNode;
  onInput?: (next: FillStyle) => void;
  onChange: (next: FillStyle) => void;
}): ReactElement {
  const { value, spaceBar, onInput, onChange } = props;
  const stops = value.stops;
  const space = value.interpolate ?? 'rgb';

  const withStops = (next: GradStop[]): GradientFill => ({ ...value, stops: next });

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
    <>
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
        onAddThumb={(at) => ({ value: at, color: sampleGradientStops(stops, at, space) })}
        onRemoveThumb={() => stops.length > MIN_STOPS}
        renderTrack={paintGradientTrack({
          gradient: (t) => sampleGradientStops(stops, t, space),
          // The track lerps between samples in sRGB whatever the gradient does,
          // so a hue arc needs more of them to not read as a straight line.
          samples: space === 'rgb' ? 32 : 64,
        })}
      />

      {spaceBar}

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
    </>
  );
}

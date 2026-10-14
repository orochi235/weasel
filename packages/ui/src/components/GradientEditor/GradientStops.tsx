import { useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { sampleGradientStops, type GradStop, type GradientPaint, type Paint } from '@weasel-js/core';
import { Slider, type Thumb } from '../Slider';
import { paintGradientTrack } from '../../paintGradientTrack';
import { POSITION_FORMAT, StopEditor } from './StopEditor';
import { stopOrder, useStopSelection } from './useStopSelection';
import s from './GradientStops.module.css';

/** Fewer than two stops is not a gradient any renderer can ramp between. */
const MIN_STOPS = 2;

const HANDLE = '[role="slider"]';

const position = new Intl.NumberFormat('en-US', POSITION_FORMAT);

type StopThumb = Thumb & { color: string };

/** A handle's face: the stop's own color over the checker, so a translucent stop reads as one. */
function StopFace({ color, selected }: { color: string; selected: boolean }): ReactElement {
  return (
    <span
      className={s.stop}
      data-stop=""
      data-selected={selected ? '' : undefined}
      style={{ '--stop': color } as CSSProperties}
    />
  );
}

/** Props for {@link GradientStops}. */
export interface GradientStopsProps {
  value: GradientPaint;
  /** Drawn under the stop editor: the blend-space switch, when the editor shows one. */
  spaceBar: ReactNode;
  selectedStop?: number;
  onSelectedStopChange?: (index: number) => void;
  /** The editor around this is inert, so nothing here can be removed. */
  disabled?: boolean;
  onInput?: (next: Paint) => void;
  onChange: (next: Paint) => void;
}

/**
 * The stops of a linear, radial or conic gradient: a track carrying one handle
 * per stop, and under it the editor for the one selected stop. A handle is
 * selected by taking focus, which a press on it gives it.
 */
export function GradientStops(props: GradientStopsProps): ReactElement {
  const { value, spaceBar, onInput, onChange } = props;
  const stops = value.stops;
  const space = value.interpolate ?? 'rgb';
  const order = stopOrder(stops);
  const { selected, select, removing } = useStopSelection(stops, props.selectedStop, props.onSelectedStopChange);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const handleEls = (): HTMLElement[] => Array.from(trackRef.current?.querySelectorAll<HTMLElement>(HANDLE) ?? []);
  // A handle to focus once the list has the length the edit leaves it at: one just added, or the neighbor of one removed.
  const focusNext = useRef<{ index: number; count: number } | null>(null);
  useEffect(() => {
    const want = focusNext.current;
    if (!want || want.count !== stops.length) return;
    focusNext.current = null;
    handleEls()[want.index]?.focus();
  });

  const withStops = (next: GradStop[]): GradientPaint => ({ ...value, stops: next });
  const edited = (patch: Partial<GradStop>): GradientPaint =>
    withStops(stops.map((stop, i) => (i === selected ? { ...stop, ...patch } : stop)));
  const fromThumbs = (next: StopThumb[]): GradientPaint =>
    withStops(next.map((t) => ({ offset: t.value, color: t.color })));

  const removable = !props.disabled && stops.length > MIN_STOPS;
  const remove = (index: number, refocus: boolean): void => {
    if (!removable) return;
    const next = removing(index);
    if (refocus) focusNext.current = { index: next, count: stops.length - 1 };
    onChange(withStops(stops.filter((_, i) => i !== index)));
  };

  const thumbs: StopThumb[] = stops.map((stop, index) => ({
    value: stop.offset,
    color: stop.color,
    label: String(order.indexOf(index) + 1),
    valueText: position.format(stop.offset),
    shape: { render: () => <StopFace color={stop.color} selected={index === selected} /> },
  }));

  const paintTrack = paintGradientTrack({
    gradient: (t) => sampleGradientStops(stops, t, space),
    // The track lerps between samples in sRGB whatever the gradient does,
    // so a hue arc needs more of them to not read as a straight line.
    samples: space === 'rgb' ? 32 : 64,
  });

  return (
    <>
      <div
        ref={trackRef}
        onFocus={(e) => {
          const index = handleEls().indexOf(e.target as HTMLElement);
          if (index >= 0) select(index);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Delete' && e.key !== 'Backspace') return;
          const index = handleEls().indexOf(e.target as HTMLElement);
          if (index < 0) return;
          e.preventDefault();
          remove(index, true);
        }}
      >
        <Slider<StopThumb>
          className={s.track}
          min={0}
          max={1}
          step={0.005}
          constraint="free"
          thumbs={thumbs}
          ariaLabel="Gradient stop"
          readoutPlacement="none"
          onInput={(next) => onInput?.(fromThumbs(next))}
          onChange={(next) => onChange(fromThumbs(next))}
          onAddThumb={(at) => {
            select(stops.length);
            focusNext.current = { index: stops.length, count: stops.length + 1 };
            return { value: at, color: sampleGradientStops(stops, at, space) };
          }}
          onRemoveThumb={(index) => {
            if (!removable) return false;
            removing(index);
            return true;
          }}
          renderTrack={(ctx) => (
            <>
              <div className={s.checker} />
              {paintTrack(ctx)}
            </>
          )}
        />
      </div>

      {stops.length > 0 && <StopEditor
        stop={stops[selected]}
        place={order.indexOf(selected) + 1}
        count={stops.length}
        removable={removable}
        onColorInput={(color) => onInput?.(edited({ color }))}
        onColorChange={(color) => onChange(edited({ color }))}
        onOffsetChange={(offset) => onChange(edited({ offset }))}
        // The button goes inert at the last two stops and would drop focus on the page.
        onRemove={() => remove(selected, stops.length - 1 <= MIN_STOPS)}
      />}

      {spaceBar}
    </>
  );
}

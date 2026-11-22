import { useMemo, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { sampleGradientStops, type GradStop, type GradientPaint, type Paint } from '@weasel-js/paint';
import { Slider, type Thumb } from '../Slider';
import { paintGradientTrack } from '../Slider/paintGradientTrack';
import { POSITION_FORMAT, StopEditor } from './StopEditor';
import { stopOrder, useStopSelection } from './useStopSelection';
import s from './GradientStops.module.css';
import { useFieldLocale } from '../../useFieldLocale';
import { useEditDraft } from '../../useEditDraft';
import { useFocusAfterCommit } from './useFocusAfterCommit';

/** Fewer than two stops is not a gradient any renderer can ramp between. */
const MIN_STOPS = 2;

const HANDLE = '[role="slider"]';


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
  onSelectionChange?: (index: number) => void;
  /** The editor around this is inert, so nothing here can be removed. */
  disabled?: boolean;
  /** A read-only scope holds the editor: the stops' own controls refuse their edits, and nothing is removed. */
  readOnly?: boolean;
  onInput?: (next: Paint) => void;
  onChange: (next: Paint) => void;
  onCancel?: () => void;
}

/**
 * The stops of a linear, radial or conic gradient: a track carrying one handle
 * per stop, and under it the editor for the one selected stop. A handle is
 * selected by taking focus, which a press on it gives it.
 */
export function GradientStops(props: GradientStopsProps): ReactElement {
  const { spaceBar } = props;
  const { shown: value, onInput, onChange, onCancel } = useEditDraft<GradientPaint>(props.value, props);
  const stops = value.stops;
  const space = value.interpolate ?? 'rgb';
  const order = stopOrder(stops);
  const locale = useFieldLocale();
  const position = useMemo(() => new Intl.NumberFormat(locale, POSITION_FORMAT), [locale]);
  const { selected, select, afterRemoval } = useStopSelection(stops, props.selectedStop, props.onSelectionChange);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const handleEls = (): HTMLElement[] => Array.from(trackRef.current?.querySelectorAll<HTMLElement>(HANDLE) ?? []);
  const focusNext = useFocusAfterCommit(stops.length, (index, how) => {
    select(index, how.report);
    if (how.focus) handleEls()[index]?.focus();
  });
  const commit = (next: GradientPaint): void => {
    focusNext.committing();
    onChange(next);
  };
  const cancel = (): void => { focusNext.drop(); onCancel(); };

  const withStops = (next: GradStop[]): GradientPaint => ({ ...value, stops: next });
  const edited = (patch: Partial<GradStop>): GradientPaint =>
    withStops(stops.map((stop, i) => (i === selected ? { ...stop, ...patch } : stop)));
  const fromThumbs = (next: StopThumb[]): GradientPaint =>
    withStops(next.map((t) => ({ offset: t.value, color: t.color })));

  const removable = !props.disabled && !props.readOnly && stops.length > MIN_STOPS;
  // Handles are keyed by index, so focus left on the track would stay on whatever stop shifts into its place.
  const removed = (index: number, refocus: boolean): void => {
    const { next, lost } = afterRemoval(index);
    const focus = refocus || (trackRef.current?.contains(document.activeElement) ?? false);
    focusNext.request(next, stops.length - 1, { focus, report: lost });
  };
  const remove = (index: number, refocus: boolean): void => {
    if (!removable) return;
    removed(index, refocus);
    commit(withStops(stops.filter((_, i) => i !== index)));
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
          aria-label="Gradient stop"
          readoutPlacement="none"
          onInput={(next) => onInput(fromThumbs(next))}
          onChange={(next) => commit(fromThumbs(next))}
          onCancel={cancel}
          onAddThumb={(at) => {
            focusNext.request(stops.length, stops.length + 1, { focus: true, report: false });
            return { value: at, color: sampleGradientStops(stops, at, space) };
          }}
          onRemoveThumb={(index) => {
            if (!removable) return false;
            removed(index, false);
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
        onColorInput={(color) => onInput(edited({ color }))}
        onColorChange={(color) => onChange(edited({ color }))}
        onColorCancel={onCancel}
        onOffsetChange={(offset) => onChange(edited({ offset }))}
        // The button goes inert at the last two stops and would drop focus on the page.
        onRemove={() => remove(selected, stops.length - 1 <= MIN_STOPS)}
      />}

      {spaceBar}
    </>
  );
}

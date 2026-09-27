import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/core';
import s from './BandEditor.module.css';
import { SNAP_RADIUS_PX, snapToNearest } from '../../snap';
import { clamp01, resolveScale, type BandScale } from './scale';
import {
  bandBounds,
  clampBandShift,
  clampSeamTo,
  mergeBand,
  moveBandEdges,
  normalizeBands,
  seamBounds,
  setSeam,
  splitBands,
  unitEdges,
  type Band,
} from './bands';

export type { Band, BandScale };

export interface BandEditorProps<T> {
  /** Ascending by `from`. `value[0].from` is normalized to `min` on read. */
  value: Band<T>[];
  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: Band<T>[]) => void;
  /** Committed at gesture end: one call per gesture. */
  onChange: (next: Band<T>[]) => void;
  min: number;
  max: number;
  /** Default `'log'`. */
  scale?: 'linear' | 'log' | BandScale;
  ticks?: { at: number; label?: ReactNode }[];
  /** Snap a dragged seam to a tick within ~6px. Default true; `alt` defeats it per-drag. */
  snap?: boolean;
  renderBand?: (band: Band<T>, index: number) => ReactNode;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  /** Payload for a band split off an existing one. Default duplicates `from`. */
  splitBand?: (at: number, from: T) => T;
  label?: ReactNode;
  className?: string;
}

/** A drag under way: the bands as the pointer has them, and which edges it took from where. */
type Draft<T> = { bands: Band<T>[]; ghost: { seam: number } | { band: number } };

/** One arrow-key step, as a fraction of the track. */
const KEY_STEP = 0.01;

function pct(unit: number): string {
  return `${clamp01(unit) * 100}%`;
}

function keepData<T>(_at: number, from: T): T {
  return from;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Divides a numeric axis into contiguous bands and lets you drag the seams
 * between them. Each band carries a payload the consumer supplies and
 * renders through `renderBand`; the control itself knows nothing about what
 * a band means.
 *
 * The axis is always fully covered — N bands, N−1 interior seams, no gaps and
 * no overlaps — so editing is editing a sorted list of seam positions. Seams
 * clamp at their neighbours rather than crossing, which means a drag can
 * never destroy a band: removal is only ever the explicit `x` / `Delete`
 * merge. The first band is doubly exceptional, its left edge pinned to `min`
 * and its body immovable, and it has no left neighbour to merge into.
 *
 * | Gesture | Effect |
 * |---|---|
 * | drag a seam | resize the two bands either side |
 * | drag a band body | move both its seams, preserving its span |
 * | click the ruler | split the band under the pointer |
 * | `x` / `Delete` | merge the selected band into its left neighbour |
 * | click a band | select it |
 * | `←` `→` on a focused seam | move it by one step; `shift` for ten |
 *
 * `scale` defaults to `'log'`, because the interesting part of a width axis
 * is usually its narrow end.
 */
export function BandEditor<T>(props: BandEditorProps<T>): ReactElement {
  const {
    value,
    onInput,
    onChange,
    min,
    max,
    scale,
    ticks,
    renderBand,
    selectedIndex,
    onSelect,
    label,
    className,
  } = props;
  const snap = props.snap ?? true;
  const splitBand = props.splitBand ?? keepData;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PointerSession | null>(null);
  useEffect(() => () => { sessionRef.current?.cancel(); }, []);
  const labelId = useId();
  const [draft, setDraft] = useState<Draft<T> | null>(null);
  const committed = normalizeBands(value, min);
  // Drawn from the drag while one is under way, so the control moves with the pointer whether or not the consumer
  // wires `onInput`. Every edit reads `committed`.
  const bands = draft?.bands ?? committed;
  const sc = resolveScale(scale, min);
  const toUnit = (v: number): number => clamp01(sc.toUnit(v, min, max));
  const fromUnit = (u: number): number => sc.fromUnit(clamp01(u), min, max);

  const trackWidth = (): number => trackRef.current?.getBoundingClientRect().width ?? 0;

  const unitAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  };

  const snapped = (unit: number, altKey: boolean): number => {
    if (!snap || altKey || !ticks || ticks.length === 0) return unit;
    const width = trackWidth();
    if (width === 0) return unit;
    return snapToNearest(unit, ticks.map((tick) => toUnit(tick.at)), SNAP_RADIUS_PX / width);
  };

  // No pointer capture: a band body is a `<button>` whose content the consumer
  // renders, and capture would retarget pointerup and kill the click on it.
  // A drag that ends without a release commits nothing.
  const drag = (
    down: ReactPointerEvent<HTMLElement>,
    onMove: (ev: PointerEvent) => void,
    onEnd: () => void,
  ): void => {
    sessionRef.current?.cancel();
    sessionRef.current = openPointerSession(down.currentTarget, down, {
      onMove,
      onEnd: () => { sessionRef.current = null; setDraft(null); onEnd(); },
      onCancel: () => { sessionRef.current = null; setDraft(null); },
    }, { capture: false });
  };

  const onSeamPointerDown = (index: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    const base = committed;
    let latest: Band<T>[] | null = null;
    drag(
      e,
      (ev) => {
        const to = clampSeamTo(base, index, fromUnit(snapped(unitAt(ev.clientX), ev.altKey)), min, max);
        latest = setSeam(base, index, to);
        setDraft({ bands: latest, ghost: { seam: index } });
        onInput?.(latest);
      },
      () => {
        if (latest) onChange(latest);
      },
    );
  };

  const onSeamKeyDown = (index: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const [lo, hi] = seamBounds(committed, index, min, max);
    let target: number;
    if (e.key === 'Home') target = lo;
    else if (e.key === 'End') target = hi;
    else {
      let delta = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = e.shiftKey ? KEY_STEP * 10 : KEY_STEP;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = e.shiftKey ? -KEY_STEP * 10 : -KEY_STEP;
      else return;
      target = fromUnit(toUnit(committed[index + 1].from) + delta);
    }
    e.preventDefault();
    const next = setSeam(committed, index, clampSeamTo(committed, index, target, min, max));
    if (next !== committed) onChange(next);
  };

  const onBandPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    if (index !== selectedIndex) onSelect?.(index);
    // The first and last bands' outer edges are `min` and `max`, which do not
    // move, so their bodies have nothing to translate.
    if (index === 0 || index === committed.length - 1) return;
    const base = committed;
    const edges = unitEdges(base, sc, min, max);
    const startUnit = unitAt(e.clientX);
    let latest: Band<T>[] | null = null;
    drag(
      e,
      (ev) => {
        const shift = clampBandShift(edges, index, unitAt(ev.clientX) - startUnit);
        latest = moveBandEdges(
          base,
          index,
          fromUnit(edges[index] + shift),
          fromUnit(edges[index + 1] + shift),
        );
        setDraft({ bands: latest, ghost: { band: index } });
        onInput?.(latest);
      },
      () => {
        if (latest) onChange(latest);
      },
    );
  };

  const onBandFocus = (index: number) => (): void => {
    if (index !== selectedIndex) onSelect?.(index);
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    const next = splitBands(committed, fromUnit(unitAt(e.clientX)), min, max, splitBand);
    if (next !== committed) onChange(next);
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'x' && e.key !== 'Delete') return;
    // `x` is a bare letter and Cmd/Ctrl+X is cut: neither may be swallowed
    // when the keystroke belongs to something a consumer put in a band.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTextEntry(e.target)) return;
    if (selectedIndex === null || selectedIndex === undefined) return;
    const next = mergeBand(committed, selectedIndex);
    if (next === committed) return;
    e.preventDefault();
    onChange(next);
    onSelect?.(selectedIndex - 1);
  };

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={typeof label === 'string' ? label : undefined}
      aria-labelledby={label !== undefined && typeof label !== 'string' ? labelId : undefined}
      onKeyDown={onRootKeyDown}
    >
      {label !== undefined && <div id={labelId} className={s.label}>{label}</div>}
      <div className={s.ruler} ref={trackRef} data-band-ruler="" onPointerDown={onTrackPointerDown}>
        {ticks?.map((tick, i) => (
          <span
            key={i}
            className={s.tick}
            data-tick-at={tick.at}
            style={{ '--be-at': pct(toUnit(tick.at)) } as CSSProperties}
          >
            {tick.label !== undefined && <span className={s.tickLabel}>{tick.label}</span>}
          </span>
        ))}
      </div>
      <div className={s.bands}>
        {bands.map((band, i) => {
          const [from, to] = bandBounds(bands, i, min, max);
          const isSelected = selectedIndex === i;
          return (
            <Fragment key={i}>
              <button
                type="button"
                className={[s.band, isSelected ? s.selected : null].filter(Boolean).join(' ')}
                style={{ '--be-from': pct(toUnit(from)), '--be-to': pct(toUnit(to)) } as CSSProperties}
                aria-label={`Band ${i + 1}`}
                aria-pressed={isSelected}
                data-band-index={i}
                onPointerDown={onBandPointerDown(i)}
                onFocus={onBandFocus(i)}
              >
                <span className={s.bandContent}>{renderBand?.(band, i)}</span>
              </button>
              {i < bands.length - 1 && (
                <div
                  role="slider"
                  tabIndex={0}
                  className={s.seam}
                  style={{ '--be-at': pct(toUnit(bands[i + 1].from)) } as CSSProperties}
                  aria-label={`Seam ${i + 1}`}
                  aria-orientation="horizontal"
                  aria-valuemin={seamBounds(bands, i, min, max)[0]}
                  aria-valuemax={seamBounds(bands, i, min, max)[1]}
                  aria-valuenow={bands[i + 1].from}
                  data-seam-index={i}
                  onPointerDown={onSeamPointerDown(i)}
                  onKeyDown={onSeamKeyDown(i)}
                />
              )}
            </Fragment>
          );
        })}
        {draft && 'band' in draft.ghost && (
          <div
            className={s.bandGhost}
            data-band-ghost=""
            aria-hidden="true"
            style={{
              '--be-from': pct(toUnit(bandBounds(committed, draft.ghost.band, min, max)[0])),
              '--be-to': pct(toUnit(bandBounds(committed, draft.ghost.band, min, max)[1])),
            } as CSSProperties}
          />
        )}
        {draft && 'seam' in draft.ghost && (
          <div
            className={s.seamGhost}
            data-band-ghost=""
            aria-hidden="true"
            style={{ '--be-at': pct(toUnit(committed[draft.ghost.seam + 1].from)) } as CSSProperties}
          />
        )}
      </div>
    </div>
  );
}

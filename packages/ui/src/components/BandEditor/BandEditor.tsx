import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { openPointerSession, pastDragThreshold, type PointerSession } from '@weasel-js/core';
import { focusedControlOwnsKey, isEditableTarget } from '@weasel-js/gestures';
import { decimal, type Display, type Quantity } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import { QuantityText } from '../QuantityText';
import { snapToNearest, useSnapRadiusPx } from '../../snap';
import { clamp01, resolveScale, type BandScale } from './scale';
import { bandName, retagBands, untag } from './retag';
import { pct } from './track';
import { RangeEdgeHandle, type RangeEdit } from './RangeEdgeHandle';
import { DraftGhost, type DraftGhostAt } from './DraftGhost';
import { Ruler, rulerDisplay, type BandTick } from './Ruler';
import { SeamHandle } from './SeamHandle';
import {
  bandBounds,
  clampBandShift,
  mergeBand,
  moveBandEdges,
  normalizeBands,
  splitBands,
  toggleLock,
  unitEdges,
  type Band,
  type RangeEdge,
} from './bands';

export type { Band, BandScale, RangeEdge, BandTick };

/** Props for {@link BandEditor}. */
export interface BandEditorProps<T, F extends Quantity = number> {
  /** Ascending by `from`. `value[0].from` is normalized to `min` on read. A
   *  tagged `from` stays tagged through every edit, with its display and unit. */
  value: Band<T, F>[];
  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: Band<T, F>[]) => void;
  /** Committed at gesture end: one call per gesture. */
  onChange: (next: Band<T, F>[]) => void;
  min: number;
  max: number;
  /**
   * Makes `min` and `max` draggable. Dragging an end rescales the whole
   * sequence with the other end held: locked bands keep their length and the
   * rest stretch in proportion. Carries the refitted bands too, so one gesture
   * is one call, at its end — `onChange` is not called for it. Without it the
   * range is fixed and no edge handles are drawn.
   */
  onRangeChange?: (min: number, max: number, bands: Band<T, F>[]) => void;
  /** Live during an edge drag — wire for preview, do not write to history. */
  onRangeInput?: (min: number, max: number, bands: Band<T, F>[]) => void;
  /** How far outward `min` and `max` may be dragged. Default unbounded. */
  limits?: readonly [number, number];
  /** Default `'log'`. */
  scale?: 'linear' | 'log' | BandScale;
  /**
   * A tick with no `label` of its own is labeled through `display`, when given. Where labels
   * would crowd, some give way and leave their notch unlabeled; see {@link BandTick.level}.
   */
  ticks?: BandTick[];
  /**
   * How a seam's value shows and is spoken — `fraction()` makes a seam at
   * 1/12 announce `1 over 12` rather than `0.08333333333333333`. A tagged
   * `from` uses its own display instead. Default: three decimals.
   */
  display?: Display;
  /** Snap a dragged seam to a tick within ~6px. Default true; `alt` defeats it per-drag. */
  snap?: boolean;
  renderBand?: (band: Band<T, F>, index: number) => ReactNode;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
  /** Payload for a band split off an existing one. Default duplicates `from`. */
  splitBand?: (at: number, from: T) => T;
  label?: ReactNode;
  className?: string;
}

/** A drag under way: the bands and range as the pointer has them, and which edges it took from where. */
type Draft<T> = {
  bands: Band<T>[];
  range?: [number, number];
  ghost: DraftGhostAt;
};

const SEAM_DISPLAY = decimal();

function keepData<T>(_at: number, from: T): T {
  return from;
}

/**
 * Divides a numeric axis into contiguous bands and lets you drag the seams
 * between them. Each band carries a payload the consumer supplies and
 * renders through `renderBand`.
 *
 * The range is always fully covered — N bands, N−1 interior seams, no gaps and
 * no overlaps. Seams clamp at their neighbors rather than crossing, so a drag
 * can never destroy a band: removal is only ever the explicit `x` / `Delete`
 * merge. The first band has its left edge pinned to `min` and its body
 * immovable, and it has no left neighbor to merge into.
 *
 * | Gesture | Effect |
 * |---|---|
 * | drag a seam | resize the two bands either side |
 * | drag `min` / `max` | rescale the whole range, locked bands holding their length (with `onRangeChange`) |
 * | right-click a band, or `l` | lock or unlock it |
 * | drag a band body | move both its seams, preserving its span |
 * | click the ruler | split the band under the pointer |
 * | `s` | split the selected band at the middle of its drawn span |
 * | `x` / `Delete` | merge the selected band into its left neighbor |
 * | click a band | select it |
 * | `←` `→` on a focused seam | move it by one step; `shift` for ten |
 */
export function BandEditor<T, F extends Quantity = number>(props: BandEditorProps<T, F>): ReactElement {
  const {
    value: tagged,
    display = SEAM_DISPLAY,
    min,
    max,
    limits,
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
  const value = tagged.map(untag);
  const retagged = (next: Band<T>[]): Band<T, F>[] => retagBands(tagged, next);
  const onInput = props.onInput && ((next: Band<T>[]) => props.onInput?.(retagged(next)));
  const onChange = (next: Band<T>[]) => props.onChange(retagged(next));
  const committed = normalizeBands(value, min);
  // Drawn from the drag while one is under way, so the control moves with the pointer whether or not the consumer
  // wires `onInput`. Every edit reads `committed`.
  const bands = draft?.bands ?? committed;
  const shown = retagged(bands);
  // An edge pulled past the track stretches the drawn axis to hold it until the drag ends; one pulled inward
  // leaves the axis alone, so the track it vacated shows empty.
  const [lo, hi] = draft?.range ?? [min, max];
  const axisMin = Math.min(min, lo);
  const axisMax = Math.max(max, hi);
  const sc = resolveScale(scale, min);
  const toUnit = (v: number): number => clamp01(sc.toUnit(v, axisMin, axisMax));
  const fromUnit = (u: number): number => sc.fromUnit(clamp01(u), axisMin, axisMax);

  const snapRadiusPx = useSnapRadiusPx();
  const trackWidth = (): number => trackRef.current?.getBoundingClientRect().width ?? 0;

  /** Unclamped: an edge drag reads the pointer past either end of the track. */
  const rawUnitAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  };
  const unitAt = (clientX: number): number => clamp01(rawUnitAt(clientX));

  const snapped = (unit: number, altKey: boolean): number => {
    if (!snap || altKey || !ticks || ticks.length === 0) return unit;
    const width = trackWidth();
    return width === 0 ? unit : snapToNearest(unit, ticks.map((tick) => toUnit(tick.at)), snapRadiusPx / width);
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

  const seamInput = (next: Band<T>[], ghost: number): void => {
    setDraft({ bands: next, ghost: { at: ghost } });
    onInput?.(next);
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
    const press = { clientX: e.clientX, clientY: e.clientY };
    let dragging = false;
    let latest = base;
    drag(
      e,
      (ev) => {
        if (!dragging && !pastDragThreshold(press, ev)) return;
        dragging = true;
        const shift = clampBandShift(edges, index, unitAt(ev.clientX) - startUnit);
        latest = shift === 0
          ? base
          : moveBandEdges(base, index, fromUnit(edges[index] + shift), fromUnit(edges[index + 1] + shift));
        const [from, to] = bandBounds(base, index, min, max);
        setDraft({ bands: latest, ghost: { from, to } });
        onInput?.(latest);
      },
      () => {
        if (latest !== base) onChange(latest);
      },
    );
  };

  const onBandFocus = (index: number) => (): void => {
    if (index !== selectedIndex) onSelect?.(index);
  };

  const rangeInput = (edge: RangeEdge, edit: RangeEdit<T>): void => {
    setDraft({ bands: edit.bands, range: edit.range, ghost: { at: edge === 'min' ? min : max } });
    props.onRangeInput?.(edit.range[0], edit.range[1], retagged(edit.bands));
  };
  const rangeCommit = (edit: RangeEdit<T>): void => {
    props.onRangeChange?.(edit.range[0], edit.range[1], retagged(edit.bands));
  };

  const edgeHandle = (edge: RangeEdge): ReactNode => (
    <RangeEdgeHandle
      edge={edge}
      committed={committed}
      min={min}
      max={max}
      at={edge === 'min' ? lo : hi}
      limits={limits}
      scale={sc}
      display={display}
      tagged={edge === 'min' ? shown[0]?.from : undefined}
      toUnit={toUnit}
      pointerUnit={(clientX, altKey) => snapped(rawUnitAt(clientX), altKey)}
      drag={drag}
      onInput={(edit) => rangeInput(edge, edit)}
      onCommit={rangeCommit}
    />
  );

  const onBandContextMenu = (index: number) => (e: ReactMouseEvent<HTMLButtonElement>): void => {
    if (!props.onRangeChange) return;
    e.preventDefault();
    onChange(toggleLock(committed, index));
  };

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (typeof e.button === 'number' && e.button > 0) return;
    e.preventDefault();
    splitAt(fromUnit(unitAt(e.clientX)));
  };

  const splitAt = (at: number): boolean => {
    const next = splitBands(committed, at, min, max, splitBand);
    if (next === committed) return false;
    onChange(next);
    // The new band takes the next index, so a selection to its right moves up one to stay on its band.
    const split = committed.filter((b) => b.from < at).length - 1;
    if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex > split) onSelect?.(selectedIndex + 1);
    return true;
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'x' && e.key !== 'Delete' && e.key !== 'l' && e.key !== 's') return;
    // `x` is a bare letter and Cmd/Ctrl+X is cut: neither may be swallowed
    // when the keystroke belongs to something a consumer put in a band.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditableTarget(e.target) || focusedControlOwnsKey(e.nativeEvent)) return;
    if (selectedIndex === null || selectedIndex === undefined) return;
    if (e.key === 'l') {
      if (!props.onRangeChange) return;
      e.preventDefault();
      onChange(toggleLock(committed, selectedIndex));
      return;
    }
    if (e.key === 's') {
      // The middle of the band as drawn, so on a log scale the halves look equal.
      const [from, to] = bandBounds(committed, selectedIndex, min, max);
      if (splitAt(fromUnit((toUnit(from) + toUnit(to)) / 2))) e.preventDefault();
      return;
    }
    const next = mergeBand(committed, selectedIndex);
    if (next === committed) return;
    e.preventDefault();
    const root = e.currentTarget;
    const merged = root.querySelector(`[data-band-index="${selectedIndex}"]`);
    const absorbing = root.querySelector<HTMLElement>(`[data-band-index="${selectedIndex - 1}"]`);
    onChange(next);
    // Focusing a band selects it, so a merged band that held focus hands over both at once.
    if (absorbing && merged?.contains(root.ownerDocument.activeElement)) absorbing.focus();
    else onSelect?.(selectedIndex - 1);
  };

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')} role="group"
      aria-label={typeof label === 'string' ? label : undefined}
      aria-labelledby={label !== undefined && typeof label !== 'string' ? labelId : undefined}
      onKeyDown={onRootKeyDown}
      data-dragging={draft ? ('at' in draft.ghost ? 'seam' : 'band') : undefined}
    >
      {label !== undefined && <div id={labelId} className={s.label}>{label}</div>}
      <Ruler
        trackRef={trackRef}
        ticks={ticks?.filter((tick) => tick.at >= axisMin && tick.at <= axisMax)}
        display={props.display}
        ends={
          props.onRangeChange && [
            { edge: 'min', at: lo, label: <QuantityText value={shown[0]?.from ?? lo} display={rulerDisplay(display)} mute /> },
            { edge: 'max', at: hi, label: <QuantityText value={hi} display={rulerDisplay(display)} mute /> },
          ]
        }
        toUnit={toUnit}
        onPointerDown={onTrackPointerDown}
      />
      <div className={s.bands}>
        {props.onRangeChange && edgeHandle('min')}
        {bands.map((_, i) => {
          const [from, to] = bandBounds(bands, i, lo, hi);
          const isSelected = selectedIndex === i;
          return (
            <Fragment key={i}>
              <button
                type="button"
                className={[s.band, isSelected ? s.selected : null, bands[i].locked ? s.locked : null]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--be-from': pct(toUnit(from)), '--be-to': pct(toUnit(to)) } as CSSProperties}
                aria-label={bandName(shown, i, from, to, display)}
                aria-pressed={isSelected}
                data-band-index={i}
                onPointerDown={onBandPointerDown(i)}
                onFocus={onBandFocus(i)}
                onContextMenu={onBandContextMenu(i)}
              >
                <span className={s.bandContent}>{renderBand?.(shown[i]!, i)}</span>
              </button>
              {i < bands.length - 1 && (
                <SeamHandle
                  index={i}
                  committed={committed}
                  bands={bands}
                  min={lo}
                  max={hi}
                  display={display}
                  tagged={shown[i + 1]!.from}
                  toUnit={toUnit}
                  fromUnit={fromUnit}
                  pointerUnit={(clientX, altKey) => snapped(unitAt(clientX), altKey)}
                  drag={drag}
                  onInput={seamInput}
                  onCommit={onChange}
                />
              )}
            </Fragment>
          );
        })}
        {props.onRangeChange && edgeHandle('max')}
        {draft && <DraftGhost ghost={draft.ghost} toUnit={toUnit} />}
      </div>
    </div>
  );
}

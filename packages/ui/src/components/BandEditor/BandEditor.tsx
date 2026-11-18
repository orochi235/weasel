import { useId, useRef, type ReactElement, type ReactNode } from 'react';
import { decimal, type Display, type Quantity } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import { QuantityText } from '../QuantityText';
import { linearScale, type ContinuousScaleFactory } from '@weasel-js/scale';
import { prefNumberScale } from '../Prefs/prefNumberScale';
import { drawnAxis } from './scale';
import { useTrackPointer } from './useTrackPointer';
import { retagBands, untag } from './retag';
import { RangeEdgeHandle } from './RangeEdgeHandle';
import { DraftGhost } from './DraftGhost';
import { BandRuler, rulerDisplay, type BandTick } from './BandRuler';
import { BandStrip } from './BandStrip';
import type { HoldProps } from '../Disabled';
import { useControlHold } from '../Disabled/controlHold';
import { normalizeBands, type Band, type RangeEdge } from './bands';
import { useBandDraft } from './useBandDraft';
import { createBandCommands } from './bandCommands';

export type { Band, RangeEdge, BandTick };

/** Props for {@link BandEditor}. Disabled or read-only, no seam, edge, or band moves, and nothing splits, merges, or
 *  locks; read-only, a band can still be selected. */
export interface BandEditorProps<T, F extends Quantity = number> extends HoldProps {
  /** Ascending by `from`. `value[0].from` is normalized to `min` on read. A
   *  tagged `from` stays tagged through every edit, with its display and unit. */
  value: Band<T, F>[];
  /** `onInput`, `onChange` and `onCancel` are the kit's edit protocol (`docs/conventions.md`, "Edit callbacks"): a
   *  seam drag, a key step, a split, a merge and a lock are each one edit. Escape cancels a drag. `onCancel` also
   *  ends an edge drag, whose preview went to `onRangeInput`. */
  onInput?: (next: Band<T, F>[]) => void;
  onChange: (next: Band<T, F>[]) => void;
  onCancel?: () => void;
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
  /** `onRangeChange`'s `onInput`, live during an edge drag. */
  onRangeInput?: (min: number, max: number, bands: Band<T, F>[]) => void;
  /** How far outward `min` and `max` may be dragged. Default unbounded. */
  limits?: readonly [number, number];
  /** Default `'log'`, which over an axis not above zero warns once in development and is drawn linear. */
  scale?: 'linear' | 'log' | ContinuousScaleFactory;
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
  onSelectionChange?: (index: number) => void;
  /** Payload for a band split off an existing one. Default duplicates `from`. */
  splitBand?: (at: number, from: T) => T;
  label?: ReactNode;
  className?: string;
}

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
 * | right-click a band, or `l` | lock or unlock it (with `onRangeChange`, the only thing a lock holds against) |
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
    onSelectionChange,
    label,
    className,
  } = props;
  const hold = useControlHold(props);
  const snap = props.snap ?? true;
  const splitBand = props.splitBand ?? keepData;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const value = tagged.map(untag);
  const retagged = (next: Band<T>[]): Band<T, F>[] => retagBands(tagged, next);
  const onChange = (next: Band<T>[]) => props.onChange(retagged(next));
  const committed = normalizeBands(value, min);
  const { draft, drag, seamInput, seamCommit, seamCancel, rangeInput, rangeCommit } = useBandDraft<T>({
    committed, min, max, onChange,
    onInput: props.onInput && ((next) => props.onInput?.(retagged(next))),
    onCancel: props.onCancel,
    onRangeInput: props.onRangeInput && ((lo, hi, next) => props.onRangeInput?.(lo, hi, retagged(next))),
    onRangeChange: props.onRangeChange && ((lo, hi, next) => props.onRangeChange?.(lo, hi, retagged(next))),
  });
  // Drawn from the drag while one is under way, so the control moves with the pointer whether or not the consumer
  // wires `onInput`. Every edit reads `committed`.
  const bands = draft?.bands ?? committed;
  const shown = retagged(bands);
  const sc = prefNumberScale(scale ?? 'log', 'BandEditor') ?? linearScale;
  const { lo, hi, axisMin, axisMax, bandScale, unit: axis, toUnit, fromUnit } = drawnAxis(sc, min, max, draft?.range);
  const { snapRadiusPx, unitAt, pointerUnit } = useTrackPointer(trackRef, snap, ticks, toUnit);

  const { onTrackPointerDown, onBandPointerDown, onBandFocus, onBandContextMenu, onRootKeyDown } = createBandCommands({
    committed, min, max, selectedIndex, onSelectionChange, onChange,
    canLock: !!props.onRangeChange, splitBand, toUnit, fromUnit, unitAt,
  });

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
      pointerUnit={pointerUnit}
      drag={drag}
      hold={hold}
      onInput={(edit) => rangeInput(edge, edit)}
      onChange={rangeCommit}
    />
  );

  return hold.wrap(
    <div
      className={[s.root, className].filter(Boolean).join(' ')} role="group"
      aria-label={typeof label === 'string' ? label : undefined}
      aria-labelledby={label !== undefined && typeof label !== 'string' ? labelId : undefined}
      onKeyDown={hold.gate(onRootKeyDown)}
      data-dragging={draft ? ('at' in draft.ghost ? 'seam' : 'band') : undefined} data-held={hold.held}
    >
      {label !== undefined && <div id={labelId} className={s.label}>{label}</div>}
      <BandRuler
        ref={trackRef}
        scale={axis}
        ticks={ticks?.filter((tick) => tick.at >= axisMin && tick.at <= axisMax)}
        display={props.display}
        ends={
          props.onRangeChange && [
            { edge: 'min', at: lo, label: <QuantityText value={shown[0]?.from ?? lo} display={rulerDisplay(display)} mute /> },
            { edge: 'max', at: hi, label: <QuantityText value={hi} display={rulerDisplay(display)} mute /> },
          ]
        }
        onPointerDown={hold.gate(onTrackPointerDown)}
      />
      <div className={s.bands}>
        {props.onRangeChange && edgeHandle('min')}
        <BandStrip
          bands={bands}
          shown={shown}
          lo={lo}
          hi={hi}
          scale={bandScale}
          toUnit={toUnit}
          fromUnit={fromUnit}
          snapTo={snap && ticks && ticks.length > 0 ? ticks.map((tick) => tick.at) : undefined}
          snapPx={snapRadiusPx}
          display={display}
          selectedIndex={selectedIndex}
          renderBand={renderBand}
          onBandPointerDown={onBandPointerDown}
          onBandFocus={onBandFocus}
          onBandContextMenu={onBandContextMenu}
          hold={hold}
          onInput={seamInput}
          onChange={seamCommit}
          onCancel={seamCancel}
        />
        {props.onRangeChange && edgeHandle('max')}
        {draft && <DraftGhost ghost={draft.ghost} toUnit={toUnit} />}
      </div>
    </div>
  );
}

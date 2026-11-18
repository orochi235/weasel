import { useLatest } from '@weasel-js/core';
import {
  createEyedropperModel,
  LOUPE_WHEEL_RATE,
  type LoupeInputApi,
  type LoupeMode,
  type LoupeModel,
  type LoupePoint,
} from '@weasel-js/loupe';
import { useKitSetting } from '@weasel-js/react';
import { type RefObject, useCallback, useEffect, useReducer, useRef } from 'react';
import {
  createHostLoupeInput,
  createHostLoupeModel,
  type HostPointer,
  hostPointOf,
} from './hostLoupe';
import type { LoupeLens, ResolvedLoupe } from './types';
import { useLensReport } from './useLensReport';

/** Options for {@link useLoupe}. */
export interface UseLoupeOptions<TData = unknown, TLayer extends string = string, TPose = unknown> {
  options: ResolvedLoupe<TData, TLayer, TPose>;
  /** The element the lens tracks the pointer across: aims are taken in its box. */
  hostRef: RefObject<HTMLElement | null>;
  /** Whether the loupe is turned on. Hold-to-peek shows it regardless. */
  enabled: boolean;
  /** Hex color at a host point. Omitted, the loupe reports no color — which
   *  is the honest answer for a surface with no pixels to read. */
  sample?: (p: LoupePoint) => string | null;
  /** Run `fn` whenever what `sample` reads changes without the aim moving — a
   *  canvas that animates, or a frame that arrives after the aim did; returns
   *  an unsubscribe. While the lens is up, each call samples the aim again, on
   *  top of the sample every aim takes at once. Omitted, color changes only on
   *  an aim. */
  subscribeResample?: (fn: () => void) => () => void;
  /** Whether the eyedropper is on: a click on the host picks the color under
   *  it through `sample`, and one inside the lens what the lens shows there. */
  dropping?: boolean;
  /** Called with the color a pick lands on, from the eyedropper or the lens. */
  onPick?: (hex: string) => void;
}

/** A loupe as a React view reads it. */
export interface LoupeState {
  /** Whether the lens should be drawn. */
  visible: boolean;
  /** Where it is aimed, in the host's own pixels. */
  aim: LoupePoint;
  /** The wheel's magnification. What the lens shows at is `lens.factor`. */
  factor: number;
  /** The box the lens is drawn in, and what it shows. */
  lens: LoupeLens;
  mode: LoupeMode;
  color: string | null;
  setMode: (mode: LoupeMode) => void;
  setFactor: (factor: number) => void;
  /** Sample the aim again, for pixels that changed under a still aim. */
  resample: () => void;
  /** Sample what the lens shows at a point inside it. */
  pick: (p?: LoupePoint) => string | null;
  /** What `<LoupeGestures>` drives the lens through. Stable for the life of
   *  the hook, so registering the actions on it does not churn. */
  input: LoupeInputApi;
}

/** Whether the lens is up: the pointer is over the host, and the loupe is on or peeked. */
function lensShown(over: boolean, enabled: boolean, peeking: boolean): boolean {
  return over && (enabled || peeking);
}

/** Whether a host point falls inside the lens's box. */
function insideLens(lens: LoupeLens, p: LoupePoint): boolean {
  return (
    Math.abs(p.x - lens.center.x) <= lens.width / 2 &&
    Math.abs(p.y - lens.center.y) <= lens.height / 2
  );
}

/** The box the lens is drawn in and what it shows: where the host's `place` puts it, asked only while the lens
 *  is up because it may measure the host's layout, and otherwise centered on the aim. */
function lensOf(
  options: Pick<ResolvedLoupe, 'place' | 'shape' | 'diameter'>,
  model: LoupeModel,
  visible: boolean,
): LoupeLens {
  const placed = visible
    ? (options.place?.({ aim: model.aim, factor: model.factor }) ?? null)
    : null;
  if (!placed) {
    const { aim, factor } = model;
    return {
      center: aim,
      shows: aim,
      width: options.diameter,
      height: options.diameter,
      factor,
      shape: options.shape,
    };
  }
  return {
    center: placed.center,
    shows: placed.shows ?? placed.center,
    width: placed.width,
    height: placed.height,
    factor: placed.factor ?? model.factor,
    shape: options.shape,
  };
}

/** Walk `model`'s factor by one wheel notch of `deltaY` at `rate`. */
function magnify(model: LoupeModel | null, deltaY: number, rate: number): void {
  if (model) model.setFactor(model.factor * Math.exp(-deltaY * rate));
}

/**
 * Binds `@weasel-js/loupe`'s model to a host element.
 *
 * Its input is not here: the pointer's moves and its leaving, the peek key and
 * the wheel are `loupe.aim`, `loupe.leave`, `loupe.peek` and `loupe.magnify`,
 * routed through the gesture dispatcher that `<LoupeGestures>` mounts on the
 * same host, driving `input`. Without `<LoupeGestures>` the lens never aims.
 */
export function useLoupe<TData = unknown, TLayer extends string = string, TPose = unknown>({
  options,
  hostRef,
  enabled,
  sample,
  subscribeResample,
  dropping = false,
  onPick,
}: UseLoupeOptions<TData, TLayer, TPose>): LoupeState {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const pointer = useRef<HostPointer>({ over: false, client: null, peeking: false }).current;
  const enabledRef = useLatest(enabled);
  const sampleRef = useLatest(sample);
  const onColorChangeRef = useLatest(options.onColorChange);
  const droppingRef = useLatest(dropping);
  const onPickRef = useLatest(onPick);
  const dropperRef = useRef<ReturnType<typeof createEyedropperModel> | null>(null);
  dropperRef.current ??= createEyedropperModel({
    sample: (p) => sampleRef.current?.(p) ?? null,
    onPick: (hex) => onPickRef.current?.(hex),
  });

  // Reads nothing but refs, so it is stable and an effect may depend on it.
  const shown = useCallback(
    (): boolean => lensShown(pointer.over, enabledRef.current, pointer.peeking),
    [enabledRef, pointer],
  );

  const modelRef = useRef<LoupeModel | null>(null);
  modelRef.current ??= createHostLoupeModel(options, {
    lens: () => lensRef.current,
    sample: (p) => sampleRef.current?.(p) ?? null,
    shown,
    gone: () => goneRef.current,
    changed: bump,
    onColorChange: (hex) => onColorChangeRef.current?.(hex),
    onPick: (hex) => onPickRef.current?.(hex),
  });
  const model = modelRef.current;

  const goneRef = useRef(false);

  // The model holds no resources, and `dispose` is one-way — so unmounting only
  // reports the lens gone. Disposing here instead leaves React's mount / unmount
  // / remount in StrictMode with a permanently dead model that silently ignores
  // every aim.
  useEffect(() => {
    goneRef.current = false;
    return () => {
      goneRef.current = true;
    };
  }, []);

  // Aim at the pointer's last spot over the host, for a lens that has just
  // come up under a pointer that has not moved since. Stable, because `input`
  // captures it once.
  const hostRefRef = useLatest(hostRef);
  const pointerOnHost = useCallback(
    (): LoupePoint | null => hostPointOf(hostRefRef.current.current, pointer),
    [hostRefRef, pointer],
  );
  const aimAtPointer = useCallback((): void => {
    const at = pointerOnHost();
    if (at) modelRef.current?.aimAt(at);
  }, [pointerOnHost]);

  // Turning the loupe off with the pointer still inside must put the lens away,
  // and the model only reconsiders on an aim; turning it on must open the lens
  // where the pointer already is.
  useEffect(() => {
    if (enabled) aimAtPointer();
    else if (!pointer.peeking) bump();
  }, [enabled, aimAtPointer, pointer]);

  // Subscribed while the lens is up, and before any effect the caller declares
  // after this hook runs — so a frame its own effect provokes is not missed.
  // This render's `enabled`: `enabledRef` holds the last committed one.
  const visible = lensShown(pointer.over, enabled, pointer.peeking);

  const lens = lensOf(options, model, visible);
  const lensRef = useLatest(lens);

  useLensReport(options.onLens, visible ? lens : null);
  useEffect(() => {
    if (!visible || !subscribeResample) return;
    return subscribeResample(() => model.resample());
  }, [visible, subscribeResample, model]);

  const wheelRateRef = useLatest(useKitSetting('loupe.wheelRate') ?? LOUPE_WHEEL_RATE);
  const inputRef = useRef<LoupeInputApi | null>(null);
  inputRef.current ??= createHostLoupeInput(pointer, {
    shown,
    aimAtPointer,
    changed: bump,
    magnifyBy: (deltaY) => magnify(modelRef.current, deltaY, wheelRateRef.current),
    dropping: () => droppingRef.current,
    pickAtPointer: () => {
      const at = pointerOnHost();
      if (at && shown() && insideLens(lensRef.current, at)) modelRef.current?.pick(at);
      else if (at) void dropperRef.current?.pick(at);
    },
  });

  return {
    visible,
    aim: model.aim,
    factor: model.factor,
    lens,
    mode: model.mode,
    color: model.color,
    setMode: model.setMode,
    setFactor: model.setFactor,
    resample: model.resample,
    pick: model.pick,
    input: inputRef.current,
  };
}

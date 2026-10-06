import { useLatest } from '@weasel-js/core';
import {
  createLoupeModel,
  type LoupeMode,
  type LoupeModel,
  type LoupePoint,
} from '@weasel-js/loupe';
import { type RefObject, useCallback, useEffect, useReducer, useRef } from 'react';
import type { LoupeInputApi } from './loupeActions';
import { WHEEL_RATE } from './loupeActions';
import type { LoupeLens, ResolvedLoupe } from './types';

/** Options for {@link useLoupe}. */
export interface UseLoupeOptions {
  options: ResolvedLoupe;
  /** The element the lens tracks the pointer across. */
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

/**
 * Binds `@weasel-js/loupe`'s model to a host element and tracks the pointer
 * across it.
 *
 * The peek key and the wheel are not here: they are `loupe.peek` and
 * `loupe.magnify`, routed through the gesture dispatcher that
 * `<LoupeGestures>` mounts on the same host. Aiming stays a plain listener
 * because a hover is not a gesture the grammar names — `GESTURE_DESCRIPTORS`
 * has no continuous-motion entry, and inventing one to carry the lens' aim
 * would be an input taxonomy change, not a loupe change.
 */
export function useLoupe({
  options,
  hostRef,
  enabled,
  sample,
  subscribeResample,
}: UseLoupeOptions): LoupeState {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const overRef = useRef(false);
  // Where the pointer last was over the host, in client px. The model ignores
  // aims while the lens is down, so this is what the lens opens at.
  const pointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const peekingRef = useRef(false);
  const enabledRef = useLatest(enabled);
  const sampleRef = useLatest(sample);
  const onColorChangeRef = useLatest(options.onColorChange);

  // Reads nothing but refs, so it is stable and an effect may depend on it.
  const shown = useCallback(
    (): boolean => lensShown(overRef.current, enabledRef.current, peekingRef.current),
    [enabledRef],
  );

  const modelRef = useRef<LoupeModel | null>(null);
  if (modelRef.current === null) {
    modelRef.current = createLoupeModel({
      mode: options.mode,
      factor: options.factor,
      minFactor: options.minFactor,
      maxFactor: options.maxFactor,
      onColorChange: (hex) => onColorChangeRef.current?.(hex),
      surface: {
        lens: () => {
          const { center, shows, width, height, factor } = lensRef.current;
          return {
            x: center.x - width / 2,
            y: center.y - height / 2,
            w: width,
            h: height,
            shows,
            factor,
          };
        },
        // The lens follows the pointer and is painted over the host rather than
        // into it, so it is never part of the picture being magnified.
        covers: () => false,
        sample: (p) => sampleRef.current?.(p) ?? null,
        hidden: () => !shown(),
        gone: () => goneRef.current,
        changed: bump,
      },
    });
  }
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
  const aimAtPointer = useCallback((): void => {
    const host = hostRefRef.current.current;
    const p = pointerRef.current;
    if (!host || !p) return;
    const rect = host.getBoundingClientRect();
    modelRef.current?.aimAt({ x: p.clientX - rect.left, y: p.clientY - rect.top });
  }, [hostRefRef]);

  // Turning the loupe off with the pointer still inside must put the lens away,
  // and the model only reconsiders on an aim; turning it on must open the lens
  // where the pointer already is.
  useEffect(() => {
    if (enabled) aimAtPointer();
    else if (!peekingRef.current) bump();
  }, [enabled, aimAtPointer]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onPointerMove = (e: PointerEvent): void => {
      overRef.current = true;
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY };
      const rect = host.getBoundingClientRect();
      model.aimAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!shown()) return;
      bump();
    };
    const onPointerLeave = (): void => {
      overRef.current = false;
      pointerRef.current = null;
      bump();
    };

    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    return () => {
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [hostRef, model, shown]);

  // Subscribed while the lens is up, and before any effect the caller declares
  // after this hook runs — so a frame its own effect provokes is not missed.
  // This render's `enabled`: `enabledRef` holds the last committed one.
  const visible = lensShown(overRef.current, enabled, peekingRef.current);

  // Asked only while the lens is up: a host's `place` may measure its layout.
  const placed = visible ? (options.place?.({ aim: model.aim, factor: model.factor }) ?? null) : null;
  const lens: LoupeLens = placed
    ? {
        center: placed.center,
        shows: placed.shows ?? placed.center,
        width: placed.width,
        height: placed.height,
        factor: placed.factor ?? model.factor,
        shape: options.shape,
      }
    : {
        center: model.aim,
        shows: model.aim,
        width: options.diameter,
        height: options.diameter,
        factor: model.factor,
        shape: options.shape,
      };
  const lensRef = useLatest(lens);

  // Told on a change in value, not on every render: a host drawing into this
  // box would otherwise redraw for each one.
  const onLensRef = useLatest(options.onLens);
  const reportedRef = useRef<string>(JSON.stringify(null));
  const report = useCallback((next: LoupeLens | null): void => {
    const key = JSON.stringify(next);
    if (key === reportedRef.current) return;
    reportedRef.current = key;
    onLensRef.current?.(next);
  }, [onLensRef]);
  const shownLens = visible ? lens : null;
  const shownKey = JSON.stringify(shownLens);
  useEffect(() => {
    report(JSON.parse(shownKey) as LoupeLens | null);
  }, [shownKey, report]);
  useEffect(() => () => report(null), [report]);
  useEffect(() => {
    if (!visible || !subscribeResample) return;
    return subscribeResample(() => model.resample());
  }, [visible, subscribeResample, model]);

  const inputRef = useRef<LoupeInputApi | null>(null);
  if (inputRef.current === null) {
    inputRef.current = {
      shown,
      setPeeking: (on) => {
        if (peekingRef.current === on) return;
        peekingRef.current = on;
        if (on) aimAtPointer();
        bump();
      },
      magnifyBy: (deltaY) => {
        const m = modelRef.current;
        if (m) m.setFactor(m.factor * Math.exp(-deltaY * WHEEL_RATE));
      },
    };
  }

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

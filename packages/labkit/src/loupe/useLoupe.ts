import {
  createLoupeModel,
  type LoupeMode,
  type LoupeModel,
  type LoupePoint,
} from '@weasel-js/loupe';
import { type RefObject, useCallback, useEffect, useReducer, useRef } from 'react';
import type { LoupeInputApi } from './loupeActions';
import { WHEEL_RATE } from './loupeActions';
import type { ResolvedLoupe } from './types';

/** Options for {@link useLoupe}. */
export interface UseLoupeOptions {
  capability: ResolvedLoupe;
  /** The element the lens tracks the pointer across. */
  hostRef: RefObject<HTMLElement | null>;
  /** Whether the loupe is turned on. Hold-to-peek shows it regardless. */
  enabled: boolean;
  /** Hex color at a host point. Omitted, the loupe reports no color — which
   *  is the honest answer for a surface with no pixels to read. */
  sample?: (p: LoupePoint) => string | null;
}

/** A loupe as a React view reads it. */
export interface LoupeState {
  /** Whether the lens should be drawn. */
  visible: boolean;
  /** Where it is aimed, in the host's own pixels. */
  aim: LoupePoint;
  factor: number;
  mode: LoupeMode;
  color: string | null;
  setMode: (mode: LoupeMode) => void;
  setFactor: (factor: number) => void;
  /** Sample what the lens shows at a point inside it. */
  pick: (p?: LoupePoint) => string | null;
  /** What `<LoupeGestures>` drives the lens through. Stable for the life of
   *  the hook, so registering the actions on it does not churn. */
  input: LoupeInputApi;
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
export function useLoupe({ capability, hostRef, enabled, sample }: UseLoupeOptions): LoupeState {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const overRef = useRef(false);
  const peekingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  const onColorChangeRef = useRef(capability.onColorChange);
  onColorChangeRef.current = capability.onColorChange;

  // Reads nothing but refs, so it is stable and an effect may depend on it.
  const shown = useCallback(
    (): boolean => overRef.current && (enabledRef.current || peekingRef.current),
    [],
  );

  const modelRef = useRef<LoupeModel | null>(null);
  if (modelRef.current === null) {
    modelRef.current = createLoupeModel({
      mode: capability.mode,
      factor: capability.factor,
      minFactor: capability.minFactor,
      maxFactor: capability.maxFactor,
      onColorChange: (hex) => onColorChangeRef.current?.(hex),
      surface: {
        lens: () => {
          const d = diameterRef.current;
          const { x, y } = modelRef.current?.aim ?? { x: 0, y: 0 };
          return { x: x - d / 2, y: y - d / 2, w: d, h: d };
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

  const diameterRef = useRef(capability.diameter);
  diameterRef.current = capability.diameter;
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

  // Turning the loupe off with the pointer still inside must put the lens away,
  // and the model only reconsiders on an aim.
  useEffect(() => {
    if (!enabled && !peekingRef.current) bump();
  }, [enabled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onPointerMove = (e: PointerEvent): void => {
      overRef.current = true;
      const rect = host.getBoundingClientRect();
      model.aimAt({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!shown()) return;
      bump();
    };
    const onPointerLeave = (): void => {
      overRef.current = false;
      bump();
    };

    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    return () => {
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [hostRef, model, shown]);

  const inputRef = useRef<LoupeInputApi | null>(null);
  if (inputRef.current === null) {
    inputRef.current = {
      shown,
      setPeeking: (on) => {
        if (peekingRef.current === on) return;
        peekingRef.current = on;
        bump();
      },
      magnifyBy: (deltaY) => {
        const m = modelRef.current;
        if (m) m.setFactor(m.factor * Math.exp(-deltaY * WHEEL_RATE));
      },
    };
  }

  return {
    visible: shown(),
    aim: model.aim,
    factor: model.factor,
    mode: model.mode,
    color: model.color,
    setMode: model.setMode,
    setFactor: model.setFactor,
    pick: model.pick,
    input: inputRef.current,
  };
}

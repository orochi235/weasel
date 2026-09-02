import {
  createLoupeModel,
  type LoupeMode,
  type LoupeModel,
  type LoupePoint,
} from '@weasel-js/loupe';
import { type RefObject, useCallback, useEffect, useReducer, useRef } from 'react';
import type { ResolvedLoupe } from './types';

/** Options for {@link useLoupe}. */
export interface UseLoupeOptions {
  capability: ResolvedLoupe;
  /** The element the lens tracks the pointer across. */
  hostRef: RefObject<HTMLElement | null>;
  /** Whether the loupe is turned on. Hold-to-peek shows it regardless. */
  enabled: boolean;
  /** Hex colour at a host point. Omitted, the loupe reports no colour — which
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
}

/** How fast the wheel walks the magnification. Gentler than the pan-zoom
 *  wheel: the lens' whole range is one order of magnitude. */
const WHEEL_RATE = 0.002;

/**
 * Binds `@weasel-js/loupe`'s model to a host element and drives it from the
 * pointer, the peek key and the wheel.
 *
 * These are plain listeners rather than gesture bindings because labkit trials
 * do not route input through the dispatcher — see the loupe entry under
 * "Selection, actions & UI panels" in `docs/TODO.md`. They are all in this one
 * hook so that when trial input does go through it, this is the only file to
 * rewrite.
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
    const onWheel = (e: WheelEvent): void => {
      if (!shown()) return;
      // Ahead of the stack's own pan-zoom, which is a React handler on this same
      // element: capture runs first, and stopping propagation keeps the event
      // from reaching React's root listener at all.
      e.preventDefault();
      e.stopPropagation();
      model.setFactor(model.factor * Math.exp(-e.deltaY * WHEEL_RATE));
    };

    host.addEventListener('pointermove', onPointerMove);
    host.addEventListener('pointerleave', onPointerLeave);
    host.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerleave', onPointerLeave);
      host.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [hostRef, model, shown]);

  const peekKey = capability.peekKey;
  useEffect(() => {
    if (peekKey == null) return;
    const setPeeking = (next: boolean): void => {
      if (peekingRef.current === next) return;
      peekingRef.current = next;
      bump();
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === peekKey) setPeeking(true);
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === peekKey) setPeeking(false);
    };
    // A key held while the window loses focus never sends its keyup, so the
    // peek would stay on until the key was pressed and released again.
    const onBlur = (): void => setPeeking(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [peekKey]);

  return {
    visible: shown(),
    aim: model.aim,
    factor: model.factor,
    mode: model.mode,
    color: model.color,
    setMode: model.setMode,
    setFactor: model.setFactor,
    pick: model.pick,
  };
}

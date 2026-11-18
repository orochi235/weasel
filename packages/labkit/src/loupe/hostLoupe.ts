import { clientToCanvas } from '@weasel-js/core';
import {
  createLoupeModel,
  type LoupeInputApi,
  type LoupeModel,
  type LoupePoint,
} from '@weasel-js/loupe';
import type { LoupeLens, ResolvedLoupe } from './types';

/** What the model asks of the host, each read live: the lens's box, the host's pixels, and whether the lens is
 *  up or its host gone. */
export interface HostLoupeSurface {
  lens: () => LoupeLens;
  sample: (p: LoupePoint) => string | null;
  shown: () => boolean;
  gone: () => boolean;
  /** The model changed: render again. */
  changed: () => void;
  onColorChange: (hex: string | null) => void;
  onPick: (hex: string) => void;
}

/** `@weasel-js/loupe`'s model over a host element. */
export function createHostLoupeModel(
  options: Pick<ResolvedLoupe, 'mode' | 'factor' | 'minFactor' | 'maxFactor'>,
  host: HostLoupeSurface,
): LoupeModel {
  return createLoupeModel({
    mode: options.mode,
    factor: options.factor,
    minFactor: options.minFactor,
    maxFactor: options.maxFactor,
    onColorChange: host.onColorChange,
    onPick: host.onPick,
    surface: {
      lens: () => {
        const { center, shows, width, height, factor } = host.lens();
        return {
          x: center.x - width / 2,
          y: center.y - height / 2,
          width,
          height,
          shows,
          factor,
        };
      },
      // The lens follows the pointer and is painted over the host rather than
      // into it, so it is never part of the picture being magnified.
      covers: () => false,
      sample: host.sample,
      hidden: () => !host.shown(),
      gone: host.gone,
      changed: host.changed,
    },
  });
}

/** The pointer as the loupe knows it, changed by each input event. */
export interface HostPointer {
  /** Whether it is over the host. */
  over: boolean;
  /** Where it last was over the host, in client px. The model ignores aims
   *  while the lens is down, so this is what the lens opens at. */
  client: { clientX: number; clientY: number } | null;
  /** Whether hold-to-peek is down. */
  peeking: boolean;
}

/** Where the pointer last was over `host`, in the host's own pixels; null with no host or no such spot. */
export function hostPointOf(host: HTMLElement | null, pointer: HostPointer): LoupePoint | null {
  const p = pointer.client;
  if (!host || !p) return null;
  const [x, y] = clientToCanvas(host, p.clientX, p.clientY);
  return { x, y };
}

/** What the loupe's input reaches past the pointer. */
export interface HostLoupeInputDeps {
  shown: () => boolean;
  /** Aim the model at the pointer's last spot over the host. */
  aimAtPointer: () => void;
  /** Pick at the pointer's spot over the host. */
  pickAtPointer: () => void;
  magnifyBy: (deltaY: number) => void;
  dropping: () => boolean;
  /** Something the render reads changed. */
  changed: () => void;
}

/** The input `<LoupeGestures>` drives: each event updates `pointer` and tells the model or the render. */
export function createHostLoupeInput(
  pointer: HostPointer,
  deps: HostLoupeInputDeps,
): LoupeInputApi {
  const { shown, aimAtPointer, changed } = deps;
  return {
    shown,
    setPeeking: (on) => {
      if (pointer.peeking === on) return;
      pointer.peeking = on;
      if (on) aimAtPointer();
      changed();
    },
    magnifyBy: deps.magnifyBy,
    aimAt: (clientX, clientY) => {
      pointer.over = true;
      pointer.client = { clientX, clientY };
      aimAtPointer();
      if (shown()) changed();
    },
    leave: () => {
      pointer.over = false;
      pointer.client = null;
      changed();
    },
    dropping: deps.dropping,
    pickAtPointer: deps.pickAtPointer,
  };
}

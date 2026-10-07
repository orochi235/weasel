import { createContext } from 'react';

/**
 * Which gestures a camera takes. Each one it leaves alone reaches the page, so
 * an embedded canvas can let the page scroll past it.
 */
export interface CameraGestures {
  /** A drag pans — a mouse drag, or one finger. Default `true`. */
  pan?: boolean;
  /** The wheel zooms: `'plain'` a bare wheel, `'mod'` only with Cmd/Ctrl held,
   *  `false` never, leaving the wheel to scroll the page. Default `'plain'`. */
  wheel?: 'plain' | 'mod' | false;
  /** A pinch zooms — a trackpad's, or two fingers on a touch screen. Default
   *  `true`. */
  pinch?: boolean;
  /** A press released without dragging reports where it landed. Default `true`. */
  tap?: boolean;
}

/** {@link CameraGestures} with every default filled in. */
export type ResolvedCameraGestures = Required<CameraGestures>;

export function resolveGestures(gestures: CameraGestures | undefined): ResolvedCameraGestures {
  return {
    pan: gestures?.pan ?? true,
    wheel: gestures?.wheel ?? 'plain',
    pinch: gestures?.pinch ?? true,
    tap: gestures?.tap ?? true,
  };
}

/**
 * What a camera's element hands the browser's own touch handling, as the
 * `data-lk-touch` value the stylesheet keys `touch-action` off: `none` when a
 * finger pans the camera, `scroll` when one finger scrolls the page and two
 * pinch the camera, `auto` when the camera takes no touch at all.
 */
export function touchMode(gestures: ResolvedCameraGestures): 'none' | 'scroll' | 'auto' {
  if (gestures.pan) return 'none';
  return gestures.pinch ? 'scroll' : 'auto';
}

/** Gestures a host lays over every trial camera below it — `<Lab gestures>`'s,
 *  which win over the instrument's own. */
export const CameraGesturesContext = createContext<CameraGestures | null>(null);

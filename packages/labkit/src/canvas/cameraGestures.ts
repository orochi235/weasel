import { createContext } from 'react';

/**
 * Which gestures a camera takes — a 2D one or an orbit. Each one it leaves
 * alone reaches the page, so an embedded canvas can let the page scroll past it.
 */
export interface CameraGestures {
  /** A drag moves the camera — a mouse drag, or one finger. A 2D camera pans;
   *  an orbit turns, and pans its target with Shift held. Default `true`. */
  drag?: boolean;
  /** The wheel zooms, or dollies an orbit: `'plain'` a bare wheel, `'mod'` only
   *  with Cmd/Ctrl held, `false` never, leaving the wheel to scroll the page.
   *  Default `'plain'`. */
  wheel?: 'plain' | 'mod' | false;
  /** A pinch zooms, or dollies an orbit: `true` both kinds, `'trackpad'` only
   *  a trackpad's, `'touch'` only two fingers on a touch screen, `false`
   *  neither. Two fingers are pointers, so a camera leaving every press to the
   *  content beneath it keeps the trackpad's alone. Default `true`. */
  pinch?: boolean | 'trackpad' | 'touch';
  /** A press released without dragging reports where it landed. 2D only: an
   *  orbit has no world point under the pointer to report. Default `true`. */
  tap?: boolean;
  /** A double click returns the camera to where it opened. Default `true` for
   *  an orbit and `false` for a 2D camera, whose double clicks usually belong
   *  to the content it shows. */
  home?: boolean;
}

/** {@link CameraGestures} with every default filled in, and `pinch` split
 *  into the two inputs that deliver one. */
export interface ResolvedCameraGestures {
  drag: boolean;
  wheel: 'plain' | 'mod' | false;
  /** ctrl+wheel and WebKit's gesture events. */
  trackpadPinch: boolean;
  /** Two pointers. */
  touchPinch: boolean;
  tap: boolean;
  home: boolean;
}

/** `gestures` with the defaults filled in. `home` is the one whose default
 *  depends on the camera, so the caller passes it. */
export function resolveGestures(
  gestures: CameraGestures | undefined,
  defaults: { home: boolean } = { home: false },
): ResolvedCameraGestures {
  const pinch = gestures?.pinch ?? true;
  return {
    drag: gestures?.drag ?? true,
    wheel: gestures?.wheel ?? 'plain',
    trackpadPinch: pinch === true || pinch === 'trackpad',
    touchPinch: pinch === true || pinch === 'touch',
    tap: gestures?.tap ?? true,
    home: gestures?.home ?? defaults.home,
  };
}

/**
 * What a camera's element hands the browser's own touch handling, as the
 * `data-lk-touch` value the stylesheet keys `touch-action` off: `none` when a
 * finger drags the camera, `scroll` when one finger scrolls the page and two
 * pinch the camera, `auto` when the camera takes no touch at all.
 */
export function touchMode(gestures: ResolvedCameraGestures): 'none' | 'scroll' | 'auto' {
  if (gestures.drag) return 'none';
  return gestures.touchPinch ? 'scroll' : 'auto';
}

/** Gestures a host lays over every trial camera below it — `<Lab gestures>`'s,
 *  which win over the instrument's own. */
export const CameraGesturesContext = createContext<CameraGestures | null>(null);

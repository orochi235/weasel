/**
 * What the "press is registering" ring shows for a long-press at a moment: a
 * ring around the press point that fills over the hold, shown only for a press
 * some binding would fire on and only once it has been held a moment. Pure: a
 * host draws it in whatever its surface draws with.
 */
import type { LongPressState } from './pressState';

/** How the ring looks and when it appears. */
export interface PressRingOptions {
  /** Ring radius in CSS pixels. Default 22 — clear of a fingertip. */
  radius?: number;
  /** Ring stroke width in CSS pixels. Default 3. */
  width?: number;
  /** How long a press is held before the ring appears, in ms, so an ordinary
   *  tap shows nothing. Default 120. */
  delay?: number;
}

/** The ring to draw, in the press's `local` coordinates. */
export interface PressRing {
  x: number;
  y: number;
  radius: number;
  width: number;
  /** How much of the ring is filled, 0→1; `'full'` for a static ring, which has no track behind it. */
  fill: number | 'full';
}

/** Ring radius when none is given, in CSS pixels. */
export const PRESS_RING_RADIUS = 22;
/** Ring stroke width when none is given, in CSS pixels. */
export const PRESS_RING_WIDTH = 3;
/** How long a press is held before the ring appears when no delay is given, in ms. */
export const PRESS_RING_DELAY_MS = 120;

/** The ring `state`'s press shows at `now`, filling over the hold unless `still`, or `null` for none. */
export function pressRingAt(
  state: LongPressState,
  now: number,
  opts: PressRingOptions & { still?: boolean } = {},
): PressRing | null {
  const p = state.get();
  if (!p || !p.armed || now - p.startedAt < (opts.delay ?? PRESS_RING_DELAY_MS)) return null;
  return {
    x: p.local.x,
    y: p.local.y,
    radius: opts.radius ?? PRESS_RING_RADIUS,
    width: opts.width ?? PRESS_RING_WIDTH,
    fill: opts.still ? 'full' : state.progress(now),
  };
}

/** How long until `state`'s press shows its ring, in ms: 0 once it shows, `null` when no press will. */
export function pressRingWaitAt(state: LongPressState, now: number, delay = PRESS_RING_DELAY_MS): number | null {
  const p = state.get();
  if (!p?.armed) return null;
  return Math.max(0, delay - (now - p.startedAt));
}

/** Points along an open arc from 12 o'clock, clockwise on a y-down screen, through `turn` of a full turn. */
export function ringArcPoints(
  ring: Pick<PressRing, 'x' | 'y' | 'radius'>,
  turn: number,
  segments = 64,
): { x: number; y: number }[] {
  const n = Math.max(1, Math.ceil(segments * turn));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turn * Math.PI * 2;
    pts.push({ x: ring.x + ring.radius * Math.sin(a), y: ring.y - ring.radius * Math.cos(a) });
  }
  return pts;
}

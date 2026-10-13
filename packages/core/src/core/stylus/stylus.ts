import { clientToWorld } from 'core/viewport/clientToWorld';
/**
 * Stylus / Pencil pointer-event helpers.
 *
 * These normalize the standard `PointerEvent` stylus fields across browsers,
 * fill in defaults for non-stylus inputs, and provide a coalesced-event
 * iterator for high-frequency samples.
 *
 * `pointerType: 'pen'` covers Apple Pencil on iPad Safari. The
 * barrel-double-tap (Pencil 2) and barrel-squeeze (Pencil Pro) gestures are
 * NOT exposed to web pages.
 */

/** Normalized snapshot of stylus state at a single pointer sample. */
export interface StylusData {
  /** 0..1. Mouse and ordinary touch report 0 when no button is held and 0.5
   *  while a button is held (per the Pointer Events spec). Stylus inputs
   *  report a true pressure curve. */
  pressure: number;
  /** Tilt of the pen in degrees from the surface normal, projected onto the
   *  X axis. Range ±90. Zero for mouse/touch. */
  tiltX: number;
  /** Tilt projected onto the Y axis. Range ±90. Zero for mouse/touch. */
  tiltY: number;
  /** Newer (Pointer Events level 3) angle in radians between the surface
   *  and the pen barrel. π/2 = perpendicular to the surface. Undefined on
   *  browsers that haven't shipped the field yet. */
  altitudeAngle: number | undefined;
  /** Newer angle in radians around the Z axis. Undefined on browsers
   *  without level-3 support. */
  azimuthAngle: number | undefined;
  /** Rotation of the pen barrel in degrees. Apple Pencil Pro reports this
   *  natively but Safari does NOT yet surface it via PointerEvent.twist —
   *  expect 0 there. Some Wacom stylus drivers do report it. */
  twist: number;
  /** Raw pointerType from the event ('mouse' | 'pen' | 'touch' | ''). */
  pointerType: string;
  /** Convenience: `pointerType === 'pen'`. */
  isStylus: boolean;
}

/** Options for `pressureToWidth`. */
export interface PressureToWidthOptions {
  /** Width returned at pressure 0. Default 0.5. */
  minWidth?: number;
  /** Width returned at pressure 1. Default 6. */
  maxWidth?: number;
  /** Response curve exponent applied to pressure before lerping
   *  (`p ** gamma`). 1 = linear. Default 1.6. */
  gamma?: number;
}

/**
 * Map a 0..1 pressure value to a stroke width.
 *
 * `width(p) = minWidth + (maxWidth - minWidth) × p^gamma`
 *
 * Mouse / non-stylus inputs report `pressure === 0` (no button) or `0.5`
 * (button held); gate on `pointerType === 'pen'` upstream to give them a
 * constant width instead.
 */
export function pressureToWidth(
  pressure: number,
  options: PressureToWidthOptions = {},
): number {
  const minWidth = options.minWidth ?? 0.5;
  const maxWidth = options.maxWidth ?? 6;
  const gamma = options.gamma ?? 1.6;
  const p = Math.max(0, Math.min(1, pressure));
  const shaped = p ** gamma;
  return minWidth + (maxWidth - minWidth) * shaped;
}

/** Extract a normalized stylus snapshot from any PointerEvent. Pure. */
export function getStylusData(e: PointerEvent): StylusData {
  const ext = e as PointerEvent & {
    altitudeAngle?: number;
    azimuthAngle?: number;
  };
  const pointerType = e.pointerType ?? '';
  return {
    pressure: e.pressure,
    tiltX: e.tiltX ?? 0,
    tiltY: e.tiltY ?? 0,
    altitudeAngle: typeof ext.altitudeAngle === 'number' ? ext.altitudeAngle : undefined,
    azimuthAngle: typeof ext.azimuthAngle === 'number' ? ext.azimuthAngle : undefined,
    twist: e.twist ?? 0,
    pointerType,
    isStylus: pointerType === 'pen',
  };
}

/** One enriched sample, ready for tools that want world coords + stylus
 *  data at every coalesced sub-frame. */
export interface PointerSample {
  /** Client coords (relative to viewport). */
  clientX: number;
  clientY: number;
  /** Canvas-relative CSS pixels. */
  screenX: number;
  screenY: number;
  /** World coords, derived from `screenX/Y` via the supplied view. */
  worldX: number;
  worldY: number;
  /** Stylus snapshot for this sample. */
  stylus: StylusData;
  /** Original event (may be the parent move or a coalesced sub-event). */
  event: PointerEvent;
}

/** Context for `forEachCoalesced` — the kit's `ToolCtx` satisfies this. */
export interface CoalescedCtx {
  canvasRect: { left: number; top: number };
  view: { x: number; y: number; scale: { x: number; y: number } };
}

/**
 * Iterate coalesced sub-events of a `pointermove`, yielding a
 * `PointerSample` per sub-event with world coords already derived. When
 * `getCoalescedEvents` is unavailable or returns an empty list, the parent
 * event itself is yielded once.
 */
export function forEachCoalesced(
  event: PointerEvent,
  ctx: CoalescedCtx,
  cb: (sample: PointerSample) => void,
): void {
  // Cast through unknown — older lib.dom.d.ts in some toolchains omits the
  // method even though every modern engine ships it.
  const get = (event as unknown as { getCoalescedEvents?: () => PointerEvent[] })
    .getCoalescedEvents;
  const sub = typeof get === 'function' ? get.call(event) : [];
  const list = sub.length > 0 ? sub : [event];
  for (const e of list) {
    const [screenX, screenY] = [e.clientX - ctx.canvasRect.left, e.clientY - ctx.canvasRect.top];
    const [worldX, worldY] = clientToWorld(e.clientX, e.clientY, ctx.canvasRect, ctx.view);
    cb({
      clientX: e.clientX,
      clientY: e.clientY,
      screenX,
      screenY,
      worldX,
      worldY,
      stylus: getStylusData(e),
      event: e,
    });
  }
}

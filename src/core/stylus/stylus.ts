/**
 * Stylus / Pencil pointer-event helpers.
 *
 * Most stylus information (pressure, tilt, altitude/azimuth) is already on
 * the standard `PointerEvent`. These helpers normalize the surface across
 * browsers, fill in sensible defaults for non-stylus inputs, and provide
 * a coalesced-event iterator so tools can opt into high-frequency samples
 * (Apple Pencil reports up to ~240Hz; most browsers coalesce those samples
 * into per-frame `pointermove` events whose intermediate states are only
 * accessible via `getCoalescedEvents()`).
 *
 * Apple-specific note: `pointerType: 'pen'` covers Apple Pencil on iPad
 * Safari. The barrel-double-tap (Pencil 2) and barrel-squeeze (Pencil
 * Pro) gestures are NOT exposed to web pages — they remain
 * UIKit-only via `UIPencilInteraction`.
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
   *  (`p ** gamma`). 1 = linear; >1 emphasizes light touches (sharper
   *  thin → thick transition); <1 emphasizes heavy touches. Default 1.6,
   *  a small bias toward heavy strokes that matches typical pencil feel
   *  without crushing the dynamic range. */
  gamma?: number;
}

/**
 * Map a 0..1 pressure value to a stroke width.
 *
 * `width(p) = minWidth + (maxWidth - minWidth) × p^gamma`
 *
 * Mouse / non-stylus inputs report `pressure === 0` (no button) or `0.5`
 * (button held); callers that don't want uniform 0.5-pressure widths on
 * mouse input should gate on `pointerType === 'pen'` upstream and feed a
 * constant width on the non-stylus path.
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
  // `altitudeAngle` / `azimuthAngle` are Pointer Events level 3 — only
  // present in newer browsers. Read defensively so the helper degrades
  // gracefully on older runtimes.
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
 * `PointerSample` per sub-event with world coords already derived.
 *
 * Browsers that batch high-frequency samples (Apple Pencil, drawing
 * tablets) expose them through `event.getCoalescedEvents()`. Pen / pencil
 * tools should iterate them for smooth strokes; mouse tools usually only
 * need the parent event and can ignore this.
 *
 * Fallback: when `getCoalescedEvents` is unavailable or returns an empty
 * list, the parent event itself is yielded once so callers don't drop
 * samples on older browsers.
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
    const screenX = e.clientX - ctx.canvasRect.left;
    const screenY = e.clientY - ctx.canvasRect.top;
    cb({
      clientX: e.clientX,
      clientY: e.clientY,
      screenX,
      screenY,
      worldX: screenX / ctx.view.scale.x + ctx.view.x,
      worldY: screenY / ctx.view.scale.y + ctx.view.y,
      stylus: getStylusData(e),
      event: e,
    });
  }
}

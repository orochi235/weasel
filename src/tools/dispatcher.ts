// src/tools/dispatcher.ts
import type { AnyTool, ToolCtx, ToolSlot, Decision } from './types';
import type { RenderLayer } from '../core/layers/render';
import type { ChromeState } from '../core/selection/chromeState';
import type { View } from '../core/viewport/view';
import type { HitResult } from '../affordances/types';

interface SlotsState {
  hotkey: AnyTool | null;
  active: AnyTool | null;
  ambient: AnyTool[];
}

export interface ToolsDispatcherOptions {
  /** Called on every event to read the current slot occupants. The
   *  dispatcher keeps no copy — `useTools` owns slot state and updates
   *  it as the user activates / engages tools. */
  getSlots: () => SlotsState;
  /** Called once per channel-handler invocation to construct the ctx
   *  the handler receives. `<Canvas>` supplies world coords, modifiers,
   *  selection, adapter, and applyBatch; the dispatcher injects scratch. */
  getCtx: (overrides?: {
    clientX?: number;
    clientY?: number;
    modifiers?: { alt: boolean; shift: boolean; meta: boolean; ctrl: boolean };
  }) => Omit<ToolCtx, 'scratch'>;
  /** Pixel distance the pointer must travel before a click is reclassified
   *  as a drag. Default 4. */
  threshold?: number;
  /** Optional callback fired whenever an in-flight gesture starts or ends
   *  (including phase transitions pending → drag → end/cancel). `useTools`
   *  uses this to bump a render tick so consumers reading
   *  `dispatcher.getActiveScratch()` (e.g. function-form `cursor`) re-resolve
   *  on real DOM events. */
  onGestureChange?: () => void;
  /** Time source for double-tap detection. Defaults to `Date.now`. Override
   *  in tests to drive the clock deterministically. */
  now?: () => number;
  /** Double-tap detection thresholds. */
  dblTap?: {
    /** Maximum interval between the two taps (ms). Default 300. */
    windowMs?: number;
    /** Maximum CSS-px distance between the two tap positions. Default 8. */
    maxDistance?: number;
  };
  /**
   * Optional. Returns the hit-test pipeline inputs:
   *   - `layers`: visible RenderLayers ordered TOP-DOWN (highest z-index first).
   *   - `chromeState`: passed as the `data` arg to each layer's hitTest call.
   *   - `view` / `dims`: passed to layer.hitTest for screen-space conversion.
   *
   * When supplied, the dispatcher consults each layer's hitTest on
   * pointerdown (top-down order) before the existing slot walk. Returns
   * null (or omit the callback entirely) to disable the layer pipeline —
   * legacy behavior.
   */
  getHitTestContext?: () => {
    layers: readonly RenderLayer<unknown>[];
    chromeState: ChromeState;
    view: View;
    dims: { width: number; height: number };
  } | null;
}

interface InFlight {
  tool: AnyTool;
  scratch: unknown;
  startClient: { x: number; y: number };
  /** 'pending' = pointer down, sub-threshold (or pointer.onDown claimed for
   *  classification); 'drag' = drag.onStart fired. */
  phase: 'pending' | 'drag';
}

export interface ToolsDispatcher {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  onWheel: (e: WheelEvent) => void;
  /** Force-cancel any in-flight gesture (used on explicit tool switch). */
  cancelGesture: () => void;
  /** Whether a gesture is currently in flight. Used by `useTools` to
   *  decide whether a modifier-key press should engage the hotkey slot
   *  (no, if mid-gesture). */
  hasActiveGesture: () => boolean;
  /** Scratch of the in-flight gesture, or `null` when idle. Exposed so
   *  consumers (cursor resolution, debug overlays) can read what the active
   *  tool is currently tracking. Read-only — do NOT mutate via this getter. */
  getActiveScratch: () => unknown;
}

function ctxFor(
  scratch: unknown,
  base: Omit<ToolCtx, 'scratch'>,
): ToolCtx {
  return { ...base, scratch };
}

function dispatchOnce<E>(
  slots: SlotsState,
  pick: (tool: AnyTool) => ((e: E, ctx: ToolCtx) => Decision) | undefined,
  event: E,
  baseCtx: Omit<ToolCtx, 'scratch'>,
  scratchFor: (tool: AnyTool) => unknown,
): AnyTool | null {
  const order: { slot: ToolSlot; tool: AnyTool }[] = [];
  if (slots.hotkey) order.push({ slot: 'hotkey', tool: slots.hotkey });
  if (slots.active) order.push({ slot: 'active', tool: slots.active });
  for (const t of slots.ambient) order.push({ slot: 'ambient', tool: t });

  for (const { tool } of order) {
    const handler = pick(tool);
    if (!handler) continue;
    const ctx = ctxFor(scratchFor(tool), baseCtx);
    const decision = handler(event, ctx);
    if (decision === 'claim') return tool;
  }
  return null;
}

export function createToolsDispatcher(opts: ToolsDispatcherOptions): ToolsDispatcher {
  const threshold = opts.threshold ?? 4;
  const now = opts.now ?? (() => Date.now());
  const dblTapWindowMs = opts.dblTap?.windowMs ?? 300;
  const dblTapMaxDistance = opts.dblTap?.maxDistance ?? 8;
  let inFlight: InFlight | null = null;
  /** Recorded on each sub-threshold pointerup. The next sub-threshold release
   *  within `dblTapWindowMs` and `dblTapMaxDistance` of this point fires
   *  `dblTap.onTap` on the active slot order. Cleared on fire (so three taps
   *  don't stack into two dblTaps) and on any drag promotion. */
  let lastTap: { x: number; y: number; time: number } | null = null;

  function getInitialScratch(tool: AnyTool): unknown {
    return tool.initScratch ? tool.initScratch() : undefined;
  }

  function tryClaimsAll(tool: AnyTool, baseCtx: Omit<ToolCtx, 'scratch'>): boolean {
    if (!tool.claimsAll) return false;
    const ctx = ctxFor(getInitialScratch(tool), baseCtx);
    return tool.claimsAll(ctx);
  }

  function endGesture(): void {
    inFlight = null;
    opts.onGestureChange?.();
  }

  function startSlotGesture(tool: AnyTool, e: PointerEvent, baseCtx: Omit<ToolCtx, 'scratch'>): void {
    // Modal claim path: route to the tool's pointer.onDown then drag pipeline,
    // same as the legacy path. The fact that claimsAll returned true is just a
    // signal that we shouldn't have walked layers — once we're past that
    // branch, the gesture shape is identical.
    const handler = tool.pointer?.onDown;
    const initScratch = getInitialScratch(tool);
    const ctx = ctxFor(initScratch, baseCtx);
    let claimedScratch: unknown = initScratch;
    if (handler) {
      const decision = handler(e, ctx);
      if (decision === 'claim') {
        claimedScratch = ctx.scratch;
      }
    }
    inFlight = {
      tool,
      scratch: claimedScratch,
      startClient: { x: e.clientX, y: e.clientY },
      phase: 'pending',
    };
    opts.onGestureChange?.();
  }

  function startAffordanceGesture(result: HitResult, e: PointerEvent): void {
    // Synthesize a virtual tool whose drag channel comes from the layer's
    // hit result. The dispatcher only references inFlight.tool.drag for
    // subsequent pointermove / pointerup; other Tool fields aren't
    // consulted mid-gesture, so the virtual record is sufficient.
    const virtualTool: AnyTool = {
      id: '__affordance__',
      drag: result.drag,
    } as AnyTool;
    // Build a minimal ctx for onStart. Use the same baseCtx the slot walk
    // would have used.
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    const startCtx = ctxFor(result.initialScratch, baseCtx);
    // Affordance hits skip threshold gating — the layer already decided
    // this is a gesture, not a click. Jump straight to 'drag' phase and
    // fire onStart immediately so subsequent moves route to onMove.
    result.drag.onStart?.(e, startCtx);
    inFlight = {
      tool: virtualTool,
      // Capture any scratch mutation from onStart.
      scratch: startCtx.scratch,
      startClient: { x: e.clientX, y: e.clientY },
      phase: 'drag',
    };
    opts.onGestureChange?.();
  }

  function onPointerDown(e: PointerEvent): void {
    if (inFlight) return; // ignore overlapping pointers; one gesture at a time
    const slots = opts.getSlots();
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    // 1. Modal claim check (hotkey > active). A tool whose state-aware
    //    `claimsAll` returns true bypasses the affordance layer pipeline
    //    entirely — used by tools mid-modal (pen mid-path, text mid-edit)
    //    where affordance hits would otherwise interrupt.
    if (slots.hotkey && tryClaimsAll(slots.hotkey, baseCtx)) {
      startSlotGesture(slots.hotkey, e, baseCtx);
      return;
    }
    if (slots.active && tryClaimsAll(slots.active, baseCtx)) {
      startSlotGesture(slots.active, e, baseCtx);
      return;
    }

    // 2. Layer hit-test pipeline. Walk visible layers top-down; first
    //    non-null HitResult routes the gesture to the layer-supplied
    //    drag channel (with optional initial scratch).
    const hitCtx = opts.getHitTestContext?.();
    if (hitCtx) {
      for (const layer of hitCtx.layers) {
        if (!layer.hitTest) continue;
        const result = layer.hitTest(
          baseCtx.worldX,
          baseCtx.worldY,
          // The dispatcher can't statically resolve TData per layer; the
          // contract is that every layer with hitTest expects ChromeState.
          hitCtx.chromeState as never,
          hitCtx.view,
          hitCtx.dims,
        );
        if (result !== null) {
          startAffordanceGesture(result, e);
          return;
        }
      }
    }

    // 3. Try pointer.onDown — classification pass. If a tool claims, it has
    //    had the opportunity to mutate ctx.scratch (e.g. stash which sub-gesture
    //    was hit). We capture the post-handler scratch so drag.* handlers see
    //    the same value. The gesture then enters `pending` phase: the drag
    //    pipeline (threshold → onStart → onMove → onEnd) still fires normally.
    //    This lets pointer.onDown act as a classification hook rather than a
    //    raw-pointer escape hatch — the pattern used by useSelectTool.
    const order: AnyTool[] = [];
    if (slots.hotkey) order.push(slots.hotkey);
    if (slots.active) order.push(slots.active);
    for (const t of slots.ambient) order.push(t);

    for (const tool of order) {
      const handler = tool.pointer?.onDown;
      if (!handler) continue;
      const initScratch = getInitialScratch(tool);
      const ctx = ctxFor(initScratch, baseCtx);
      const decision = handler(e, ctx);
      if (decision === 'claim') {
        // ctx.scratch may have been mutated by the handler — capture it.
        inFlight = {
          tool,
          scratch: ctx.scratch,
          startClient: { x: e.clientX, y: e.clientY },
          phase: 'pending',
        };
        opts.onGestureChange?.();
        return;
      }
    }

    // 4. No pointer.onDown claim — enter pending phase. The active tool
    //    (the first in slot order with a drag or pointer.onClick handler)
    //    becomes the prospective gesture owner.
    let owner: AnyTool | null = null;
    for (const t of [slots.hotkey, slots.active, ...slots.ambient].filter(Boolean) as AnyTool[]) {
      if (t.drag || t.pointer?.onClick) { owner = t; break; }
    }
    if (!owner) return;
    inFlight = {
      tool: owner,
      scratch: getInitialScratch(owner),
      startClient: { x: e.clientX, y: e.clientY },
      phase: 'pending',
    };
    opts.onGestureChange?.();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!inFlight) return;
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    if (inFlight.phase === 'pending') {
      const dx = e.clientX - inFlight.startClient.x;
      const dy = e.clientY - inFlight.startClient.y;
      if (dx * dx + dy * dy < threshold * threshold) return;
      // Crossed threshold: promote to drag, fire onStart with the
      // threshold-crossing event. Capture any scratch mutation onStart makes.
      // A drag also invalidates any pending dblTap anchor — a click→drag
      // sequence shouldn't latch into a dbl-tap when the drag completes.
      lastTap = null;
      const onStart = inFlight.tool.drag?.onStart;
      if (onStart) {
        const startCtx = ctxFor(inFlight.scratch, baseCtx);
        onStart(e, startCtx);
        inFlight.scratch = startCtx.scratch;
      }
      inFlight.phase = 'drag';
      opts.onGestureChange?.();
      return;
    }

    if (inFlight.phase === 'drag') {
      const onMove = inFlight.tool.drag?.onMove;
      if (onMove) onMove(e, ctxFor(inFlight.scratch, baseCtx));
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (!inFlight) return;
    const baseCtx = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });

    if (inFlight.phase === 'pending') {
      // Sub-threshold release. First check whether this is the *second* tap
      // of a double-tap; if so, fire `dblTap.onTap` on the active slot order.
      // A claim suppresses `pointer.onClick`; a pass falls through to click
      // so single-click handlers still run when no tool wants the dbl-tap.
      const slots = opts.getSlots();
      let dblTapClaimed = false;
      if (lastTap !== null) {
        const dx = e.clientX - lastTap.x;
        const dy = e.clientY - lastTap.y;
        const dt = now() - lastTap.time;
        if (dt <= dblTapWindowMs && dx * dx + dy * dy <= dblTapMaxDistance * dblTapMaxDistance) {
          // Walk slot order — hotkey → active → ambient — and fire the
          // first tool whose dblTap.onTap returns 'claim'. Each tool gets a
          // fresh scratch (dblTap is not part of a drag pipeline).
          const order: AnyTool[] = [];
          if (slots.hotkey) order.push(slots.hotkey);
          if (slots.active) order.push(slots.active);
          for (const t of slots.ambient) order.push(t);
          for (const tool of order) {
            const handler = tool.dblTap?.onTap;
            if (!handler) continue;
            const ctx = ctxFor(getInitialScratch(tool), baseCtx);
            const decision = handler(e, ctx);
            if (decision === 'claim') {
              dblTapClaimed = true;
              break;
            }
          }
          // Whether claimed or passed, the dbl-tap event consumed lastTap —
          // a third tap shouldn't pair with the second to fire again.
          lastTap = null;
        }
      }
      if (!dblTapClaimed) {
        const onClick = inFlight.tool.pointer?.onClick;
        if (onClick) onClick(e, ctxFor(inFlight.scratch, baseCtx));
        // Record this tap as a candidate first-of-pair for the next tap.
        // (If dblTap claimed above we already cleared lastTap; recording here
        // would let three taps fire two dblTaps.)
        if (lastTap === null) {
          lastTap = { x: e.clientX, y: e.clientY, time: now() };
        }
      }
    } else if (inFlight.phase === 'drag') {
      const onEnd = inFlight.tool.drag?.onEnd;
      if (onEnd) onEnd(e, ctxFor(inFlight.scratch, baseCtx));
    }
    endGesture();
  }

  function keyModifiers(e: KeyboardEvent) {
    return { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey };
  }

  function onKeyDown(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({ modifiers: keyModifiers(e) });
    dispatchOnce<KeyboardEvent>(
      slots,
      (t) => t.keyboard?.onDown,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
    );
  }

  function onKeyUp(e: KeyboardEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({ modifiers: keyModifiers(e) });
    dispatchOnce<KeyboardEvent>(
      slots,
      (t) => t.keyboard?.onUp,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
    );
  }

  function onWheel(e: WheelEvent): void {
    const slots = opts.getSlots();
    const base = opts.getCtx({
      clientX: e.clientX,
      clientY: e.clientY,
      modifiers: { alt: !!e.altKey, shift: !!e.shiftKey, meta: !!e.metaKey, ctrl: !!e.ctrlKey },
    });
    dispatchOnce<WheelEvent>(
      slots,
      (t) => t.wheel?.onWheel,
      e,
      base,
      (t) => (inFlight && inFlight.tool === t ? inFlight.scratch : getInitialScratch(t)),
    );
  }

  function cancelGesture(): void {
    if (!inFlight) return;
    if (inFlight.phase === 'drag') {
      const base = opts.getCtx();
      inFlight.tool.drag?.onCancel?.(ctxFor(inFlight.scratch, base));
    }
    endGesture();
  }

  const api: ToolsDispatcher & {
    __setGetCtx?: (fn: typeof opts.getCtx) => void;
    __setHitTestContext?: (fn: typeof opts.getHitTestContext) => void;
  } = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onWheel,
    cancelGesture,
    hasActiveGesture: () => inFlight !== null,
    getActiveScratch: () => inFlight?.scratch ?? null,
  };
  api.__setGetCtx = (fn) => { opts.getCtx = fn; };
  api.__setHitTestContext = (fn) => { opts.getHitTestContext = fn; };
  return api;
}

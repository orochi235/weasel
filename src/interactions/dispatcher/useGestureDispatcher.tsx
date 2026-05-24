/**
 * useGestureDispatcher — React seam mounting the gesture dispatcher.
 *
 * Composes the four input channels (window keydown/keyup, canvas wheel, canvas
 * pointer events, multi-touch synthesized from PointerEvents) and routes them
 * to a single Dispatcher instance. Reads ActiveToolContext + DepRegistry
 * internally; consumer passes the canvas ref, actions registry, and tools map.
 *
 * Side-effect only (returns void).
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § Q4.
 */
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { isEditableTarget } from '../keyHelpers';
import { useActiveToolContext } from '../actions/activeToolContext';
import { useDepRegistry } from '../actions/depRegistry';
import type { ActionsRegistry } from '../actions/registry';
import type { AffordanceHit } from '../actions/invoker';
import type { Tool } from '../../tools/types';
import { createDispatcher, type Dispatcher, type DispatcherContext } from './dispatcher';
import type { InputEvent } from './matcher';

// ---------------------------------------------------------------------------
// Platform detection — module-level constant so it's stable across renders.
// ---------------------------------------------------------------------------

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(
    (navigator as { platform?: string }).platform ?? navigator.userAgent,
  );

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export interface UseGestureDispatcherOptions {
  /** Ref to the canvas element. Pointer/wheel/multitouch listeners attach here. */
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Action registry (ActionsRegistry from registry.tsx). */
  actions: ActionsRegistry;
  /** Tool definitions keyed by id. Phase 3 typically passes an empty Map. */
  toolsById: ReadonlyMap<string, Tool>;
  /** Default true. Set false to opt out of dispatcher wiring (e.g. demos that disable it). */
  enabled?: boolean;
  /**
   * Optional affordance classifier. Called on every pointerdown with the
   * world-space coordinates of the pointer. Returns an `AffordanceHit` when
   * the pointer lands on a known affordance (resize handle, rotate handle, etc.)
   * or `null` when the pointer hit open canvas.
   *
   * The hit is packed into `InputEvent.pointerdown.affordance` and flows
   * through into `InvocationCtx.drag.affordance`. Action invokers that require
   * a specific affordance (e.g. `resizeAction` requires `handle:*`) use this
   * field as a guard in their `start` body.
   *
   * When omitted, `affordance` is always `undefined` — meaning only consumers
   * that explicitly wire a classifier get affordance-gated behavior. Phase 13
   * will wire the full chrome→dispatcher bridge via `<SceneCanvas>`.
   */
  affordanceAt?: (worldPoint: { x: number; y: number }) => AffordanceHit | null;

  /**
   * Optional body-target classifier. Called on every pointerdown with the
   * world-space coordinates of the pointer. Returns a classification string
   * that `matchTarget` uses to resolve string-form `TargetSpec` values in
   * `Tool.bindings` drag specs.
   *
   * Returns `'empty'` when nothing is under the pointer, `'selected-body'`
   * when the topmost hit belongs to the current selection, or
   * `'unselected-body'` when it belongs to a node that isn't selected.
   *
   * When omitted, string-form target specs (`'empty'`, `'selected-body'`,
   * `'unselected-body'`) never match — bindings using those specs are
   * silently skipped. Phase 13 wires this via `<SceneCanvas>`.
   */
  classifyTarget?: (worldPoint: { x: number; y: number }) => 'empty' | 'selected-body' | 'unselected-body';

  /**
   * Optional pre-created `Dispatcher`. When provided, this hook pumps events
   * into the supplied instance instead of creating its own. Lets a parent
   * scope (e.g. `<SceneCanvas>`) share one dispatcher between the gesture
   * mounter and other consumers (the preview-ghost layer in Phase 14e).
   */
  dispatcher?: Dispatcher;

  /**
   * Converts a client-space pointer position (e.g. `e.clientX`, `e.clientY`)
   * to world-space coordinates. When supplied, every pointer/wheel event's
   * `x`/`y` is converted before the dispatcher builds `InvocationCtx.world`.
   *
   * Without this, `ctx.world` is populated with the raw client coords, which
   * silently breaks any action whose overlay/output uses absolute world
   * positions (marquee, lasso polyline, world-space affordances). Actions
   * that only read `drag.delta` are unaffected because client→world deltas
   * are equal at scale 1, but as soon as a consumer pans/zooms the view the
   * deltas diverge too.
   *
   * `<SceneCanvas>` always wires this via its canvas rect + current view.
   * Tests / harnesses without a view can omit it and continue passing raw
   * coordinates as before.
   */
  clientToWorld?: (clientX: number, clientY: number) => { x: number; y: number };

  /**
   * Invoked once per pump event (`pointermove`, `pointerup`, `pointercancel`,
   * `key-held` up-phase, `multitouch` move) when a dispatcher-side handle is
   * in flight. Lets the host canvas schedule a redraw so dispatcher-only
   * overlays (marquee, lasso, preview-ghost) repaint on each frame.
   *
   * Required because dispatcher actions don't go through the legacy
   * `tools.dispatcher.onGestureChange` redraw bump that ambient tool drags
   * relied on. Without it, the overlay layer's `draw` never runs between
   * pointerdown and pointerup, and the chrome flashes once at gesture start
   * and then sits frozen until the gesture ends.
   *
   * `<SceneCanvas>` wires this to the canvas's `requestRedraw`. Test
   * harnesses can omit it; their dispatchers won't paint between events but
   * that's already the test contract.
   */
  requestRedraw?: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute centroid and spread (distance between first two pointers) from
 * the active pointer positions map. Returns a centroid of (0, 0) and spread
 * of 0 when fewer than 2 pointers are present.
 */
function computeMultiTouchGeometry(
  positions: Map<number, { x: number; y: number }>,
): { centroid: { x: number; y: number }; spread: number } {
  const pts = [...positions.values()];
  if (pts.length < 2) {
    return { centroid: { x: 0, y: 0 }, spread: 0 };
  }
  // Centroid across all active pointers.
  let sumX = 0;
  let sumY = 0;
  for (const p of pts) {
    sumX += p.x;
    sumY += p.y;
  }
  const centroid = { x: sumX / pts.length, y: sumY / pts.length };
  // Spread = distance between the first two pointers (primary pair).
  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const spread = Math.sqrt(dx * dx + dy * dy);
  return { centroid, spread };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGestureDispatcher(opts: UseGestureDispatcherOptions): void {
  const { canvasRef, actions, toolsById, enabled = true, affordanceAt, classifyTarget, dispatcher: dispatcherOpt, clientToWorld, requestRedraw } = opts;
  const activeTool = useActiveToolContext();
  const depRegistry = useDepRegistry();

  // Single dispatcher instance, stable across renders. When a `dispatcher`
  // is supplied via options, adopt it; otherwise create one lazily.
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = dispatcherOpt ?? createDispatcher();
  }

  // Stable ref to the latest context values so event listeners always see
  // current state without needing to re-register on every render.
  const ctxRef = useRef<DispatcherContext>({
    actions,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    toolsById,
    isMac: IS_MAC,
  });
  ctxRef.current = {
    actions,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    toolsById,
    isMac: IS_MAC,
  };

  // Stable refs for optional thunks so the effect closure always sees the latest version.
  const affordanceAtRef = useRef(affordanceAt);
  affordanceAtRef.current = affordanceAt;
  const classifyTargetRef = useRef(classifyTarget);
  classifyTargetRef.current = classifyTarget;
  const clientToWorldRef = useRef(clientToWorld);
  clientToWorldRef.current = clientToWorld;
  const requestRedrawRef = useRef(requestRedraw);
  requestRedrawRef.current = requestRedraw;

  // Double-click synthesis state. Lives at hook level (not inside the effect)
  // so it survives effect re-runs — otherwise HMR / StrictMode / a transient
  // deps change resets it between the two clicks and the doubleclick never
  // fires.
  const lastClickRef = useRef<{ t: number; clientX: number; clientY: number } | null>(null);

  // Cancel in-flight ongoing handles when active tool changes (not on initial mount).
  const prevActiveRef = useRef(activeTool.active);
  useEffect(() => {
    if (prevActiveRef.current !== activeTool.active) {
      dispatcherRef.current?.cancelAll('cancel');
    }
    prevActiveRef.current = activeTool.active;
  });

  useEffect(() => {
    if (!enabled) return;

    const dispatcher = dispatcherRef.current!;
    const canvas = canvasRef.current;

    // Convert a client-space pointer position to world-space. When no
    // `clientToWorld` thunk is wired (legacy harnesses / tests), this is the
    // identity — preserves pre-fix behavior for callers that pass raw event
    // coords as if they were world. SceneCanvas always wires the thunk via
    // its canvas rect + current view, so `ctx.world` becomes real world coords
    // for areaSelect / lassoSelect / world-space affordance consumers.
    const toWorld = (cx: number, cy: number): { x: number; y: number } => {
      const fn = clientToWorldRef.current;
      return fn ? fn(cx, cy) : { x: cx, y: cy };
    };

    // Dispatch + bump the host canvas's redraw when any handle was in flight
    // before, during, or after the event. Without this, dispatcher-only
    // overlays (marquee, lasso) never repaint after their initial frame.
    // `before` captures the pre-event state so we redraw on the pump that
    // CLOSES a gesture (e.g. pointerup-with-no-remaining-handles still needs
    // to clear the overlay).
    const dispatch = (ev: InputEvent): 'handled' | 'unhandled' => {
      const before = dispatcher.inFlight().size;
      const result = dispatcher.handleInput(ev, ctxRef.current);
      const after = dispatcher.inFlight().size;
      if (before > 0 || after > 0) requestRedrawRef.current?.();
      return result;
    };

    // Tracks keys that have an in-flight key-held handle so we fire the up
    // phase only when warranted.
    const heldKeys = new Set<string>();

    // Tracks active pointer IDs for multi-touch synthesis.
    const activePointers = new Set<number>();

    // Tracks latest screen-space position per pointer ID.
    // Used to compute centroid + spread for pinch-zoom pump events.
    const pointerPositions = new Map<number, { x: number; y: number }>();

    // Tracks the start state of an active multitouch episode so we can
    // synthesize a `multitouchtap` event on release when the centroid hasn't
    // moved past the tap threshold. `fingers` records the peak count.
    let multiTouchStart: { fingers: number; centroid: { x: number; y: number } } | null = null;
    const TAP_THRESHOLD_PX = 8;

    // Pixel distance the pointer must travel between pointerdown and the first
    // pointermove before we treat the gesture as a drag and forward the
    // pointerdown to the dispatcher. Below this, pointerup is treated as a
    // click — no drag handle is ever opened, so `moveAction` (and other
    // ongoing drag actions) don't fire on a stationary press-and-release.
    const DRAG_THRESHOLD_PX = 4;

    // Per-pointer buffered pointerdown InputEvents waiting on the drag
    // threshold. The InputEvent is built eagerly (so `affordance` /
    // `bodyTarget` reflect down-time classification) but withheld from the
    // dispatcher until movement crosses the threshold. On sub-threshold
    // pointerup the buffer is discarded.
    const bufferedDown = new Map<number, { ev: InputEvent; clientX: number; clientY: number }>();

    // Tracks the last pointerdown info for click synthesis:
    // a pointerup with no in-flight drag handle is promoted to a click event.
    // `bodyTarget` from the pointerdown is carried forward so click specs that
    // use string-form targets ('empty', 'selected-body') match correctly.
    const lastPointerDown = new Map<number, {
      clientX: number;
      clientY: number;
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
    }>();

    // Double-click synthesis thresholds. 600ms matches the upper end of OS
    // double-click settings; 8px tolerates the natural drift of a real
    // mouse / trackpad between the two clicks. State (`lastClickRef`)
    // lives at hook level so it survives effect re-runs.
    const DOUBLE_CLICK_MAX_MS = 600;
    const DOUBLE_CLICK_MAX_PX = 8;

    // -----------------------------------------------------------------------
    // Window key listeners
    // -----------------------------------------------------------------------

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      // Dispatch both key and key-held forms unconditionally. The dispatcher
      // de-dupes naturally because each form uses a different gestureId and
      // different GestureSpec kind. `matchBest` returns 'unhandled' when no
      // binding matches the alternate form, so there's no double-fire risk.

      const keyEv: InputEvent = {
        kind: 'key',
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        repeat: e.repeat,
      };
      const keyResult = dispatch(keyEv);

      // Key-repeat keydowns must NOT re-engage a key-held binding. Each
      // repeat would call `start()` again (pushing another sidearm hotkey,
      // etc.) while only one keyup eventually fires a single `onEnd`,
      // leaving the stack permanently populated. Plain `key` (immediate)
      // bindings still fire per repeat — that's the OS-level autorepeat
      // semantics consumers expect for things like step-zoom.
      const heldResult: 'handled' | 'unhandled' = e.repeat
        ? 'unhandled'
        : dispatch({
            kind: 'key-held',
            key: e.key,
            phase: 'down',
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
          });

      if (heldResult === 'handled') {
        heldKeys.add(e.key);
      }

      if (keyResult === 'handled' || heldResult === 'handled') {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!heldKeys.has(e.key)) return;
      const ev: InputEvent = {
        kind: 'key-held',
        key: e.key,
        phase: 'up',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatch(ev);
      heldKeys.delete(e.key);
    };

    // -----------------------------------------------------------------------
    // Canvas wheel listener
    // -----------------------------------------------------------------------

    const onWheel = (e: WheelEvent) => {
      // Convert client-space cursor to canvas-local: zoomAt() (and any other
      // wheel consumer of clientX/Y) anchors in canvas-top-left coords, not
      // viewport coords. Without this, anchored-wheel zoom drifts by the
      // canvas's offset from the viewport top-left.
      const rect = canvas?.getBoundingClientRect();
      const localX = rect ? e.clientX - rect.left : e.clientX;
      const localY = rect ? e.clientY - rect.top : e.clientY;
      const ev: InputEvent = {
        kind: 'wheel',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: localX,
        clientY: localY,
      };
      const result = dispatch(ev);
      // When a binding claims the wheel (viewport.zoom on Cmd+wheel, viewport.pan
      // on plain wheel, etc.), the page must not also scroll. Suppress the
      // default + bubble so a parent scroll container doesn't move while the
      // canvas is zooming or panning.
      if (result === 'handled') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // -----------------------------------------------------------------------
    // Canvas pointer listeners + multi-touch synthesis
    // -----------------------------------------------------------------------

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Capture the pointer so pointermove/pointerup keep firing on the
      // canvas after the cursor leaves its rect — critical for drag actions
      // that continue past the canvas edge (resize handles, area-select,
      // viewport pan). Browser auto-releases on pointerup/cancel. Wrapped
      // in try/catch because some test environments (jsdom) don't implement
      // setPointerCapture; never block the dispatcher path on a missing API.
      try {
        canvas?.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore — best-effort capture
      }

      // Classify the affordance at the pointerdown world-space position.
      // The thunk is optional — when absent, affordance is undefined (no-op).
      // Both thunks receive world-space coords; SceneCanvas supplies the
      // client→world conversion internally via its canvas ref + view.
      const worldPoint = { x: e.clientX, y: e.clientY };
      const affordance = affordanceAtRef.current?.(worldPoint) ?? undefined;
      const bodyTarget = classifyTargetRef.current?.(worldPoint) ?? undefined;

      const w = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'pointerdown',
        target: e.target,
        x: w.x,
        y: w.y,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...(affordance !== undefined ? { affordance } : {}),
        ...(bodyTarget !== undefined ? { bodyTarget } : {}),
      };
      // Defer dispatch until the first past-threshold pointermove. A bare
      // press-and-release should fire `click`, not start a drag action.
      bufferedDown.set(e.pointerId, { ev, clientX: e.clientX, clientY: e.clientY });

      // Store pointerdown info for click synthesis (see onPointerUp).
      lastPointerDown.set(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
        bodyTarget,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      });

      // Synthesize a multi-touch event when >= 2 pointers are active.
      if (activePointers.size >= 2) {
        const { centroid, spread } = computeMultiTouchGeometry(pointerPositions);
        // Capture start state for tap synthesis. On the first 1→2 transition
        // we record the centroid; subsequent pointerdowns at higher finger
        // counts only bump the recorded peak fingers count.
        if (!multiTouchStart) {
          multiTouchStart = { fingers: activePointers.size, centroid: { ...centroid } };
        } else {
          multiTouchStart.fingers = activePointers.size;
        }
        const mt: InputEvent = {
          kind: 'multitouch',
          fingers: activePointers.size,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          centroid,
          spread,
        };
        dispatch(mt);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      // Update this pointer's tracked position.
      if (activePointers.has(e.pointerId)) {
        pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // Threshold gate: if a pointerdown is buffered for this pointer and
      // the movement crossed the drag threshold, forward the buffered
      // pointerdown to the dispatcher BEFORE the pointermove. This is what
      // opens the ongoing drag handle (matching `kind: 'drag'` bindings);
      // subsequent pointermoves pump it via `onMove`. Sub-threshold
      // pointermoves are still forwarded so existing pump paths (e.g. other
      // in-flight handles) keep working, but they're no-ops when no handle
      // exists.
      const buffered = bufferedDown.get(e.pointerId);
      if (buffered) {
        const dx = e.clientX - buffered.clientX;
        const dy = e.clientY - buffered.clientY;
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          bufferedDown.delete(e.pointerId);
          dispatch(buffered.ev);
        }
      }

      // If a multitouch handle is in flight, synthesize a multitouch pump event
      // with the updated centroid + spread. The dispatcher routes this to the
      // handle's onMove (because the event carries centroid data).
      const mtGestureId = `multitouch-${activePointers.size}`;
      if (activePointers.size >= 2 && dispatcher.inFlight().has(mtGestureId)) {
        const { centroid, spread } = computeMultiTouchGeometry(pointerPositions);
        const mtEv: InputEvent = {
          kind: 'multitouch',
          fingers: activePointers.size,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          centroid,
          spread,
        };
        dispatch(mtEv);
        // Also dispatch the raw pointermove so single-pointer handles can coexist.
      }

      const w = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'pointermove',
        x: w.x,
        y: w.y,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatch(ev);
    };

    const onPointerUp = (e: PointerEvent) => {
      const prevSize = activePointers.size;
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);

      // If pointerdown was buffered (sub-threshold gesture), discard it —
      // the dispatcher never saw it, so no drag handle is in flight. Click
      // synthesis below picks up the bare press-and-release path.
      bufferedDown.delete(e.pointerId);

      // When pointer count drops below 2, commit any in-flight multitouch handle
      // and (if the centroid never moved past the tap threshold) synthesize a
      // `multitouchtap` event carrying the peak fingers count.
      // The gestureId is keyed by the PREVIOUS size (before this pointer was removed)
      // because that was the handle's finger count when it was opened.
      if (prevSize >= 2 && activePointers.size < 2) {
        const mtGestureId = `multitouch-${prevSize}`;
        if (dispatcher.inFlight().has(mtGestureId)) {
          // Synthesize a pointerup for the multitouch gesture — dispatcher needs
          // a pointerup to route to onEnd, but multitouch handles aren't keyed as
          // 'pointer-mouse'. We use cancelAll to safely commit all in-flight handles
          // of this gesture; only the multitouch handle should be active.
          // Use 'commit' because this is a natural lift (not a cancel).
          dispatcher.cancelAll('commit');
        }
        // Synthesize a tap if the centroid hasn't moved past threshold.
        const start = multiTouchStart;
        if (start) {
          // Final centroid uses the pointer positions BEFORE this pointer was
          // removed — we already deleted it above, so reconstruct it.
          const finalPositions = new Map(pointerPositions);
          finalPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const { centroid } = computeMultiTouchGeometry(finalPositions);
          const dx = centroid.x - start.centroid.x;
          const dy = centroid.y - start.centroid.y;
          if (Math.hypot(dx, dy) <= TAP_THRESHOLD_PX) {
            const tap: InputEvent = {
              kind: 'multitouchtap',
              fingers: start.fingers,
              altKey: e.altKey,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              shiftKey: e.shiftKey,
            };
            dispatch(tap);
          }
          multiTouchStart = null;
        }
      }

      // Check whether a drag handle is in-flight BEFORE sending pointerup.
      // If the pointer-mouse handle is in-flight AND the pointer moved between
      // down and up, this is the end of a real drag — pump it and don't
      // synthesize a click. If no handle is in-flight, or the handle was
      // opened but the pointer never moved (sub-threshold "tap" that an
      // over-broad ambient drag binding accepted), we still synthesize a
      // click so click-specific bindings (e.g. clearSelection on empty) fire.
      const downForClick = lastPointerDown.get(e.pointerId);
      const movedDuringDrag = downForClick
        ? (downForClick.clientX !== e.clientX || downForClick.clientY !== e.clientY)
        : true;
      const hadDragInFlight = dispatcher.inFlight().has('pointer-mouse') && movedDuringDrag;

      const wUp = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'pointerup',
        x: wUp.x,
        y: wUp.y,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatch(ev);

      const down = lastPointerDown.get(e.pointerId);
      lastPointerDown.delete(e.pointerId);

      // Synthesize a click when there was no in-flight drag handle — i.e.
      // the pointerdown never matched a drag binding and the user released
      // without movement. Carry the `bodyTarget` from the pointerdown so
      // click specs with string-form targets ('empty', 'selected-body') match.
      if (!hadDragInFlight && down) {
        const wClick = toWorld(e.clientX, e.clientY);
        const clickEv: InputEvent = {
          kind: 'click',
          target: e.target,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          worldX: wClick.x,
          worldY: wClick.y,
          ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
        };
        dispatch(clickEv);

        // Double-click synthesis: emit a `doubleclick` event AFTER the
        // second click when two clicks land within DOUBLE_CLICK_MAX_MS and
        // DOUBLE_CLICK_MAX_PX. Reset the tracker after a successful
        // doubleclick so a third click doesn't compose another one
        // (triple-click semantics are not modeled).
        const now = Date.now();
        const prev = lastClickRef.current;
        const dx = e.clientX - (prev?.clientX ?? 0);
        const dy = e.clientY - (prev?.clientY ?? 0);
        if (prev && now - prev.t < DOUBLE_CLICK_MAX_MS && Math.hypot(dx, dy) < DOUBLE_CLICK_MAX_PX) {
          const dblEv: InputEvent = {
            kind: 'doubleclick',
            target: e.target,
            altKey: e.altKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            worldX: wClick.x,
            worldY: wClick.y,
            ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
          };
          dispatch(dblEv);
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { t: now, clientX: e.clientX, clientY: e.clientY };
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);
      lastPointerDown.delete(e.pointerId);
      bufferedDown.delete(e.pointerId);
      // Drop any pending multitouch-tap start state — a cancel means we should
      // not synthesize a tap on the subsequent up.
      multiTouchStart = null;
      const ev: InputEvent = {
        kind: 'pointercancel',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatch(ev);
    };

    // -----------------------------------------------------------------------
    // Canvas contextmenu listener (right-click)
    // -----------------------------------------------------------------------

    const onContextMenu = (e: MouseEvent) => {
      // Suppress native menu so tools/actions own the right-click UX.
      e.preventDefault();
      const worldPoint = { x: e.clientX, y: e.clientY };
      const bodyTarget = classifyTargetRef.current?.(worldPoint) ?? undefined;
      const ev: InputEvent = {
        kind: 'contextmenu',
        target: e.target,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...(bodyTarget !== undefined ? { bodyTarget } : {}),
      };
      dispatch(ev);
    };

    // -----------------------------------------------------------------------
    // Attach
    // -----------------------------------------------------------------------

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas?.addEventListener('wheel', onWheel, { passive: false });
    canvas?.addEventListener('pointerdown', onPointerDown);
    canvas?.addEventListener('pointermove', onPointerMove);
    canvas?.addEventListener('pointerup', onPointerUp);
    canvas?.addEventListener('pointercancel', onPointerCancel);
    canvas?.addEventListener('contextmenu', onContextMenu);

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas?.removeEventListener('wheel', onWheel);
      canvas?.removeEventListener('pointerdown', onPointerDown);
      canvas?.removeEventListener('pointermove', onPointerMove);
      canvas?.removeEventListener('pointerup', onPointerUp);
      canvas?.removeEventListener('pointercancel', onPointerCancel);
      canvas?.removeEventListener('contextmenu', onContextMenu);
      dispatcher.cancelAll('cancel');
    };
  }, [enabled, canvasRef]);
}

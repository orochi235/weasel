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
import { isEditableTarget } from '../actions/useKeybinding';
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
  const { canvasRef, actions, toolsById, enabled = true, affordanceAt, classifyTarget } = opts;
  const activeTool = useActiveToolContext();
  const depRegistry = useDepRegistry();

  // Single dispatcher instance, stable across renders.
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher();
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

    // Tracks keys that have an in-flight key-held handle so we fire the up
    // phase only when warranted.
    const heldKeys = new Set<string>();

    // Tracks active pointer IDs for multi-touch synthesis.
    const activePointers = new Set<number>();

    // Tracks latest screen-space position per pointer ID.
    // Used to compute centroid + spread for pinch-zoom pump events.
    const pointerPositions = new Map<number, { x: number; y: number }>();

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
      const keyResult = dispatcher.handleInput(keyEv, ctxRef.current);

      const heldEv: InputEvent = {
        kind: 'key-held',
        key: e.key,
        phase: 'down',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      const heldResult = dispatcher.handleInput(heldEv, ctxRef.current);

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
      dispatcher.handleInput(ev, ctxRef.current);
      heldKeys.delete(e.key);
    };

    // -----------------------------------------------------------------------
    // Canvas wheel listener
    // -----------------------------------------------------------------------

    const onWheel = (e: WheelEvent) => {
      const ev: InputEvent = {
        kind: 'wheel',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      dispatcher.handleInput(ev, ctxRef.current);
    };

    // -----------------------------------------------------------------------
    // Canvas pointer listeners + multi-touch synthesis
    // -----------------------------------------------------------------------

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Classify the affordance at the pointerdown world-space position.
      // The thunk is optional — when absent, affordance is undefined (no-op).
      // Both thunks receive world-space coords; SceneCanvas supplies the
      // client→world conversion internally via its canvas ref + view.
      const worldPoint = { x: e.clientX, y: e.clientY };
      const affordance = affordanceAtRef.current?.(worldPoint) ?? undefined;
      const bodyTarget = classifyTargetRef.current?.(worldPoint) ?? undefined;

      const ev: InputEvent = {
        kind: 'pointerdown',
        target: e.target,
        x: e.clientX,
        y: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...(affordance !== undefined ? { affordance } : {}),
        ...(bodyTarget !== undefined ? { bodyTarget } : {}),
      };
      dispatcher.handleInput(ev, ctxRef.current);

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
        dispatcher.handleInput(mt, ctxRef.current);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      // Update this pointer's tracked position.
      if (activePointers.has(e.pointerId)) {
        pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
        dispatcher.handleInput(mtEv, ctxRef.current);
        // Also dispatch the raw pointermove so single-pointer handles can coexist.
      }

      const ev: InputEvent = {
        kind: 'pointermove',
        x: e.clientX,
        y: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatcher.handleInput(ev, ctxRef.current);
    };

    const onPointerUp = (e: PointerEvent) => {
      const prevSize = activePointers.size;
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);

      // When pointer count drops below 2, commit any in-flight multitouch handle.
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
      }

      // Check whether a drag handle is in-flight BEFORE sending pointerup.
      // If the pointer-mouse handle is in-flight, this is the end of a drag —
      // pump it and don't synthesize a click. If no handle is in-flight, this
      // is a sub-threshold release and we synthesize a click event afterward.
      const hadDragInFlight = dispatcher.inFlight().has('pointer-mouse');

      const ev: InputEvent = {
        kind: 'pointerup',
        x: e.clientX,
        y: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatcher.handleInput(ev, ctxRef.current);

      const down = lastPointerDown.get(e.pointerId);
      lastPointerDown.delete(e.pointerId);

      // Synthesize a click when there was no in-flight drag handle — i.e.
      // the pointerdown never matched a drag binding and the user released
      // without movement. Carry the `bodyTarget` from the pointerdown so
      // click specs with string-form targets ('empty', 'selected-body') match.
      if (!hadDragInFlight && down) {
        const clickEv: InputEvent = {
          kind: 'click',
          target: e.target,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
        };
        dispatcher.handleInput(clickEv, ctxRef.current);
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);
      lastPointerDown.delete(e.pointerId);
      const ev: InputEvent = {
        kind: 'pointercancel',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      dispatcher.handleInput(ev, ctxRef.current);
    };

    // -----------------------------------------------------------------------
    // Attach
    // -----------------------------------------------------------------------

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas?.addEventListener('wheel', onWheel);
    canvas?.addEventListener('pointerdown', onPointerDown);
    canvas?.addEventListener('pointermove', onPointerMove);
    canvas?.addEventListener('pointerup', onPointerUp);
    canvas?.addEventListener('pointercancel', onPointerCancel);

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
      dispatcher.cancelAll('cancel');
    };
  }, [enabled, canvasRef]);
}

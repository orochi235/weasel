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
import type { Tool, ToolCtx } from '../../tools/types';
import { createDispatcher, pointerGestureId, type Dispatcher, type DispatcherContext } from './dispatcher';
import { clientToCanvasRect } from 'core/viewport/clientToCanvas';
import { itemsFromDataTransfer, itemsFromClipboardData } from 'features/ingestion/ingestItems';
import type { InputEvent } from './matcher';
import type { BodyTarget, BodyClassification } from '@weasel-js/gestures';

// ---------------------------------------------------------------------------
// Drop-over styling — class toggled on the canvas while an OS drag hovers it;
// consumers style it. Not exported: the string is an observable public value
// but the symbol is internal.
// ---------------------------------------------------------------------------

/** Class toggled on the canvas while an OS drag hovers it — consumers style it. */
const DROPOVER_CLASS = 'weasel-dropover';

/**
 * Lift the stylus fields off a DOM `PointerEvent` onto the normalized
 * `InputEvent`. Kept as a spread-able partial so a synthetic event that
 * carries none of them stays free of `undefined`-valued keys.
 *
 * These ride the drag trail (`InvocationCtx.drag.points`) so pressure- and
 * tilt-aware actions — `insertAction`'s pencil kind today — can reach the
 * per-sample data without their own pointer plumbing.
 */
function stylusOf(e: PointerEvent): {
  pressure?: number; tiltX?: number; tiltY?: number;
} {
  return {
    ...(typeof e.pressure === 'number' ? { pressure: e.pressure } : {}),
    ...(typeof e.tiltX === 'number' ? { tiltX: e.tiltX } : {}),
    ...(typeof e.tiltY === 'number' ? { tiltY: e.tiltY } : {}),
  };
}

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
  /** Tool definitions keyed by id. Typically passes an empty Map. */
  toolsById: ReadonlyMap<string, Tool>;
  /** Ids (within `toolsById`) of always-on tools, whose bindings assemble at
   *  ambient scope. See `DispatcherContext.ambientToolIds`. */
  ambientToolIds?: readonly string[];
  /** Default true. Set false to opt out of dispatcher wiring (e.g. demos that disable it). */
  enabled?: boolean;
  /**
   * Observer fired whenever the dispatcher synthesizes a double click, in
   * world coordinates. Runs BEFORE the event is dispatched and independently
   * of which binding (if any) handles it.
   *
   * This is deliberately not an Action. `<SceneCanvas onDoubleClick>` is a
   * notification — "the user double-clicked, here's what they hit" — and a
   * notification must not compete with behavior for the gesture. As a binding
   * it would lose to `enterPathEdit` on any body hit and silently never fire.
   * Routing it here keeps a single definition of "double click" (the point of
   * consolidating the kit's three detectors) without giving it
   * first-match-wins semantics it shouldn't have.
   */
  onDoubleClick?: (world: { x: number; y: number }) => void;
  /**
   * Default true. Set false to leave the window `keydown`/`keyup` listeners
   * unattached so keyboard-bound actions never dispatch — pointer, wheel, and
   * contextmenu channels stay live. `<SceneCanvas>` wires this to
   * `enableKeybindings`, so opting out of keybindings disables the modern
   * dispatcher key path as well as the legacy `useKeybindings` hook.
   */
  keyboard?: boolean;
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
   * that explicitly wire a classifier get affordance-gated behavior.
   * `<SceneCanvas>` wires the full chrome→dispatcher bridge.
   */
  affordanceAt?: (worldPoint: { x: number; y: number }) => AffordanceHit | null;

  /**
   * Optional body classifier. Called on every pointerdown with the world-space
   * coordinates of the pointer. Its result is packed onto the event as
   * `bodyTarget` + `bodyKind`, which `matchTarget` reads to resolve the
   * string-form `TargetSpec` values in `Tool.bindings`.
   *
   * `body` is `'empty'` when nothing is under the pointer, `'selected-body'`
   * when the topmost hit belongs to the current selection, or
   * `'unselected-body'` when it belongs to a node that isn't selected. `kind`
   * is the hit node's semantic kind, when the scene can name it.
   *
   * When omitted, every body-derived target form (`'empty'`,
   * `'selected-body'`, `'unselected-body'`, `kind:<k>`, `kind:<k>:selected`)
   * never matches — bindings using those specs are silently skipped.
   * `<SceneCanvas>` wires this.
   */
  classifyTarget?: (worldPoint: { x: number; y: number }) => BodyClassification;

  /**
   * Optional pre-created `Dispatcher`. When provided, this hook pumps events
   * into the supplied instance instead of creating its own. Lets a parent
   * scope (e.g. `<SceneCanvas>`) share one dispatcher between the gesture
   * mounter and other consumers (the preview-ghost layer).
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

  /**
   * Thunk returning the live `RuleCtx` for the current frame. When supplied,
   * the dispatcher filters matched candidates by their declared
   * `Action.eligible` rule (omitted => always eligible). `<SceneCanvas>`
   * wires this; tests / harnesses without chrome-caps state can omit it.
   */
  getRuleCtx?: () => import('../../features/chrome-caps').RuleCtx;
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
  const { canvasRef, actions, toolsById, ambientToolIds, enabled = true, keyboard = true, affordanceAt, classifyTarget, dispatcher: dispatcherOpt, clientToWorld, requestRedraw, getRuleCtx, onDoubleClick } = opts;
  const onDoubleClickRef = useRef(onDoubleClick);
  onDoubleClickRef.current = onDoubleClick;
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
    ambientToolIds,
    isMac: IS_MAC,
    getRuleCtx,
  });
  ctxRef.current = {
    actions,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    toolsById,
    ambientToolIds,
    isMac: IS_MAC,
    getRuleCtx,
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

  // Tool-switch lifecycle. Two things have to happen when the active tool
  // changes (and only then — not on initial mount):
  //   1. Fire the outgoing tool's `onDeactivate(ctx)` so it can clean up
  //      tool-owned scratch state. Pen relies on this to discard a
  //      half-built path the user hasn't committed.
  //   2. Cancel any in-flight ongoing dispatcher handles so the new tool
  //      doesn't inherit a live gesture.
  //
  // The `ToolCtx` passed to `onDeactivate` is intentionally minimal — at
  // this lifecycle moment there's no event-driven cursor position, hit
  // result, or modifier state to populate. We pass the tool's own scratch
  // (via `initScratch()`, which tools that hold persistent state implement
  // as a singleton ref-return) so cleanup hooks can read/mutate the only
  // state they actually care about. Fields the implementation reads beyond
  // `scratch` will read undefined; tools whose cleanup needs more should
  // either rely on closure-captured refs (the pen-tool pattern) or wait
  // until we have a real cause to broaden the contract.
  const prevActiveRef = useRef(activeTool.active);
  useEffect(() => {
    if (prevActiveRef.current !== activeTool.active) {
      const prevTool = toolsById.get(prevActiveRef.current) as Tool<unknown> | undefined;
      if (prevTool?.onDeactivate) {
        const scratch = prevTool.initScratch?.();
        try {
          prevTool.onDeactivate({ scratch } as unknown as ToolCtx<unknown>);
        } catch (err) {
          console.error(
            `weasel: tool "${prevActiveRef.current}".onDeactivate threw`,
            err,
          );
        }
      }
      dispatcherRef.current?.cancelAll('cancel');
    }
    prevActiveRef.current = activeTool.active;
  });

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

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
      /** DOM event target of the press. Replayed onto a synthesized
       *  `contextmenu`, whose matcher resolves targets against it. */
      target: unknown;
      clientX: number;
      clientY: number;
      /** World-space press point, forwarded onto the synthesized click as
       *  `pressX`/`pressY` — see `ClickEvent`. */
      worldX: number;
      worldY: number;
      /** Affordance the press landed on, replayed onto the click. */
      affordance?: unknown;
      bodyTarget?: BodyTarget;
      bodyKind?: string;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
    }>();

    // Long-press synthesis. Armed on pointerdown for touch/pen, cancelled by
    // movement past DRAG_THRESHOLD_PX, by release, by cancel, or by a second
    // pointer landing (so it can never fire mid-pinch).
    const LONG_PRESS_MS = 500;
    const longPressTimers = new Map<number, ReturnType<typeof setTimeout>>();

    const cancelLongPress = (pointerId: number): void => {
      const t = longPressTimers.get(pointerId);
      if (t !== undefined) {
        clearTimeout(t);
        longPressTimers.delete(pointerId);
      }
    };

    const cancelAllLongPress = (): void => {
      for (const t of longPressTimers.values()) clearTimeout(t);
      longPressTimers.clear();
    };

    /** Fire a synthesized long-press, falling back to contextmenu when the
     *  long-press matched nothing. The fallback is what makes existing
     *  `contextMenu` bindings reachable by touch with no consumer change. */
    const fireLongPress = (pointerId: number): void => {
      const down = lastPointerDown.get(pointerId);
      if (!down) return;

      const shared = {
        target: down.target,
        altKey: down.altKey,
        ctrlKey: down.ctrlKey,
        metaKey: down.metaKey,
        shiftKey: down.shiftKey,
        ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
        ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
      };

      const result = dispatch({
        kind: 'longpress',
        x: down.worldX,
        y: down.worldY,
        clientX: down.clientX,
        clientY: down.clientY,
        ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
        ...shared,
      } as InputEvent);

      if (result === 'unhandled') {
        dispatch({ kind: 'contextmenu', ...shared } as InputEvent);
      }
    };

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

      // Autorepeat for a key that's already engaged a key-held binding is
      // suppressed entirely — no dispatch (no trace flood) and the
      // browser default is blocked. Holding Space-for-hand otherwise
      // streamed an 'unhandled' immediate-`key` trace entry per repeat.
      // Autorepeat for a key that ISN'T held still dispatches normally,
      // so things like Cmd+= step-zoom keep auto-repeating.
      if (e.repeat && heldKeys.has(e.key)) {
        e.preventDefault();
        return;
      }

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

      // Always dispatch key-held DOWN, even on autorepeat. The dispatcher's
      // own defense returns 'handled' (no-op) when a handle is already in
      // flight for this gestureId, which both prevents start() re-invocation
      // and lets us preventDefault the repeat so the page doesn't react.
      const heldEv: InputEvent = {
        kind: 'key-held',
        key: e.key,
        phase: 'down',
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };
      const heldResult = dispatch(heldEv);

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
      const [localX, localY] = rect
        ? clientToCanvasRect(rect, e.clientX, e.clientY)
        : [e.clientX, e.clientY];
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
      // Only the primary button drives gesture dispatch. `pointerdown` reports
      // `button === 0` for the left mouse button and for touch / pen contact;
      // secondary (right, `2`) and middle (`1`) mouse buttons are left for the
      // consumer's own tools (e.g. right-drag viewport pan) and the browser
      // context menu. Without this guard a right-drag is classified and routed
      // exactly like a left-drag — selecting + transforming under the cursor
      // instead of letting an ambient pan tool claim it. An absent `button`
      // (synthetic / programmatic events) counts as primary.
      if ((e.button ?? 0) !== 0) return;
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
      const body = classifyTargetRef.current?.(worldPoint);
      const bodyTarget = body?.body;
      const bodyKind = body?.kind;

      const w = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'pointerdown',
        target: e.target,
        pointerId: e.pointerId,
        x: w.x,
        y: w.y,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...stylusOf(e),
        ...(affordance !== undefined ? { affordance } : {}),
        ...(bodyTarget !== undefined ? { bodyTarget } : {}),
        ...(bodyKind !== undefined ? { bodyKind } : {}),
      };
      // Defer dispatch until the first past-threshold pointermove. A bare
      // press-and-release should fire `click`, not start a drag action.
      bufferedDown.set(e.pointerId, { ev, clientX: e.clientX, clientY: e.clientY });

      // ...but dispatch a `stage: 'press'` copy right now, for bindings that
      // must act while the button is still down and before the gesture is
      // classified (select highlights the pressed node here). `matchSpec`
      // routes the two copies to disjoint spec kinds — `pointerDown` matches
      // only this one, `drag` only the buffered one — so a single press never
      // fires both.
      dispatch({ ...ev, stage: 'press' });

      // Store pointerdown info for click synthesis (see onPointerUp).
      lastPointerDown.set(e.pointerId, {
        target: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
        worldX: w.x,
        worldY: w.y,
        affordance,
        bodyTarget,
        bodyKind,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      });

      // Arm long-press for touch / pen only, and only for a lone pointer —
      // a second finger means a multi-touch gesture, not a long-press.
      if ((e.pointerType === 'touch' || e.pointerType === 'pen')
          && activePointers.size === 1) {
        cancelLongPress(e.pointerId);
        longPressTimers.set(
          e.pointerId,
          setTimeout(() => {
            longPressTimers.delete(e.pointerId);
            if (disposed) return;
            fireLongPress(e.pointerId);
          }, LONG_PRESS_MS),
        );
      }

      // Synthesize a multi-touch event when >= 2 pointers are active.
      if (activePointers.size >= 2) {
        cancelAllLongPress();
        // MULTI-POINTER POLICY: the multitouch channel takes ownership of
        // every pointer that hasn't already committed to a gesture. Dropping
        // the buffered press is what enforces it — a claimed pointer opens no
        // drag handle on the next move, and synthesizes no click on release
        // (both of those read the buffer). The `multitouch-<fingers>` handle
        // and the `multitouchtap` synthesis below are the whole gesture.
        //
        // This used to hold by accident: `gestureIdFor` returned one key for
        // every pointer, so a second finger's press found the first's handle
        // in flight and no-oped. Per-pointer keying removes the accident, so
        // the policy has to be stated. Stating it is the improvement — a
        // pointer that is part of a pinch is not also dragging something.
        //
        // Note the asymmetry: a pointer that already opened a drag has no
        // buffer left to claim, so its gesture survives the second finger
        // landing. Yanking a drag out from under someone who rested a palm is
        // worse than letting it finish.
        for (const id of activePointers) bufferedDown.delete(id);

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
          cancelLongPress(e.pointerId);
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
        pointerId: e.pointerId,
        x: w.x,
        y: w.y,
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...stylusOf(e),
      };
      dispatch(ev);

      lastHover = {
        clientX: e.clientX, clientY: e.clientY,
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      refreshHoverCursor();
    };

    // -----------------------------------------------------------------------
    // Hover-cursor pump
    // -----------------------------------------------------------------------
    //
    // On every idle pointermove (no pressed pointer, no in-flight handle),
    // resolve what sits under the pointer and write a cursor override
    // directly to `canvas.style.cursor`. Precedence:
    //
    //   1. Affordance hit declaring `AffordanceHit.cursor` (resize corners,
    //      rotate ring) — the same `affordanceAt` hit-test pointerdown uses.
    //   2. The action a drag from here would route to (`resolveOnly`, the
    //      same match walk pointerdown takes), when it declares
    //      `Action.cursor` — e.g. `viewport.dragPan` → 'grab' over empty
    //      canvas when pan would win the drag.
    //   3. No override — clear the inline style so the active tool's
    //      React-managed `Tool.cursor` (the implicit base) shows through.
    //
    // Mid-gesture the pump stands down; the tool-cursor pipeline
    // (function-form `Tool.cursor` re-resolving on `gestureTick`) owns the
    // cursor there. The override is an inline style on purpose: clearing it
    // restores the React-managed base without effect churn.
    //
    // `lastHover` lets modifier keydown/keyup refresh the prediction without
    // pointer movement (a held Space re-routes the drag to the hand tool).
    // That refresh is deferred a tick so React can commit the hotkey-stack /
    // active-tool state the key event just changed — `ctxRef` is only
    // rewritten on render.
    let lastHover: {
      clientX: number; clientY: number;
      altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
    } | null = null;
    let cursorOverridden = false;
    const clearHoverCursor = () => {
      if (cursorOverridden && canvas) {
        canvas.style.cursor = '';
        cursorOverridden = false;
      }
    };
    const applyHoverCursor = (cursor: string | null) => {
      if (cursor && canvas) {
        canvas.style.cursor = cursor;
        cursorOverridden = true;
      } else {
        clearHoverCursor();
      }
    };
    function refreshHoverCursor(): void {
      if (!canvas || !lastHover) return;
      // Mid-gesture the prediction is meaningless — what matters is what the
      // gesture IS. An in-flight action's `activeCursor` wins; with none
      // declared the override clears and the active tool's `Tool.cursor`
      // shows through, as before.
      if (activePointers.size > 0 || dispatcher.inFlight().size > 0) {
        applyHoverCursor(dispatcher.inFlightCursor());
        return;
      }
      const h = lastHover;
      const screenPoint = { x: h.clientX, y: h.clientY };
      const affordance = affordanceAtRef.current?.(screenPoint) ?? undefined;
      if (affordance?.cursor) {
        applyHoverCursor(affordance.cursor);
        return;
      }
      const hoverBody = classifyTargetRef.current?.(screenPoint);
      const bodyTarget = hoverBody?.body;
      const bodyKind = hoverBody?.kind;
      const w = toWorld(h.clientX, h.clientY);
      const predicted = dispatcher.resolveOnly(
        {
          kind: 'pointerdown',
          x: w.x,
          y: w.y,
          clientX: h.clientX,
          clientY: h.clientY,
          altKey: h.altKey,
          ctrlKey: h.ctrlKey,
          metaKey: h.metaKey,
          shiftKey: h.shiftKey,
          ...(affordance !== undefined ? { affordance } : {}),
          ...(bodyTarget !== undefined ? { bodyTarget } : {}),
          ...(bodyKind !== undefined ? { bodyKind } : {}),
        },
        ctxRef.current,
      );
      applyHoverCursor(predicted?.action.cursor ?? null);
    }
    /** Modifier/hotkey changes re-route the predicted drag without pointer
     *  movement. Refresh after a tick so the key event's React state
     *  (hotkey stack, active tool) has committed into `ctxRef`. */
    const scheduleHoverCursorRefresh = (e: KeyboardEvent) => {
      if (!lastHover) return;
      lastHover = {
        ...lastHover,
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      setTimeout(() => {
        if (!disposed) refreshHoverCursor();
      }, 0);
    };
    const onHoverPointerLeave = () => {
      lastHover = null;
      clearHoverCursor();
    };

    const onPointerUp = (e: PointerEvent) => {
      cancelLongPress(e.pointerId);
      const prevSize = activePointers.size;
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);

      // If pointerdown was still buffered, the pointer never crossed the drag
      // threshold — the dispatcher never saw the press, so no drag handle is
      // in flight and this release is a click. Crossing the threshold deletes
      // the buffer whether or not a drag binding matched, which makes this the
      // authoritative "did the pointer move?" signal for click synthesis.
      const staysUnderThreshold = bufferedDown.delete(e.pointerId);

      // When pointer count drops below 2, commit any in-flight multitouch handle
      // and (if the centroid never moved past the tap threshold) synthesize a
      // `multitouchtap` event carrying the peak fingers count.
      // The gestureId is keyed by the PREVIOUS size (before this pointer was removed)
      // because that was the handle's finger count when it was opened.
      if (prevSize >= 2 && activePointers.size < 2) {
        const mtGestureId = `multitouch-${prevSize}`;
        if (dispatcher.inFlight().has(mtGestureId)) {
          // Synthesize a pointerup for the multitouch gesture — dispatcher needs
          // a pointerup to route to onEnd, but multitouch handles are keyed by
          // finger count, not by pointer. We use cancelAll to safely commit all
          // in-flight handles of this gesture; only the multitouch handle
          // should be active (see the multi-pointer policy in onPointerMove).
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
      // If THIS pointer's handle is in-flight AND the pointer moved between
      // down and up, this is the end of a real drag — pump it and don't
      // synthesize a click. If no handle is in-flight, or the handle was
      // opened but the pointer never moved (sub-threshold "tap" that an
      // over-broad ambient drag binding accepted), we still synthesize a
      // click so click-specific bindings (e.g. clearSelection on empty) fire.
      const downForClick = lastPointerDown.get(e.pointerId);
      const movedDuringDrag = downForClick
        ? (downForClick.clientX !== e.clientX || downForClick.clientY !== e.clientY)
        : true;
      const hadDragInFlight =
        dispatcher.inFlight().has(pointerGestureId(e.pointerId)) && movedDuringDrag;

      const wUp = toWorld(e.clientX, e.clientY);
      const ev: InputEvent = {
        kind: 'pointerup',
        pointerId: e.pointerId,
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

      // Synthesize a click when the pointer neither opened a drag handle nor
      // travelled past the drag threshold. Carry the `bodyTarget` from the
      // pointerdown so click specs with string-form targets ('empty',
      // 'selected-body') match.
      //
      // The threshold half of that test is load-bearing for any tool that
      // binds `click` but not `drag`: without it, dragging clear across the
      // canvas and releasing synthesized a click, because "no drag handle
      // opened" was the only condition. `ClickSpec` documents itself as
      // "pointerdown + pointerup without movement past the threshold" — this
      // is the code finally agreeing with it.
      if (!hadDragInFlight && staysUnderThreshold && down) {
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
          pressX: down.worldX,
          pressY: down.worldY,
          ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
          ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
          ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
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
            ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
          };
          // Notify observers first — see `onDoubleClick`'s doc for why this
          // is not modeled as a binding.
          onDoubleClickRef.current?.({ x: wClick.x, y: wClick.y });
          dispatch(dblEv);
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { t: now, clientX: e.clientX, clientY: e.clientY };
        }
      }

      // Re-resolve the hover cursor at the release point — deferred a tick
      // so any state the up/click actions changed (selection, active tool)
      // has committed before prediction reruns.
      lastHover = {
        clientX: e.clientX, clientY: e.clientY,
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      setTimeout(() => {
        if (!disposed) refreshHoverCursor();
      }, 0);
    };

    const onPointerCancel = (e: PointerEvent) => {
      cancelLongPress(e.pointerId);
      activePointers.delete(e.pointerId);
      pointerPositions.delete(e.pointerId);
      lastPointerDown.delete(e.pointerId);
      bufferedDown.delete(e.pointerId);
      // Drop any pending multitouch-tap start state — a cancel means we should
      // not synthesize a tap on the subsequent up.
      multiTouchStart = null;
      const ev: InputEvent = {
        kind: 'pointercancel',
        pointerId: e.pointerId,
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
      const menuBody = classifyTargetRef.current?.(worldPoint);
      const ev: InputEvent = {
        kind: 'contextmenu',
        target: e.target,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        ...(menuBody?.body !== undefined ? { bodyTarget: menuBody.body } : {}),
        ...(menuBody?.kind !== undefined ? { bodyKind: menuBody.kind } : {}),
      };
      dispatch(ev);
    };

    // -----------------------------------------------------------------------
    // External-content ingestion: OS drop on the canvas, paste on window.
    // Items are materialized DURING the event (DataTransfer is only live on
    // the event stack); dispatch happens when materialization resolves.
    // -----------------------------------------------------------------------

    // Attached to both dragover and dragenter: cancelling dragenter (WHATWG)
    // guarantees the element stays the active drop target and shows the copy
    // cursor on entry rather than waiting for the first dragover tick.
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      // preventDefault is what makes the canvas a valid drop target.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      canvas?.classList.add(DROPOVER_CLASS);
    };

    const onDragLeave = () => {
      canvas?.classList.remove(DROPOVER_CLASS);
    };

    // No stopPropagation: handled-ness is only known after the async
    // materialization microtask, so a conditional stop (wheel-style) is
    // impossible; an unconditional one would swallow drops the kit doesn't
    // dispatch. Callers that need exclusivity should gate on the action result.
    const onDrop = (e: DragEvent) => {
      canvas?.classList.remove(DROPOVER_CLASS);
      const dt = e.dataTransfer;
      if (!dt) return;
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      // Real modifiers forwarded (Option-drag is a copy-drag on macOS); the
      // kit ingest binding declares all modifiers optional, so they can't
      // block the default route — but a consumer binding may key on them.
      const base = {
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      void itemsFromDataTransfer(dt).then((items) => {
        if (disposed) return;
        if (items.length === 0) return;
        dispatch({
          kind: 'drop', items,
          x: w.x, y: w.y, clientX: e.clientX, clientY: e.clientY,
          ...base,
        });
      });
    };

    const onPaste = (e: ClipboardEvent) => {
      // Text-editing surfaces (inputs, the text-edit overlay) own their own
      // paste — never steal it for scene ingestion.
      if (isEditableTarget(e.target)) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const items = itemsFromClipboardData(cd);
      if (items.length === 0) return;
      e.preventDefault();
      dispatch({
        kind: 'paste', items,
        // ClipboardEvent carries no modifier state.
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      });
    };

    // -----------------------------------------------------------------------
    // Attach
    // -----------------------------------------------------------------------

    if (keyboard) {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
    }
    // Hover-cursor refresh on modifier/hotkey changes — separate listeners
    // (not folded into onKeyDown/onKeyUp) so the pump also tracks modifiers
    // when `keyboard: false` disables gesture key dispatch.
    window.addEventListener('keydown', scheduleHoverCursorRefresh);
    window.addEventListener('keyup', scheduleHoverCursorRefresh);
    canvas?.addEventListener('pointerleave', onHoverPointerLeave);
    canvas?.addEventListener('wheel', onWheel, { passive: false });
    canvas?.addEventListener('pointerdown', onPointerDown);
    canvas?.addEventListener('pointermove', onPointerMove);
    canvas?.addEventListener('pointerup', onPointerUp);
    canvas?.addEventListener('pointercancel', onPointerCancel);
    canvas?.addEventListener('contextmenu', onContextMenu);
    canvas?.addEventListener('dragenter', onDragOver);
    canvas?.addEventListener('dragover', onDragOver);
    canvas?.addEventListener('dragleave', onDragLeave);
    canvas?.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      if (keyboard) {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      }
      window.removeEventListener('keydown', scheduleHoverCursorRefresh);
      window.removeEventListener('keyup', scheduleHoverCursorRefresh);
      canvas?.removeEventListener('pointerleave', onHoverPointerLeave);
      canvas?.removeEventListener('wheel', onWheel);
      canvas?.removeEventListener('pointerdown', onPointerDown);
      canvas?.removeEventListener('pointermove', onPointerMove);
      canvas?.removeEventListener('pointerup', onPointerUp);
      canvas?.removeEventListener('pointercancel', onPointerCancel);
      canvas?.removeEventListener('contextmenu', onContextMenu);
      canvas?.removeEventListener('dragenter', onDragOver);
      canvas?.removeEventListener('dragover', onDragOver);
      canvas?.removeEventListener('dragleave', onDragLeave);
      canvas?.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      canvas?.classList.remove(DROPOVER_CLASS);
      clearHoverCursor();
      cancelAllLongPress();
      disposed = true;
      dispatcher.cancelAll('cancel');
    };
  }, [enabled, keyboard, canvasRef]);
}

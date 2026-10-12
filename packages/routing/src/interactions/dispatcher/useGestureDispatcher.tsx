/**
 * Mounts the gesture dispatcher: composes the input channels (keys, wheel,
 * WebKit gesture events, pointer events, and multi-touch synthesized from
 * them) and routes each event to the dispatcher for the view it landed in.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { useActiveToolContext } from '../actions/activeToolContext';
import { useDepRegistry } from '../actions/depRegistry';
import { isTool } from '../../tools/types';
import {
  createDispatcher, pointerGestureId, publishLiveDispatch, type Dispatcher, type DispatcherContext,
} from './dispatcher';
import { isApplePlatform, isInControlWithin, pastDragThreshold } from '@weasel-js/gestures';
import { openPointerSession, type PointerSession } from '../pointerSession';
import { clientToCanvasRect } from '../../viewport/clientToCanvas';
import type { InputEvent } from './matcher';
import { LONG_PRESS_MS } from './longPressState';
import { underPointer, type UnderPointer } from './underPointer';
import { longPressEvents, type PressFacts } from './pressFacts';
import type { CursorSpec } from '@weasel-js/cursor';
import { resolveCursorTier } from '@weasel-js/cursor';
import { createDispatchCore } from './dispatchCore';
import type { DispatcherViewTarget, UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import { contextMenuInput } from './channels/contextMenu';
import { DROPOVER_CLASS, ingestInput } from './channels/ingest';
import { keyboardInput } from './channels/keyboard';
import { webkitPinchInput } from './channels/webkitPinch';
import { wheelInput } from './channels/wheel';

export type {
  DispatcherChannels, DispatcherViewTarget, UseGestureDispatcherOptions, ViewIdResolver,
} from './gestureDispatcherOptions';

/**
 * The stylus fields of a DOM `PointerEvent`, as a spread-able partial so a
 * synthetic event that carries none of them stays free of `undefined`-valued keys.
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

const IS_MAC = isApplePlatform();

/** A pointer held on the canvas, and everything a press is synthesized from. */
interface HeldPointer {
  session: PointerSession;
  /** Latest screen position, for the multitouch centroid and spread. */
  pos: { x: number; y: number };
  /** The press, withheld from the dispatcher until movement crosses
   *  `DRAG_THRESHOLD_PX`. Null once forwarded, or once multitouch claimed
   *  the pointer — see the multi-pointer policy in `onPointerDown`. */
  buffered: { ev: InputEvent; clientX: number; clientY: number } | null;
  down: PressFacts;
  /** Set on a pointer that armed a long-press, for as long as it is held. */
  holdType?: 'touch' | 'pen';
}

/**
 * Centroid of every pointer and spread (distance between the first two).
 * Both are zero with fewer than 2 pointers.
 */
function computeMultiTouchGeometry(
  positions: Iterable<{ x: number; y: number }>,
): { centroid: { x: number; y: number }; spread: number } {
  const pts = [...positions];
  if (pts.length < 2) {
    return { centroid: { x: 0, y: 0 }, spread: 0 };
  }
  let sumX = 0;
  let sumY = 0;
  for (const p of pts) {
    sumX += p.x;
    sumY += p.y;
  }
  const centroid = { x: sumX / pts.length, y: sumY / pts.length };
  const dx = pts[1].x - pts[0].x;
  const dy = pts[1].y - pts[0].y;
  const spread = Math.sqrt(dx * dx + dy * dy);
  return { centroid, spread };
}

/**
 * Attach the input pipeline to a canvas: DOM pointer, wheel, keyboard, and
 * multitouch listeners in, normalized input events out, routed through the
 * dispatcher to whichever action a binding names.
 *
 * The active tool and the dep registry come from context, so it must be
 * mounted inside `<SceneCanvas>`'s providers.
 */
export function useGestureDispatcher(opts: UseGestureDispatcherOptions): void {
  const { canvasRef, actions, entriesById, enabled = true, keyboard = true, affordanceAt, classifyTarget, dispatcher: dispatcherOpt, clientToWorld, requestRedraw, paintedCursor, getRuleCtx, onClick, onDoubleClick, views, channels, longPress, claimKeys = false } = opts;
  // Read out as booleans, not the object: the attach effect depends on
  // them, and an inline `channels={{...}}` would re-bind every listener on
  // every render.
  const pointerChannel = channels?.pointer !== false;
  const wheelChannel = channels?.wheel !== false;
  const pinchChannel = channels?.pinch !== false;
  const contextMenuChannel = channels?.contextMenu !== false;
  const ingestChannel = channels?.ingest !== false;
  const onClickRef = useLatest(onClick);
  const onDoubleClickRef = useLatest(onDoubleClick);
  const activeTool = useActiveToolContext();
  const depRegistry = useDepRegistry();

  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = dispatcherOpt ?? createDispatcher();
  }

  // No `getRuleCtx` here: eligibility is a per-view answer, so it rides on the
  // dispatch record and `ctxNow` installs the routed view's.
  const registryRef = useLatest(actions);
  const ctxRef = useLatest<DispatcherContext>({
    actions,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    entriesById,
    isMac: IS_MAC,
  });

  // The flat options are view zero.
  const rootTargetRef = useLatest<DispatcherViewTarget>({
    id: null, dispatcher: dispatcherRef.current, affordanceAt, classifyTarget, clientToWorld,
    getRuleCtx,
  });
  const viewsRef = useLatest(views);

  /** Every live dispatcher — what a cancel-everything has to reach. */
  const allDispatchers = useCallback((): Dispatcher[] => [
    rootTargetRef.current.dispatcher,
    ...(viewsRef.current?.targets() ?? []).map((t) => t.dispatcher),
  ], [rootTargetRef, viewsRef]);
  const requestRedrawRef = useLatest(requestRedraw);
  const paintedCursorRef = useLatest(paintedCursor);
  const longPressRef = useLatest(longPress);

  // Double-click state lives at hook level so it survives effect re-runs: a
  // re-run between the two clicks would otherwise drop the doubleclick.
  const lastClickRef = useRef<{ t: number; clientX: number; clientY: number } | null>(null);

  // A tool is live while it holds the active slot or sits in the hotkey
  // stack. A switch of the active tool also cancels in-flight handles, so the
  // new tool does not inherit a live gesture — between the outgoing tools'
  // cleanup and the incoming tools' setup.
  const liveToolsRef = useRef<ReadonlySet<string>>(new Set());
  const prevActiveRef = useRef(activeTool.active);
  const entriesByIdRef = useLatest(entriesById);
  const lifecycleScratchRef = useRef(new Map<string, unknown>());
  const fireLifecycle = useCallback((id: string, hook: 'onActivate' | 'onDeactivate'): void => {
    const scratches = lifecycleScratchRef.current;
    const tool = entriesByIdRef.current.get(id);
    if (!tool || !isTool(tool)) {
      scratches.delete(id);
      return;
    }
    if (hook === 'onActivate' || !scratches.has(id)) scratches.set(id, tool.initScratch?.());
    const scratch = scratches.get(id);
    if (hook === 'onDeactivate') scratches.delete(id);
    const fn = tool[hook];
    if (!fn) return;
    try {
      fn({ scratch });
    } catch (err) {
      console.error(`weasel: tool "${id}".${hook} threw`, err);
    }
  }, [entriesByIdRef]);
  useEffect(() => {
    const prev = liveToolsRef.current;
    const next = new Set<string>(
      activeTool.active === null ? activeTool.hotkeyStack : [activeTool.active, ...activeTool.hotkeyStack],
    );
    liveToolsRef.current = next;
    for (const id of prev) if (!next.has(id)) fireLifecycle(id, 'onDeactivate');
    if (prevActiveRef.current !== activeTool.active) {
      for (const d of allDispatchers()) d.cancelAll('cancel');
    }
    prevActiveRef.current = activeTool.active;
    for (const id of next) if (!prev.has(id)) fireLifecycle(id, 'onActivate');
  });
  useEffect(() => () => {
    const live = liveToolsRef.current;
    liveToolsRef.current = new Set();
    for (const id of live) fireLifecycle(id, 'onDeactivate');
  }, [fireLifecycle]);

  useEffect(() => {
    if (enabled && claimKeys) registryRef.current.activate();
  }, [enabled, claimKeys, registryRef]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const canvas = canvasRef.current;
    const core = createDispatchCore({
      canvas,
      root: () => rootTargetRef.current,
      views: () => viewsRef.current,
      context: () => ctxRef.current,
      actions: () => registryRef.current,
      requestRedraw: () => { requestRedrawRef.current?.(); },
      disposed: () => disposed,
    });
    const { target, routeAt, routeDown, routeRelease, dispatcherNow, ctxNow, toWorld, dispatch } = core;
    const keys = keyboardInput(core);
    const { onKeyDown, onKeyUp } = keys;
    const pinch = webkitPinchInput(core);
    const { onGestureStart, onGestureChange, onGestureEnd } = pinch;
    const onWheel = wheelInput(core, pinch.live);
    const onContextMenu = contextMenuInput(core, () => takeNativeHold());
    const { onDragOver, onDragLeave, onDrop, onPaste } = ingestInput(core);

    const held = new Map<number, HeldPointer>();
    // Pinch anchors land in `zoomAt`, which measures from the canvas top-left:
    // client coords would drift the zoom by the canvas's offset from the viewport.
    const toCanvasLocal = (p: { x: number; y: number }): { x: number; y: number } => {
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return p;
      const [x, y] = clientToCanvasRect(rect, p.x, p.y);
      return { x, y };
    };
    const heldGeometry = () => {
      const { centroid, spread } = computeMultiTouchGeometry(
        [...held.values()].map((p) => p.pos),
      );
      return { centroid: toCanvasLocal(centroid), spread };
    };

    // Start state of the active multitouch episode, for synthesizing a
    // `multitouchtap` on release. `fingers` records the peak count.
    let multiTouchStart: {
      fingers: number;
      centroid: { x: number; y: number };
      /** Where each finger was when it joined, and whether any has left it:
       *  a pinch about a still center moves every finger and no centroid. */
      at: Map<number, { x: number; y: number }>;
      moved: boolean;
      /** `performance.now()` when the second finger landed. */
      startedAt: number;
    } | null = null;
    const TAP_THRESHOLD_PX = 8;

    // Long-press timers, armed on pointerdown for touch/pen. A second pointer
    // landing cancels them, so one can never fire mid-pinch.
    const longPressTimers = new Map<number, ReturnType<typeof setTimeout>>();

    const clearPending = (pointerId?: number): void => {
      const store = longPressRef.current?.state;
      const p = store?.get();
      if (p && (pointerId === undefined || p.pointerId === pointerId)) store!.set(null);
    };

    const cancelLongPress = (pointerId: number): void => {
      const t = longPressTimers.get(pointerId);
      if (t !== undefined) {
        clearTimeout(t);
        longPressTimers.delete(pointerId);
      }
      clearPending(pointerId);
    };

    const cancelAllLongPress = (): void => {
      for (const t of longPressTimers.values()) clearTimeout(t);
      longPressTimers.clear();
      clearPending();
    };

    const HAPTIC_MS = 15;

    /** Whether holding `down` to the end would fire anything: the same two
     *  dispatches `fireLongPress` makes, predicted without invoking. */
    const longPressWouldFire = (down: PressFacts): boolean => {
      const evs = longPressEvents(down);
      const d = dispatcherNow();
      return d.resolveOnly(evs.longpress, ctxNow()) !== null
        || d.resolveOnly(evs.contextmenu, ctxNow()) !== null;
    };

    const fireLongPress = (pointerId: number, pointerType: string): void => {
      const rec = held.get(pointerId);
      clearPending(pointerId);
      if (!rec) return;
      const evs = longPressEvents(rec.down);
      let result = dispatch(evs.longpress);
      if (result === 'unhandled') result = dispatch(evs.contextmenu);
      // The press is spent: dropping the buffer is what keeps its release
      // from clicking and a later move from opening a drag.
      if (result === 'handled') rec.buffered = null;
      if (result === 'handled' && longPressRef.current?.haptics !== false
          && (pointerType === 'touch' || pointerType === 'pen')
          && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(HAPTIC_MS);
      }
    };

    /** Whether a touch or pen that armed a long-press is still held. One that
     *  is still pending fires here, ahead of its timer. */
    const takeNativeHold = (): boolean => {
      let holding = false;
      for (const [id, rec] of held) {
        if (!rec.holdType) continue;
        holding = true;
        if (!longPressTimers.has(id)) continue;
        cancelLongPress(id);
        fireLongPress(id, rec.holdType);
      }
      return holding;
    };

    // 600ms matches the upper end of OS double-click settings; 8px tolerates
    // the drift of a real mouse or trackpad between the two clicks.
    const DOUBLE_CLICK_MAX_MS = 600;
    const DOUBLE_CLICK_MAX_PX = 8;

    // A window that loses focus never delivers the keyup, so without this every
    // in-flight key-held handle stays engaged until that key is pressed again.
    // Nor can a drag trust the release it may or may not see later, so every
    // held pointer is canceled — through its session, which reports once.
    const onWindowBlur = () => {
      pinch.end();
      for (const p of [...held.values()]) p.session.cancel();
      keys.releaseAll();
    };

    // A double click this dispatcher acted on is spent: the browser's own
    // `dblclick` that follows is marked handled, so a container that opens or
    // toggles on double-click leaves it alone.
    let claimedDoubleClick = false;
    const onNativeDoubleClick = (e: MouseEvent) => {
      if (!claimedDoubleClick) return;
      claimedDoubleClick = false;
      e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent) => {
      claimedDoubleClick = false;
      // Only the primary button (left mouse, touch, pen contact) drives
      // gesture dispatch; the others are left for the consumer's own tools and
      // the browser context menu. An absent `button` (synthetic events) counts
      // as primary.
      if ((e.button ?? 0) !== 0) return;
      if (!canvas) return;
      // A button or field laid over the canvas handles its own press: opening a
      // session here would capture the pointer and retarget its click.
      if (isInControlWithin(e.target, canvas)) return;
      routeDown(e.pointerId, e.clientX, e.clientY);

      const w = toWorld(e.clientX, e.clientY);
      const affordance = target().affordanceAt?.(w) ?? undefined;
      const body = target().classifyTarget?.(w);
      const bodyTarget = body?.body;
      const bodyKind = body?.kind;
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
      // The session owns the rest of this pointer: capture, the moves, the
      // release, and recovery from a release that never arrives. A press on a
      // pointer one is already open for cancels that stale gesture before this
      // handler runs — its `pointerdown` listener is on the document, in the
      // capture phase, ahead of this one on the canvas.
      held.set(e.pointerId, {
        session: openPointerSession(canvas, e, {
          onMove: onPointerMove,
          onEnd: onPointerUp,
          onCancel: () => { onPointerCancel(e.pointerId); },
        }),
        pos: { x: e.clientX, y: e.clientY },
        // Deferred until the first past-threshold pointermove: a bare
        // press-and-release should fire `click`, not start a drag action.
        buffered: { ev, clientX: e.clientX, clientY: e.clientY },
        down: {
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
        },
      });

      // The press itself dispatches now, for bindings that must act while the
      // button is still down and before the gesture is classified. The two
      // copies match disjoint spec kinds — `pointerDown` only this one, `drag`
      // only the buffered one — so a single press never fires both.
      //
      // Withheld once a second pointer is down: this press belongs to the
      // multitouch channel under the MULTI-POINTER POLICY below, or a pinch's
      // second finger would move the selection under the gesture.
      if (held.size < 2) dispatch({ ...ev, stage: 'press' });

      // Arm long-press for touch / pen only, and only for a lone pointer —
      // a second finger means a multi-touch gesture, not a long-press.
      if ((e.pointerType === 'touch' || e.pointerType === 'pen')
          && held.size === 1) {
        cancelLongPress(e.pointerId);
        const duration = longPressRef.current?.duration ?? LONG_PRESS_MS;
        longPressTimers.set(
          e.pointerId,
          setTimeout(() => {
            longPressTimers.delete(e.pointerId);
            if (disposed) return;
            fireLongPress(e.pointerId, e.pointerType);
          }, duration),
        );
        const store = longPressRef.current?.state;
        const rec = held.get(e.pointerId);
        if (rec) rec.holdType = e.pointerType;
        if (store && rec) {
          store.set({
            pointerId: e.pointerId,
            pointerType: e.pointerType as 'touch' | 'pen',
            client: { x: e.clientX, y: e.clientY },
            local: toCanvasLocal({ x: e.clientX, y: e.clientY }),
            world: { x: w.x, y: w.y },
            viewId: target().id,
            startedAt: performance.now(),
            duration,
            armed: longPressWouldFire(rec.down),
          });
        }
      }

      if (held.size >= 2) {
        cancelAllLongPress();
        // MULTI-POINTER POLICY: the multitouch channel takes ownership of
        // every pointer that hasn't already committed to a gesture. Clearing
        // the buffered press is what enforces it — a claimed pointer opens no
        // drag handle on the next move, and synthesizes no click on release
        // (both of those read the buffer).
        //
        // A pointer that already opened a drag has no buffer left to claim,
        // so its gesture survives the second finger landing. Yanking a drag
        // out from under someone who rested a palm is worse than letting it finish.
        for (const p of held.values()) p.buffered = null;

        const { centroid, spread } = heldGeometry();
        // Later fingers only bump the recorded peak count.
        if (!multiTouchStart) {
          multiTouchStart = {
            fingers: held.size, centroid: { ...centroid }, at: new Map(), moved: false,
            startedAt: performance.now(),
          };
        } else {
          multiTouchStart.fingers = held.size;
        }
        for (const [id, p] of held) {
          if (!multiTouchStart.at.has(id)) multiTouchStart.at.set(id, { ...p.pos });
        }
        const mt: InputEvent = {
          kind: 'multitouch',
          fingers: held.size,
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

    const endMultiTouch = (
      end: 'commit' | 'cancel',
      fingers: number,
      mods: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
    ): void => {
      dispatch({
        kind: 'multitouch',
        fingers,
        end,
        altKey: mods.altKey,
        ctrlKey: mods.ctrlKey,
        metaKey: mods.metaKey,
        shiftKey: mods.shiftKey,
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      routeAt(e.pointerId, e.clientX, e.clientY);
      const rec = held.get(e.pointerId);
      if (rec) rec.pos = { x: e.clientX, y: e.clientY };
      const joinedAt = multiTouchStart?.at.get(e.pointerId);
      if (multiTouchStart && joinedAt
          && Math.hypot(e.clientX - joinedAt.x, e.clientY - joinedAt.y) > TAP_THRESHOLD_PX) {
        multiTouchStart.moved = true;
      }

      // Once movement crosses the drag threshold, the buffered pointerdown
      // goes to the dispatcher BEFORE the pointermove: that is what opens the
      // drag handle the following moves pump.
      const buffered = rec?.buffered;
      if (rec && buffered) {
        if (pastDragThreshold(buffered, e)) {
          rec.buffered = null;
          cancelLongPress(e.pointerId);
          dispatch(buffered.ev);
        }
      }

      // Pump an in-flight multitouch handle with the updated centroid and spread.
      const mtGestureId = `multitouch-${held.size}`;
      if (held.size >= 2 && dispatcherNow().inFlight().has(mtGestureId)) {
        const { centroid, spread } = heldGeometry();
        const mtEv: InputEvent = {
          kind: 'multitouch',
          fingers: held.size,
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
      // A held pointer's moves are its drag's; an unpressed one's are a hover.
      if (held.size === 0) {
        const where = underPointer(target(), lastHover, w);
        hoverFacts = { at: lastHover, where };
        dispatch({ kind: 'hover', x: w.x, y: w.y, clientX: e.clientX, clientY: e.clientY, ...where });
      }
      refreshHoverCursor();
    };

    // Hover cursor. On every idle pointermove, resolve what sits under the
    // pointer and write a cursor override to `canvas.style.cursor`:
    //
    //   1. an affordance hit declaring `AffordanceHit.cursor`;
    //   2. the action a drag from here would route to, when it declares
    //      `Action.cursor`;
    //   3. otherwise the action a click here would route to, when it does;
    //   4. no override — clear the inline style so the active tool's
    //      React-managed `Tool.cursor` shows through.
    //
    // The override is an inline style on purpose: clearing it restores the
    // React-managed base without effect churn.
    let lastHover: {
      clientX: number; clientY: number;
      altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
    } | null = null;
    let cursorOverridden = false;
    const clearHoverCursor = () => {
      paintedCursorRef.current?.()?.setOverride(null);
      if (cursorOverridden && canvas) {
        canvas.style.cursor = '';
        cursorOverridden = false;
      }
    };
    const applyHoverCursor = (spec: CursorSpec | null) => {
      const tier = spec === null ? null : resolveCursorTier(spec);
      if (!tier || !canvas) {
        clearHoverCursor();
        return;
      }
      // A painted cursor is two writes, not one: the native cursor gets out of
      // the way and the layer is told what to draw. Doing only the first is a
      // pointer with no cursor at all.
      const cursor = tier.kind === 'css' ? tier.css : 'none';
      if (!cursor) {
        clearHoverCursor();
        return;
      }
      // A CSS cursor has to silence the layer too, or a painted tool cursor
      // keeps drawing under the native one.
      paintedCursorRef.current?.()?.setOverride(tier.kind === 'painted' ? tier : 'none');
      canvas.style.cursor = cursor;
      cursorOverridden = true;
    };
    /**
     * Where the painted-cursor layer should draw, in canvas-local CSS px.
     *
     * Pushed after the cursor has been resolved, not before: on the move that
     * first selects a painted cursor, a position written ahead of the decision
     * is discarded and the glyph does not appear until the next move. Guarded
     * on `active()`, so an ordinary CSS cursor costs no layout read per move.
     */
    function pushPaintedPointer(): void {
      const painted = paintedCursorRef.current?.();
      if (!painted?.active() || !canvas || !lastHover) return;
      const r = canvas.getBoundingClientRect();
      painted.setPointer(lastHover.clientX - r.left, lastHover.clientY - r.top);
    }

    function refreshHoverCursor(): void {
      resolveHoverCursor();
      pushPaintedPointer();
    }

    /** What the last move found under the pointer, so its hover and its cursor hit-test once. */
    let hoverFacts: { at: object; where: UnderPointer } | null = null;

    function resolveHoverCursor(): void {
      if (!canvas || !lastHover) return;
      // Mid-gesture an in-flight action's `activeCursor` wins; with none
      // declared the override clears and `Tool.cursor` shows through.
      if (held.size > 0 || dispatcherNow().inFlight().size > 0) {
        applyHoverCursor(dispatcherNow().inFlightCursor());
        return;
      }
      const h = lastHover;
      // Idle: re-resolve. Mid-gesture the branch above already returned, so a
      // pinned pointer is never unpinned by a hover refresh.
      routeAt(null, h.clientX, h.clientY);
      const w = toWorld(h.clientX, h.clientY);
      const where = hoverFacts?.at === h ? hoverFacts.where : underPointer(target(), h, w);
      if (where.affordance?.cursor) {
        applyHoverCursor(where.affordance.cursor);
        return;
      }
      const ctx = ctxNow();
      const press: InputEvent = {
        kind: 'pointerdown', x: w.x, y: w.y, clientX: h.clientX, clientY: h.clientY, ...where,
      };
      const d = dispatcherNow();
      publishLiveDispatch(() => d.explain(press, ctx));
      const dragCursor = d.resolveOnly(press, ctx)?.action.cursor;
      // A drag's hint first; failing that, what a click here would do.
      const cursor = dragCursor ?? dispatcherNow().resolveOnly(
        { kind: 'click', x: w.x, y: w.y, pressX: w.x, pressY: w.y, ...where },
        ctx,
      )?.action.cursor;
      applyHoverCursor(cursor ?? null);
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
    // A held pointer's moves arrive through its session, which keeps seeing
    // them once the pointer has left the canvas or the canvas is gone. The
    // canvas listener is left with the hover half.
    const onHoverMove = (e: PointerEvent) => {
      if (held.has(e.pointerId)) return;
      onPointerMove(e);
    };

    const onHoverPointerLeave = () => {
      lastHover = null;
      publishLiveDispatch(null);
      paintedCursorRef.current?.()?.clearPointer();
      clearHoverCursor();
    };

    const onPointerUp = (e: PointerEvent) => {
      routeAt(e.pointerId, e.clientX, e.clientY);
      cancelLongPress(e.pointerId);
      const prevSize = held.size;
      // The record outlives the map entry: everything below is synthesized
      // from the press, and reads it after this pointer has stopped counting
      // towards `held.size`.
      const rec = held.get(e.pointerId);
      held.delete(e.pointerId);

      // A press still buffered never crossed the drag threshold. Crossing it
      // clears the buffer whether or not a drag binding matched, which makes
      // this the authoritative "did the pointer move?" signal for click synthesis.
      const staysUnderThreshold = rec?.buffered != null;

      // Any finger lifting ends the multitouch gesture the hand was making,
      // and only that: a drag another pointer opened before the second finger
      // landed stays in flight (see the multi-pointer policy in onPointerDown).
      if (prevSize >= 2) endMultiTouch('commit', prevSize, e);

      // When the pointer count drops below 2 and nothing moved past the tap
      // threshold, synthesize a `multitouchtap` carrying the peak finger count.
      if (prevSize >= 2 && held.size < 2) {
        const start = multiTouchStart;
        if (start) {
          // Final centroid uses the pointer positions BEFORE this pointer was
          // removed — it is already out of `held`, so add it back in.
          const centroid = toCanvasLocal(
            computeMultiTouchGeometry([
              ...[...held.values()].map((p) => p.pos),
              { x: e.clientX, y: e.clientY },
            ]).centroid,
          );
          const dx = centroid.x - start.centroid.x;
          const dy = centroid.y - start.centroid.y;
          // A hold as long as a long-press is not a tap, for two fingers as for one.
          const brief = performance.now() - start.startedAt
            < (longPressRef.current?.duration ?? LONG_PRESS_MS);
          if (brief && !start.moved && Math.hypot(dx, dy) <= TAP_THRESHOLD_PX) {
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

      // Read BEFORE sending pointerup: this pointer's handle in flight and
      // the pointer moved means the end of a real drag, so no click.
      const movedDuringDrag = rec
        ? (rec.down.clientX !== e.clientX || rec.down.clientY !== e.clientY)
        : true;
      const hadDragInFlight =
        dispatcherNow().inFlight().has(pointerGestureId(e.pointerId)) && movedDuringDrag;

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

      const down = rec?.down;

      // Synthesize a click when the pointer neither opened a drag handle nor
      // travelled past the drag threshold. Carry the `bodyTarget` from the
      // pointerdown so click specs with string-form targets ('empty',
      // 'selected-body') match.
      //
      // The threshold half of the test is load-bearing for any tool that
      // binds `click` but not `drag`: without it, dragging clear across the
      // canvas and releasing synthesizes a click.
      if (!hadDragInFlight && staysUnderThreshold && down) {
        const wClick = toWorld(e.clientX, e.clientY);
        const clickEv: InputEvent = {
          kind: 'click',
          target: e.target,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          x: wClick.x,
          y: wClick.y,
          clientX: e.clientX,
          clientY: e.clientY,
          pressX: down.worldX,
          pressY: down.worldY,
          ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
          ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
          ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
        };
        dispatch(clickEv);
        onClickRef.current?.({ x: wClick.x, y: wClick.y });

        // A `doubleclick` follows the second click. The tracker resets after
        // one so a third click doesn't compose another.
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
            x: wClick.x,
            y: wClick.y,
            clientX: e.clientX,
            clientY: e.clientY,
            ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
            ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
            ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
          };
          // Notify observers first — see `onDoubleClick`'s doc for why this
          // is not modeled as a binding.
          onDoubleClickRef.current?.({ x: wClick.x, y: wClick.y });
          const handled = dispatch(dblEv) === 'handled';
          claimedDoubleClick = handled || onDoubleClickRef.current !== undefined;
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { t: now, clientX: e.clientX, clientY: e.clientY };
        }
      }

      // Every synthesized event this release produces has been dispatched, so
      // the pointer's view can be unpinned.
      routeRelease(e.pointerId);

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

    // Every way a gesture ends without a release. Reads the press's own
    // modifiers because a cancel carries none of its own.
    const onPointerCancel = (pointerId: number) => {
      // On teardown every session is canceled at once; `cancelAll` ends those
      // gestures, so re-entering dispatch here would end them twice.
      if (disposed) return;
      const rec = held.get(pointerId);
      if (!rec) return;
      const prevSize = held.size;
      held.delete(pointerId);
      routeAt(pointerId, rec.pos.x, rec.pos.y);
      cancelLongPress(pointerId);
      if (prevSize >= 2) endMultiTouch('cancel', prevSize, rec.down);
      // A cancel must not synthesize a tap on the subsequent up.
      multiTouchStart = null;
      const ev: InputEvent = {
        kind: 'pointercancel',
        pointerId,
        altKey: rec.down.altKey,
        ctrlKey: rec.down.ctrlKey,
        metaKey: rec.down.metaKey,
        shiftKey: rec.down.shiftKey,
      };
      dispatch(ev);
      routeRelease(pointerId);
    };

    const onPressActivate = (): void => { registryRef.current.activate(); };
    const keyCapture = keyboard === 'first';
    if (keyboard) {
      window.addEventListener('keydown', onKeyDown, keyCapture);
      window.addEventListener('keyup', onKeyUp, keyCapture);
    }
    window.addEventListener('blur', onWindowBlur);
    // Ahead of the pointer channel's own listener, and whether or not that
    // channel is on: a press with any button makes this the scope chrome and
    // keys reach.
    canvas?.addEventListener('pointerdown', onPressActivate);
    // Hover-cursor refresh on modifier/hotkey changes — separate listeners
    // (not folded into onKeyDown/onKeyUp) so the pump also tracks modifiers
    // when `keyboard: false` disables gesture key dispatch.
    window.addEventListener('keydown', scheduleHoverCursorRefresh);
    window.addEventListener('keyup', scheduleHoverCursorRefresh);
    if (pointerChannel) {
      canvas?.addEventListener('pointerleave', onHoverPointerLeave);
      canvas?.addEventListener('pointerdown', onPointerDown);
      canvas?.addEventListener('pointermove', onHoverMove);
      canvas?.addEventListener('dblclick', onNativeDoubleClick);
    }
    if (wheelChannel) canvas?.addEventListener('wheel', onWheel, { passive: false, capture: true });
    if (pinchChannel) {
      canvas?.addEventListener('gesturestart', onGestureStart);
      canvas?.addEventListener('gesturechange', onGestureChange);
      canvas?.addEventListener('gestureend', onGestureEnd);
    }
    if (contextMenuChannel) canvas?.addEventListener('contextmenu', onContextMenu);
    if (ingestChannel) {
      canvas?.addEventListener('dragenter', onDragOver);
      canvas?.addEventListener('dragover', onDragOver);
      canvas?.addEventListener('dragleave', onDragLeave);
      canvas?.addEventListener('drop', onDrop);
      window.addEventListener('paste', onPaste);
    }

    return () => {
      if (keyboard) {
        window.removeEventListener('keydown', onKeyDown, keyCapture);
        window.removeEventListener('keyup', onKeyUp, keyCapture);
      }
      window.removeEventListener('blur', onWindowBlur);
      canvas?.removeEventListener('pointerdown', onPressActivate);
      window.removeEventListener('keydown', scheduleHoverCursorRefresh);
      window.removeEventListener('keyup', scheduleHoverCursorRefresh);
      canvas?.removeEventListener('pointerleave', onHoverPointerLeave);
      canvas?.removeEventListener('wheel', onWheel, { capture: true });
      canvas?.removeEventListener('gesturestart', onGestureStart);
      canvas?.removeEventListener('gesturechange', onGestureChange);
      canvas?.removeEventListener('gestureend', onGestureEnd);
      canvas?.removeEventListener('pointerdown', onPointerDown);
      canvas?.removeEventListener('pointermove', onHoverMove);
      canvas?.removeEventListener('dblclick', onNativeDoubleClick);
      canvas?.removeEventListener('contextmenu', onContextMenu);
      canvas?.removeEventListener('dragenter', onDragOver);
      canvas?.removeEventListener('dragover', onDragOver);
      canvas?.removeEventListener('dragleave', onDragLeave);
      canvas?.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
      // Detach is unconditional: a channel turned off mid-life must still
      // have whatever it attached while it was on taken back off.
      canvas?.classList.remove(DROPOVER_CLASS);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a mirror of the registry prop, not a node: the one in use at teardown is the one holding the keys
      registryRef.current.dropKeys();
      clearHoverCursor();
      cancelAllLongPress();
      disposed = true;
      // `disposed` first: the sessions' cancels must not re-enter dispatch on
      // the way out, and `cancelAll` below is what ends the gestures.
      for (const p of held.values()) p.session.cancel();
      held.clear();
      for (const d of allDispatchers()) d.cancelAll('cancel');
    };
  }, [enabled, keyboard, canvasRef, pointerChannel, wheelChannel, pinchChannel, contextMenuChannel, ingestChannel,
    allDispatchers, ctxRef, longPressRef, onClickRef, onDoubleClickRef, paintedCursorRef, registryRef, requestRedrawRef, rootTargetRef, viewsRef]);
}

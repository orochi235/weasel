/**
 * Mounts the gesture dispatcher: composes the input channels (keys, wheel,
 * WebKit gesture events, pointer events, and multi-touch synthesized from
 * them) and routes each event to the dispatcher for the view it landed in.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isApplePlatform, type ClickMemory } from '@weasel-js/gestures';
import { useLatest } from '@weasel-js/react';
import { useActiveToolContext } from '../actions/activeToolContext';
import { useDepRegistry } from '../actions/depRegistry';
import { useToolLifecycle } from '../../tools/useToolLifecycle';
import { createDispatcher, type Dispatcher, type DispatcherContext } from './dispatcher';
import { createDispatchCore } from './dispatchCore';
import { dispatcherWatch } from './dispatcherWatch';
import type { DispatcherViewTarget, UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import { contextMenuInput } from './channels/contextMenu';
import { hoverCursorInput } from './channels/hoverCursor';
import { DROPOVER_CLASS, ingestInput } from './channels/ingest';
import { keyboardInput } from './channels/keyboard';
import { listenerSet } from './channels/listeners';
import { pointerInput, type PointerInput } from './channels/pointer';
import { webkitPinchInput } from './channels/webkitPinch';
import { wheelInput } from './channels/wheel';

export type {
  DispatcherChannels, DispatcherViewTarget, UseGestureDispatcherOptions, ViewIdResolver,
} from './gestureDispatcherOptions';

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
  const [isMac] = useState(isApplePlatform);

  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = dispatcherOpt ?? createDispatcher();
  }

  // No `getRuleCtx` here: eligibility is a per-view answer, so it rides on the
  // dispatch record and the core installs the routed view's.
  const registryRef = useLatest(actions);
  const ctxRef = useLatest<DispatcherContext>({
    actions,
    depRegistry,
    activeToolId: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    entriesById,
    isMac,
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

  // Held here rather than in the effect: a re-bind of the listeners between
  // two clicks would otherwise drop the double click.
  const clicksRef = useRef<ClickMemory>({ last: null });

  useToolLifecycle({
    entriesById,
    active: activeTool.active,
    hotkeyStack: activeTool.hotkeyStack,
    // The incoming tool must not inherit a live gesture.
    onSwitch: () => { for (const d of allDispatchers()) d.cancelAll('cancel'); },
  });

  useEffect(() => {
    if (enabled && claimKeys) registryRef.current.activate();
  }, [enabled, claimKeys, registryRef]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    const canvas = canvasRef.current;
    // Dispatcher-only overlays (marquee, lasso) repaint on nothing else, and
    // the event that closes a gesture still has to clear its overlay.
    const redraw = dispatcherWatch(() => { requestRedrawRef.current?.(); });
    for (const d of allDispatchers()) redraw.watch(d);
    const core = createDispatchCore({
      canvas,
      root: () => rootTargetRef.current,
      views: () => viewsRef.current,
      context: () => ctxRef.current,
      actions: () => registryRef.current,
      uses: redraw.watch,
      disposed: () => disposed,
    });
    const keys = keyboardInput(core);
    const pinch = webkitPinchInput(core);
    const ingest = ingestInput(core);
    const hover = hoverCursorInput(core, () => paintedCursorRef.current?.(), () => pointer.heldCount());
    const pointer: PointerInput = pointerInput(core, {
      longPress: () => longPressRef.current,
      onClick: () => onClickRef.current,
      onDoubleClick: () => onDoubleClickRef.current,
      clicks: clicksRef.current,
      hover,
    });

    // A window that loses focus never delivers the keyup, so without this every
    // in-flight key-held handle stays engaged until that key is pressed again.
    // Nor can a drag trust the release it may or may not see later.
    const onWindowBlur = (): void => {
      pinch.end();
      pointer.cancelHeld();
      keys.releaseAll();
    };

    const listeners = listenerSet();
    const keyCapture = keyboard === 'first';
    if (keyboard) {
      listeners.on(window, 'keydown', keys.onKeyDown, keyCapture);
      listeners.on(window, 'keyup', keys.onKeyUp, keyCapture);
    }
    listeners.on(window, 'blur', onWindowBlur);
    // Ahead of the pointer channel's own listener, and whether or not that
    // channel is on: a press with any button makes this the scope chrome and
    // keys reach.
    listeners.on(canvas, 'pointerdown', () => { registryRef.current.activate(); });
    if (pointerChannel) {
      // Separate from the key channel's listeners, so the cursor also tracks
      // modifiers when `keyboard: false` turns gesture key dispatch off.
      listeners.on(window, 'keydown', hover.onKey);
      listeners.on(window, 'keyup', hover.onKey);
      listeners.on(canvas, 'pointerleave', hover.onLeave);
      listeners.on(canvas, 'pointerdown', pointer.onPointerDown);
      listeners.on(canvas, 'pointermove', pointer.onHoverMove);
      listeners.on(canvas, 'dblclick', pointer.onNativeDoubleClick);
    }
    if (wheelChannel) {
      listeners.on(canvas, 'wheel', wheelInput(core, pinch.live), { passive: false, capture: true });
    }
    if (pinchChannel) {
      listeners.on(canvas, 'gesturestart', pinch.onGestureStart);
      listeners.on(canvas, 'gesturechange', pinch.onGestureChange);
      listeners.on(canvas, 'gestureend', pinch.onGestureEnd);
    }
    if (contextMenuChannel) {
      listeners.on(canvas, 'contextmenu', contextMenuInput(core, pointer.takeNativeHold));
    }
    if (ingestChannel) {
      listeners.on(canvas, 'dragenter', ingest.onDragOver);
      listeners.on(canvas, 'dragover', ingest.onDragOver);
      listeners.on(canvas, 'dragleave', ingest.onDragLeave);
      listeners.on(canvas, 'drop', ingest.onDrop);
      listeners.on(window, 'paste', ingest.onPaste);
    }

    return () => {
      listeners.removeAll();
      canvas?.classList.remove(DROPOVER_CLASS);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a mirror of the registry prop, not a node: the one in use at teardown is the one holding the keys
      registryRef.current.dropKeys();
      hover.clear();
      // `disposed` first: the sessions' cancels must not re-enter dispatch on
      // the way out, and `cancelAll` below is what ends the gestures.
      disposed = true;
      pointer.dispose();
      redraw.stop();
      for (const d of allDispatchers()) d.cancelAll('cancel');
    };
  }, [enabled, keyboard, canvasRef, pointerChannel, wheelChannel, pinchChannel, contextMenuChannel, ingestChannel,
    allDispatchers, ctxRef, longPressRef, onClickRef, onDoubleClickRef, paintedCursorRef, registryRef, requestRedrawRef, rootTargetRef, viewsRef]);
}

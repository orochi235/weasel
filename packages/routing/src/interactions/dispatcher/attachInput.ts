/**
 * One listener set for `useGestureDispatcher`: builds the input channels over a
 * shared dispatch core, binds the DOM listeners the enabled channels need, and
 * returns the teardown.
 */
import { heldPointers } from '@weasel-js/gestures';
import type { CursorSink, PaintedCursorState } from '@weasel-js/cursor';
import { createDispatchCore, type DispatchCore, type DispatchCoreSources } from './dispatchCore';
import type { Dispatcher } from './dispatcherApi';
import { dispatcherWatch } from './dispatcherWatch';
import { carryInput } from './channels/carry';
import { contextMenuInput } from './channels/contextMenu';
import { hoverCursorInput } from './channels/hoverCursor';
import { DROPOVER_CLASS, ingestInput } from './channels/ingest';
import { keyboardInput } from './channels/keyboard';
import { listenerSet, type ListenerSet } from './channels/listeners';
import { pointerInput, type PointerInput, type PointerInputOptions } from './channels/pointer';
import { webkitPinchInput } from './channels/webkitPinch';
import { wheelInput } from './channels/wheel';

/** What a listener set reads. Each thunk answers for the hook's latest render. */
export interface InputSources
  extends Pick<DispatchCoreSources, 'root' | 'views' | 'clientToLocal' | 'context' | 'actions' | 'yieldKeys'>,
    Pick<PointerInputOptions, 'longPress' | 'kitSettings' | 'onClick' | 'onDoubleClick' | 'clicks'> {
  /** Every live dispatcher — what a cancel-everything has to reach. */
  dispatchers(): Dispatcher[];
  requestRedraw(): void;
  paintedCursor(): PaintedCursorState | undefined;
  cursorSink(): CursorSink | undefined;
}

/** Which channels bind listeners. Fixed for the life of a listener set. */
export interface InputChannels {
  keyboard: boolean | 'first';
  pointer: boolean;
  /** Hovers alone. Read only with `pointer` off, which carries them itself. */
  hover: boolean;
  wheel: boolean;
  pinch: boolean;
  contextMenu: boolean;
  ingest: boolean;
  carry: boolean;
}

export function attachInput(
  canvas: HTMLElement | null,
  src: InputSources,
  channels: InputChannels,
): () => void {
  let disposed = false;
  // Dispatcher-only overlays (marquee, lasso) repaint on nothing else, and
  // the event that closes a gesture still has to clear its overlay.
  const redraw = dispatcherWatch(src.requestRedraw);
  redraw.sync(src.dispatchers());
  const core = createDispatchCore({
    canvas,
    root: src.root,
    views: src.views,
    clientToLocal: src.clientToLocal,
    context: src.context,
    actions: src.actions,
    yieldKeys: src.yieldKeys,
    uses: () => { redraw.sync(src.dispatchers()); },
    disposed: () => disposed,
  });
  const keys = keyboardInput(core);
  const pinch = webkitPinchInput(core);
  const ingest = ingestInput(core);
  const held = canvas ? heldPointers(canvas) : null;
  const hover = hoverCursorInput(core, src.paintedCursor, () => held?.count() ?? 0, src.cursorSink);
  const pointer: PointerInput = pointerInput(core, {
    longPress: src.longPress,
    kitSettings: src.kitSettings,
    onClick: src.onClick,
    onDoubleClick: src.onDoubleClick,
    clicks: src.clicks,
    hover,
  });

  // A window that loses focus never delivers the keyup, so without this every
  // in-flight key-held handle stays engaged until that key is pressed again.
  // Nor can a drag trust the release it may or may not see later.
  const onWindowBlur = (): void => {
    pinch.end();
    pointer.cancelHeld();
    keys.releaseAll();
    src.context().keymaps?.closeAll();
  };

  const listeners = listenerSet();
  const keyCapture = channels.keyboard === 'first';
  if (channels.keyboard) {
    listeners.on(window, 'keydown', keys.onKeyDown, keyCapture);
    listeners.on(window, 'keyup', keys.onKeyUp, keyCapture);
  }
  listeners.on(window, 'blur', onWindowBlur);
  // Ahead of the pointer channel's own listener, and whether or not that
  // channel is on: a press with any button makes this the scope chrome and
  // keys reach.
  listeners.on(canvas, 'pointerdown', () => { src.actions().activate(); });
  // Whether or not the pointer channel is on: it is what an `over` key binding asks.
  trackPointerOver(listeners, canvas, core, keys);
  if (channels.pointer) {
    // Separate from the key channel's listeners, so the cursor also tracks
    // modifiers when `keyboard: false` turns gesture key dispatch off.
    listeners.on(window, 'keydown', hover.onKey);
    listeners.on(window, 'keyup', hover.onKey);
    listeners.on(canvas, 'pointerleave', hover.onLeave);
    listeners.on(canvas, 'pointerdown', pointer.onPointerDown);
    listeners.on(canvas, 'pointermove', pointer.onHoverMove);
    listeners.on(canvas, 'dblclick', pointer.onNativeDoubleClick);
  } else if (channels.hover) {
    listeners.on(window, 'keydown', hover.onKey);
    listeners.on(window, 'keyup', hover.onKey);
    listeners.on(canvas, 'pointerleave', hover.onLeave);
    listeners.on(canvas, 'pointermove', (e: PointerEvent) => {
      core.routeAt(null, e.clientX, e.clientY);
      hover.moved(e);
    });
  }
  if (channels.wheel) {
    listeners.on(canvas, 'wheel', wheelInput(core, pinch.live), { passive: false, capture: true });
  }
  if (channels.pinch) {
    listeners.on(canvas, 'gesturestart', pinch.onGestureStart);
    listeners.on(canvas, 'gesturechange', pinch.onGestureChange);
    listeners.on(canvas, 'gestureend', pinch.onGestureEnd);
  }
  if (channels.contextMenu) {
    listeners.on(canvas, 'contextmenu', contextMenuInput(core, pointer.takeNativeHold));
  }
  if (channels.ingest) {
    listeners.on(canvas, 'dragenter', ingest.onDragOver);
    listeners.on(canvas, 'dragover', ingest.onDragOver);
    listeners.on(canvas, 'dragleave', ingest.onDragLeave);
    listeners.on(canvas, 'drop', ingest.onDrop);
    listeners.on(window, 'paste', ingest.onPaste);
  }
  const offCarry = channels.carry ? carryInput(core) : null;

  return () => {
    listeners.removeAll();
    offCarry?.();
    canvas?.classList.remove(DROPOVER_CLASS);
    ingest.endPreview();
    // The registry in use at teardown is the one holding the keys.
    src.actions().dropKeys();
    hover.clear();
    // `disposed` first: the sessions' cancels must not re-enter dispatch on
    // the way out, and `cancelAll` below is what ends the gestures.
    disposed = true;
    pointer.dispose();
    held?.release();
    redraw.stop();
    for (const d of src.dispatchers()) d.cancelAll('cancel');
    src.context().keymaps?.closeAll();
  };
}

/** Keep `core`'s pointer-over flag, pressing held keys as the pointer arrives and releasing them as it leaves. */
function trackPointerOver(
  listeners: ListenerSet,
  canvas: HTMLElement | null,
  core: Pick<DispatchCore, 'pointerOver' | 'setPointerOver'>,
  keys: { arrive: (e: PointerEvent) => void; leave: () => void },
): void {
  const onOver = (e: PointerEvent): void => {
    if (core.pointerOver()) return;
    core.setPointerOver(true);
    keys.arrive(e);
  };
  listeners.on(canvas, 'pointerenter', onOver);
  listeners.on(canvas, 'pointermove', onOver);
  listeners.on(canvas, 'pointerleave', () => {
    core.setPointerOver(false);
    keys.leave();
  });
}

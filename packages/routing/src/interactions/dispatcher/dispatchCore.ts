/**
 * The routing core every input channel of `useGestureDispatcher` shares: which
 * view an event belongs to, that view's dispatcher and context, and the one
 * `dispatch` every channel sends through.
 */
import type { DepName, DepSchema } from '../../index';
import { clientToCanvas } from '../../viewport/clientToCanvas';
import type { DepRegistry } from '../actions/depRegistry';
import type { ActionsRegistry } from '../actions/registry';
import type { Dispatcher, DispatcherContext, KeyReach } from './dispatcherApi';
import type { DispatcherViewTarget, UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import type { InputEvent } from './matcher';
import type { KeymapStack } from '../../keymaps/keymapStack';

/** What a channel reads and calls. Every member is a closure over the
 *  hook's effect, so a channel may destructure it. */
export interface DispatchCore {
  readonly canvas: HTMLElement | null;
  /** The dispatch record for the routed view. */
  target(): DispatcherViewTarget;
  /** Route an event with coordinates. `pointerId` is `null` for input with
   *  nothing to capture: wheel, hover, contextmenu, drop. */
  routeAt(pointerId: number | null, clientX: number, clientY: number): void;
  /** The routed view's id, and a way to put one back: an event that
   *  dispatches later runs on the view it landed in. */
  routedView(): string | null;
  setRoutedView(id: string | null): void;
  dispatcherNow(): Dispatcher;
  ctxNow(): DispatcherContext;
  /** Client point to the routed view's world point. */
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  /** Client point to CSS pixels from the canvas's top-left, the space `zoomAt`
   *  anchors in and a `space: 'screen'` layer draws in. Unchanged with no canvas. */
  toCanvasLocal(clientX: number, clientY: number): { x: number; y: number };
  /** Dispatch on the routed view's dispatcher, or on `on` for an event that
   *  belongs to the one an earlier event ran on. */
  dispatch(ev: InputEvent, on?: Dispatcher, reach?: KeyReach): 'handled' | 'unhandled';
  /** Run `fn`'s dispatches as one raw input — the `key` and `key-held` forms
   *  of one keystroke — so a keymap rules on them together. */
  batch<T>(fn: () => T): T;
  /** The keymaps open on this surface, if it has any. */
  keymaps(): KeymapStack | undefined;
  /** Whether a key or a paste that reached the page is this dispatcher's to
   *  handle: its canvas was the last one pressed or scrolled in, or it has no
   *  canvas and its input scope is the active one. */
  holdsKeys(): boolean;
  /** Whether the pointer is over the canvas, as its enter, move and leave
   *  report it. Always false with no canvas. */
  pointerOver(): boolean;
  setPointerOver(over: boolean): void;
  /** Make this canvas's input scope the active one. */
  activate(): void;
  /** Whether the hook's effect has been torn down. */
  disposed(): boolean;
}

/** The pointer channel's core: a pointer stays pinned to the view it went down in. */
export interface PointerDispatchCore extends DispatchCore {
  /** Route a pointerdown, pinning the pointer to the view it landed in. */
  routeDown(pointerId: number, clientX: number, clientY: number): void;
  /** Unpin a pointer whose release or cancel has been dispatched in full. */
  routeRelease(pointerId: number): void;
}

/** What a core reads. Each is a thunk over the hook's latest render, except
 *  `canvas`, which is fixed for the life of a listener set. */
export interface DispatchCoreSources {
  canvas: HTMLElement | null;
  /** The record the hook's flat options describe: view zero. */
  root(): DispatcherViewTarget;
  views(): UseGestureDispatcherOptions['views'];
  /** The host's client-to-canvas-local mapping, if it supplies one. */
  clientToLocal(): UseGestureDispatcherOptions['clientToLocal'];
  /** The dispatcher context, less the parts that depend on the routed view. */
  context(): DispatcherContext;
  actions(): ActionsRegistry;
  /** Told of the dispatcher each event is about to run on. A view's appears
   *  with no render of the hook, so this is where one is first seen. */
  uses(dispatcher: Dispatcher): void;
  disposed(): boolean;
}

export function createDispatchCore(src: DispatchCoreSources): PointerDispatchCore {
  const { canvas } = src;
  // An id rather than a record: the record is rebuilt every render, so holding
  // one across events would dispatch through last render's lookups.
  let routedId: string | null = null;
  let over = false;

  const target = (): DispatcherViewTarget => {
    if (routedId === null) return src.root();
    // A resolved id with no live record falls back to the root.
    return src.views()?.targets().find((t) => t.id === routedId) ?? src.root();
  };
  const dispatcherNow = (): Dispatcher => target().dispatcher;
  const routedDeps = withViewDeps(() => src.context().depRegistry, () => target().deps?.());
  const routedRuleCtx = (): ReturnType<NonNullable<DispatcherViewTarget['getRuleCtx']>> =>
    target().getRuleCtx?.();
  const batch = <T,>(fn: () => T): T => {
    const keymaps = src.context().keymaps;
    return keymaps ? keymaps.batch(fn) : fn();
  };
  const ctxNow = (): DispatcherContext => ({
    ...src.context(), depRegistry: routedDeps, getRuleCtx: routedRuleCtx, viewId: target().id,
  });

  return {
    canvas,
    target,
    routeAt: (pointerId, clientX, clientY) => {
      routedId = src.views()?.resolver.at(pointerId, clientX, clientY).id ?? null;
    },
    routeDown: (pointerId, clientX, clientY) => {
      routedId = src.views()?.resolver.begin(pointerId, clientX, clientY).id ?? null;
    },
    routeRelease: (pointerId) => { src.views()?.resolver.end(pointerId); },
    routedView: () => routedId,
    setRoutedView: (id) => { routedId = id; },
    dispatcherNow,
    ctxNow,
    toWorld: (cx, cy) => {
      const fn = target().clientToWorld;
      return fn ? fn(cx, cy) : { x: cx, y: cy };
    },
    toCanvasLocal: (cx, cy) => {
      const own = src.clientToLocal();
      if (own) return own(cx, cy);
      if (!canvas) return { x: cx, y: cy };
      const [x, y] = clientToCanvas(canvas, cx, cy);
      return { x, y };
    },
    dispatch: (ev, on, reach) => batch(() => {
      const d = on ?? dispatcherNow();
      src.uses(d);
      return d.handleInput(ev, reach ? { ...ctxNow(), keyReach: reach } : ctxNow());
    }),
    batch,
    keymaps: () => src.context().keymaps,
    holdsKeys: () => (canvas ? src.actions().holdsKeys() : src.actions().isActive()),
    pointerOver: () => over,
    setPointerOver: (next) => { over = canvas !== null && next; },
    activate: () => src.actions().activate(),
    disposed: src.disposed,
  };
}

/**
 * `base` with the routed view's own deps in front of it. Both sides are read
 * through thunks, so the result is stable for the life of a listener set while
 * still answering for whichever view the current event landed in.
 */
export function withViewDeps(
  base: () => DepRegistry,
  overlay: () => Partial<DepSchema> | undefined,
): DepRegistry {
  return {
    register: (name, source) => base().register(name, source),
    get: <K extends DepName>(name: K): DepSchema[K] | undefined => {
      const own = overlay()?.[name];
      if (own !== undefined) return own as DepSchema[K];
      return base().get(name);
    },
  };
}

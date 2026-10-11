/**
 * The routing core every input channel of `useGestureDispatcher` shares: which
 * view an event belongs to, that view's dispatcher and context, and the one
 * `dispatch` that requests a redraw around a gesture.
 */
import type { DepName, DepSchema } from '../../index';
import type { DepRegistry } from '../actions/depRegistry';
import type { Dispatcher, DispatcherContext } from './dispatcherApi';
import type { DispatcherViewTarget } from './gestureDispatcherOptions';
import type { InputEvent } from './matcher';

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
  /** Dispatch on the routed view's dispatcher, or on `on` for an event that
   *  belongs to the one an earlier event ran on. */
  dispatch(ev: InputEvent, on?: Dispatcher): 'handled' | 'unhandled';
  /** Whether this canvas's input scope is the active one. */
  isActive(): boolean;
  /** Make this canvas's input scope the active one. */
  activate(): void;
  /** Whether the hook's effect has been torn down. */
  disposed(): boolean;
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

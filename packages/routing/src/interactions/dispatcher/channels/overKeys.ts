/** Held keys following the pointer onto and off a surface, for its `over` bindings. */
import type { DispatchCore } from '../dispatchCore';
import type { Dispatcher, KeyReach } from '../dispatcherApi';
import type { InputEvent } from '../matcher';

/** A key down, as it went down, and the dispatcher that took it. */
export interface HeldKey {
  key: string;
  code?: string;
  /** Cmd was down with it, so its keyup may never come: Cmd's stands in for it. */
  withCmd: boolean;
  on: Dispatcher;
  /** The view `on` belongs to, which its release runs in wherever the pointer is now. */
  view: string | null;
}

/** Dispatch `ev`, a release of `down`, in the view that took the keydown. */
export function releaseIn(
  core: Pick<DispatchCore, 'dispatch' | 'routedView' | 'setRoutedView'>,
  down: HeldKey,
  ev: InputEvent,
  reach?: KeyReach,
): 'handled' | 'unhandled' {
  const routed = core.routedView();
  core.setRoutedView(down.view);
  try {
    return core.dispatch(ev, down.on, reach);
  } finally {
    core.setRoutedView(routed);
  }
}

// Only a held key is pressed again: a `key` binding is a single press, which an
// arriving pointer does not repeat.
const OVER_ONLY: KeyReach = { held: false, over: true };

/**
 * `arrive` presses each key in `down` that no dispatcher here holds for the
 * surface's `over` bindings, adding what they take to `held`; `leave` releases
 * what they hold and drops it from `held`.
 */
export function followPointer(
  core: Pick<DispatchCore, 'dispatch' | 'dispatcherNow' | 'routeAt' | 'routedView' | 'setRoutedView'>,
  down: ReadonlyMap<string, Omit<HeldKey, 'on' | 'view'>>,
  held: Map<string, HeldKey>,
): {
  /** The pointer came over the canvas: press the keys already held for its `over` bindings. */
  arrive: (e: PointerEvent) => void;
  /** The pointer left the canvas: release what its `over` bindings hold. */
  leave: () => void;
} {
  const arrive = (e: PointerEvent): void => {
    for (const [physical, { key, code, withCmd }] of down) {
      if (held.has(physical)) continue;
      core.routeAt(null, e.clientX, e.clientY);
      const on = core.dispatcherNow();
      const codeField = code !== undefined ? { code } : {};
      const ev: InputEvent = {
        kind: 'key-held', key, ...codeField, phase: 'down',
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      if (core.dispatch(ev, on, OVER_ONLY) === 'handled') held.set(physical, { key, ...codeField, withCmd, on, view: core.routedView() });
    }
  };

  const leave = (): void => {
    for (const [physical, down] of [...held]) {
      const { key, code } = down;
      const ev: InputEvent = {
        kind: 'key-held', key, ...(code !== undefined ? { code } : {}), phase: 'up',
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      };
      if (releaseIn(core, down, ev, OVER_ONLY) === 'handled') held.delete(physical);
    }
  };

  return { arrive, leave };
}

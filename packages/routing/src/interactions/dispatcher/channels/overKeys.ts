/** Held keys following the pointer onto and off a surface, for its `over` bindings. */
import type { DispatchCore } from '../dispatchCore';
import type { Dispatcher, KeyReach } from '../dispatcherApi';
import type { InputEvent } from '../matcher';

/** A key down, as it went down, and the dispatcher that took it. */
export interface HeldKey {
  key: string;
  code?: string;
  on: Dispatcher;
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
  core: Pick<DispatchCore, 'dispatch' | 'dispatcherNow' | 'routeAt'>,
  down: ReadonlyMap<string, Omit<HeldKey, 'on'>>,
  held: Map<string, HeldKey>,
): {
  /** The pointer came over the canvas: press the keys already held for its `over` bindings. */
  arrive: (e: PointerEvent) => void;
  /** The pointer left the canvas: release what its `over` bindings hold. */
  leave: () => void;
} {
  const arrive = (e: PointerEvent): void => {
    for (const [physical, { key, code }] of down) {
      if (held.has(physical)) continue;
      core.routeAt(null, e.clientX, e.clientY);
      const on = core.dispatcherNow();
      const codeField = code !== undefined ? { code } : {};
      const ev: InputEvent = {
        kind: 'key-held', key, ...codeField, phase: 'down',
        altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
      };
      if (core.dispatch(ev, on, OVER_ONLY) === 'handled') held.set(physical, { key, ...codeField, on });
    }
  };

  const leave = (): void => {
    for (const [physical, { key, code, on }] of [...held]) {
      const ev: InputEvent = {
        kind: 'key-held', key, ...(code !== undefined ? { code } : {}), phase: 'up',
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      };
      if (core.dispatch(ev, on, OVER_ONLY) === 'handled') held.delete(physical);
    }
  };

  return { arrive, leave };
}

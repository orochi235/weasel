/**
 * Shared dep-bag builder — the single implementation behind both the gesture
 * dispatcher's per-invocation `buildDeps` and `ActionsRegistry.trigger`'s
 * `requires` branch. Reads the action's declared `requires`, resolves each
 * name against the `DepRegistry`, and (dev builds only) wraps the bag in a
 * Proxy that warns on undeclared reads.
 */
import type { Action } from './registry';
import type { DepRegistry } from './depRegistry';
import type { ActionDeps } from './invoker';

/** True in dev builds; false in production. Tree-shakes the Proxy out of
 *  prod entirely. (Mirrors the dispatcher's own `DEV` const.) */
const DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();

/** Build the deps bag for an action from its declared `requires`. */
export function buildDepsFromRequires(action: Action, depRegistry: DepRegistry): ActionDeps {
  const requires = action.requires ?? [];
  const entries = requires.map((name) => [name, depRegistry.get(name)]);
  const deps = Object.fromEntries(entries) as ActionDeps;

  // Dev-only: wrap deps in a Proxy that warns when the invoker reads a
  // key not declared in `requires`. Catches silent-failure-by-typo or
  // forgotten-requires (the #1 bug class in this codebase pre-Phase-14e).
  // Production builds: bypass the Proxy entirely (zero overhead).
  if (DEV) {
    const declared = new Set<string>(requires);
    return new Proxy(deps as Record<string, unknown>, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && !declared.has(prop) && prop !== 'then') {
          // eslint-disable-next-line no-console
          console.warn(
            `[weasel:dispatcher] action "${action.id}" read deps.${prop} but did not declare it in \`requires\`. ` +
            `Add \`requires: [...'${prop}']\` to the descriptor or the dep will be undefined at runtime.`,
          );
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as ActionDeps;
  }
  return deps;
}

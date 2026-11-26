/**
 * Shared dep-bag builder — the single implementation behind both the gesture
 * dispatcher's per-invocation `buildDeps` and every `ActionsRegistry` path that
 * runs an action (`trigger`, `begin`, `preview`, menu rows). Reads the action's declared `requires`, resolves each
 * name against the `DepRegistry`, and (dev builds only) wraps the bag in a
 * Proxy that warns on undeclared reads.
 */
import type { Action } from './action';
import type { DepRegistry } from './depNode';
import type { ActionDeps } from './invoker';
import { isDev } from '@weasel-js/registry';

/** True in dev builds; false in production. Tree-shakes the Proxy out of
 *  prod entirely. (Mirrors the dispatcher's own `DEV` const.) */
const DEV = isDev();

/** Members that serializers, test matchers, React, and promise checks probe on any object; none of them is a dep. */
const PROBES = new Set(['then', 'toJSON', '$$typeof', 'asymmetricMatch', 'nodeType']);

const probed = (prop: string): boolean => PROBES.has(prop) || Object.hasOwn(Object.prototype, prop);

/** Build the deps bag for an action from its declared `requires`. */
export function createActionDeps(action: Action, depRegistry: DepRegistry): ActionDeps {
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
        if (typeof prop === 'string' && !declared.has(prop) && !probed(prop)) {
          const message =
            `[weasel:dispatcher] action "${action.id}" read deps.${prop} but did not declare it in \`requires\`. ` +
            `Add \`requires: [...'${prop}']\` to the descriptor or the dep will be undefined at runtime.`;
          // Warn first so the console trail survives even when the throw is
          // swallowed by a caller, then throw so the gesture fails visibly
          // instead of silently running without the dep.
          console.warn(message);
          throw new Error(message);
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as ActionDeps;
  }
  return deps;
}

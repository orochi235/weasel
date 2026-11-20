import { OUT_OF_SCOPE_ALPHA, type NodeScope } from '@weasel-js/modes';
import { createEmitter } from '@weasel-js/registry';
import { reachableInGroup, type EnteredGroupApi } from 'canvas/deps/enteredGroup';
import type { Scene } from 'core/scene/types';

/**
 * The entered group as a scope: everything outside its subtree dims and stops taking hits, and
 * so does the group itself, whose empty box is empty canvas while it is entered. With nothing
 * entered every node is lit and live. Compose `alphaFor` into `<SceneCanvas alphaFor>` and the
 * scope into `redrawOn` to show it.
 */
export function createEnteredGroupScope(opts: {
  entered: EnteredGroupApi;
  scene: Pick<Scene<unknown, string, unknown>, 'ancestorsOf' | 'get'>;
  /** Alpha for a node outside the entered group. Default `OUT_OF_SCOPE_ALPHA`. */
  dimAlpha?: number;
}): NodeScope {
  const { entered, scene } = opts;
  const dim = opts.dimAlpha ?? OUT_OF_SCOPE_ALPHA;
  const listeners = createEmitter();
  let version = 0;
  // The entered group the version last counted, so a change made while nobody
  // listened still bumps it when it is next read.
  let seen = entered.get();
  let stop: (() => void) | null = null;
  const versionNow = (): number => {
    const now = entered.get();
    if (now !== seen) { seen = now; version++; }
    return version;
  };

  return {
    alphaFor: (id) => {
      const group = entered.get();
      return id === group || reachableInGroup(scene, group, id) ? 1 : dim;
    },
    isPointerInteractive: (id) => reachableInGroup(scene, entered.get(), id),
    getVersion: versionNow,
    subscribe(fn) {
      if (stop === null) stop = entered.subscribe(() => { seen = entered.get(); version++; listeners.emit(); });
      const off = listeners.subscribe(fn);
      return () => {
        off();
        if (listeners.size === 0) { stop?.(); stop = null; }
      };
    },
  };
}

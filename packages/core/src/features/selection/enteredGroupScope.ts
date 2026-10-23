import { createEmitter } from '@weasel-js/registry';
import type { EnteredGroupDep } from 'canvas/deps/enteredGroup';
import type { NodeId, Scene } from 'core/scene/types';

/** How a canvas treats each node while a group is entered. */
export interface EnteredGroupScope {
  /** 1 inside the entered group, `dimAlpha` outside it, 1 everywhere with nothing entered. */
  alphaFor(id: string): number;
  /** Whether the node takes hits: only the entered group and what is inside it does. */
  isPointerInteractive(id: string): boolean;
  subscribe(fn: () => void): () => void;
  /** Bumps each time the entered group changes. */
  getVersion(): number;
}

/**
 * The entered group as a scope: everything outside its subtree dims and stops taking hits.
 * Compose `alphaFor` into `<SceneCanvas alphaFor>` and the scope into `redrawOn` to show it.
 */
export function createEnteredGroupScope(opts: {
  entered: EnteredGroupDep;
  scene: Pick<Scene<unknown, string, unknown>, 'ancestorsOf'>;
  /** Alpha for a node outside the entered group. Default 0.3. */
  dimAlpha?: number;
}): EnteredGroupScope {
  const { entered, scene } = opts;
  const dim = opts.dimAlpha ?? 0.3;
  const listeners = createEmitter();
  let version = 0;
  let stop: (() => void) | null = null;

  const inside = (id: string): boolean => {
    const group = entered.get();
    return group === null || id === group || scene.ancestorsOf(id as NodeId).includes(group);
  };

  return {
    alphaFor: (id) => (inside(id) ? 1 : dim),
    isPointerInteractive: inside,
    getVersion: () => version,
    subscribe(fn) {
      if (stop === null) stop = entered.subscribe(() => { version++; listeners.emit(); });
      const off = listeners.subscribe(fn);
      return () => {
        off();
        if (listeners.size === 0) { stop?.(); stop = null; }
      };
    },
  };
}

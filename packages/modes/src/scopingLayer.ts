import { createEmitter } from '@weasel-js/registry';
import type { ModeRegistry } from './registry';

/** Options for `createScopingDim`. */
export interface CreateScopingDimOptions {
  registry: ModeRegistry;
  /** Returns the set of node ids that are *in* scope for the current mode.
   *  The app computes this — typically: the edited path for path-edit,
   *  empty for non-scoping modes. */
  getTargetIds: () => ReadonlySet<string>;
  /** Alpha for out-of-scope nodes. Default {@link OUT_OF_SCOPE_ALPHA}. */
  dimAlpha?: number;
}

/** The alpha a node outside a scope is drawn at, unless the scope says otherwise. */
export const OUT_OF_SCOPE_ALPHA = 0.3;

/** How a canvas treats each node under a scope: lit or dimmed, reachable or not. Consult it
 *  from the renderer and the hit-tester; `subscribe` hears its answers change, so a canvas
 *  can repaint on it (`<SceneCanvas redrawOn>`). */
export interface NodeScope {
  /** Multiplier in [0, 1] to apply to a node's render alpha. */
  alphaFor(id: string): number;
  /** Whether the node should respond to pointer hits. */
  isPointerInteractive(id: string): boolean;
  /** Monotonic; bumps whenever the answers may have changed. */
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

/** A {@link NodeScope} for a mode registry: it computes nothing itself, and its answers change
 *  when the mode does, or when the app says the target set moved (`invalidate`). */
export interface ScopingDim extends NodeScope {
  /** Tell subscribers the target set changed without a mode switch. */
  invalidate(): void;
}

/** Build the scoping lookup for a mode registry. In a mode with
 *  `scoping: false` every node is full-alpha and interactive, so this is safe
 *  to consult unconditionally. */
export function createScopingDim(opts: CreateScopingDimOptions): ScopingDim {
  const { registry } = opts;
  const dim = opts.dimAlpha ?? OUT_OF_SCOPE_ALPHA;
  const listeners = createEmitter();
  let invalidations = 0;
  return {
    alphaFor(id) {
      const mode = registry.current();
      if (!mode.scoping) return 1;
      return opts.getTargetIds().has(id) ? 1 : dim;
    },
    isPointerInteractive(id) {
      const mode = registry.current();
      if (!mode.scoping) return true;
      return opts.getTargetIds().has(id);
    },
    invalidate() {
      invalidations++;
      listeners.emit();
    },
    getVersion: () => registry.getVersion() + invalidations,
    subscribe(listener) {
      const off = listeners.subscribe(listener);
      const offMode = registry.subscribe(listener);
      return () => {
        off();
        offMode();
      };
    },
  };
}

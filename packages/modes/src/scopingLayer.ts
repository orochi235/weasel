import type { ModeRegistry } from './registry';

/** Options for `createScopingDim`. */
export interface CreateScopingDimOptions {
  registry: ModeRegistry;
  /** Returns the set of node ids that are *in* scope for the current mode.
   *  The app computes this — typically: selection-only for path-edit,
   *  isolated subtree for isolation, empty for non-scoping modes. */
  getTargetIds: () => ReadonlySet<string>;
  /** Alpha for out-of-scope nodes. Default 0.3 (spec). */
  dimAlpha?: number;
}

/** Answers, per node, how a scoping mode should treat it: dimmed or not,
 *  hit-testable or not. Consult it from the renderer and the hit-tester —
 *  it computes nothing itself. Its answers change when the mode does, or when
 *  the app says the target set moved (`invalidate`); both notify
 *  subscribers, so a canvas can repaint on `subscribe` (`<SceneCanvas
 *  redrawOn>`). */
export interface ScopingDim {
  /** Multiplier in [0, 1] to apply to a node's render alpha. */
  alphaFor(id: string): number;
  /** Whether the node should respond to pointer hits. */
  isPointerInteractive(id: string): boolean;
  /** Tell subscribers the target set changed without a mode switch. */
  invalidate(): void;
  /** Monotonic; bumps on a mode switch and on `invalidate`. */
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

/** Build the scoping lookup for a mode registry. In a mode with
 *  `scoping: false` every node is full-alpha and interactive, so this is safe
 *  to consult unconditionally. */
export function createScopingDim(opts: CreateScopingDimOptions): ScopingDim {
  const { registry } = opts;
  const dim = opts.dimAlpha ?? 0.3;
  const listeners = new Set<() => void>();
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
      for (const l of [...listeners]) l();
    },
    getVersion: () => registry.getVersion() + invalidations,
    subscribe(listener) {
      listeners.add(listener);
      const offMode = registry.subscribe(listener);
      return () => {
        listeners.delete(listener);
        offMode();
      };
    },
  };
}

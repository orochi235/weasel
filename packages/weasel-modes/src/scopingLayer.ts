import type { ModeRegistry } from './registry';

export interface CreateScopingDimOptions {
  registry: ModeRegistry;
  /** Returns the set of node ids that are *in* scope for the current mode.
   *  The app computes this — typically: selection-only for path-edit,
   *  isolated subtree for isolation, empty for non-scoping modes. */
  getTargetIds: () => ReadonlySet<string>;
  /** Alpha for out-of-scope nodes. Default 0.3 (spec). */
  dimAlpha?: number;
}

export interface ScopingDim {
  /** Multiplier in [0, 1] to apply to a node's render alpha. */
  alphaFor(id: string): number;
  /** Whether the node should respond to pointer hits. */
  isPointerInteractive(id: string): boolean;
}

export function createScopingDim(opts: CreateScopingDimOptions): ScopingDim {
  const dim = opts.dimAlpha ?? 0.3;
  return {
    alphaFor(id) {
      const mode = opts.registry.current();
      if (!mode.scoping) return 1;
      return opts.getTargetIds().has(id) ? 1 : dim;
    },
    isPointerInteractive(id) {
      const mode = opts.registry.current();
      if (!mode.scoping) return true;
      return opts.getTargetIds().has(id);
    },
  };
}

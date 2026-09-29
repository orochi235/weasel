import type { Op } from './types';
import { registerOpFactory } from './registry';

interface ArrangeAdapter {
  setPose(id: string, pose: unknown): void;
}

/** One pose write an {@link createArrangeOp} made. */
export interface ArrangedPose {
  id: string;
  from: unknown;
  to: unknown;
}

/** Arguments to {@link createArrangeOp}. */
export interface ArrangeArgs {
  /** The writes to make. Absent until a computed arrangement has run once. */
  placed?: ArrangedPose[];
}

/**
 * Op: write a set of poses decided when the op first applies, not when it is
 * built. The scene appends one to an edit that moves nodes into a container,
 * and `compute` asks the container what to do with them after the rest of
 * the edit has landed. Every later apply — redo, or a rebuild from a
 * serialized history — replays the writes it recorded, so the arrangement is
 * decided once. `write` replaces the adapter's `setPose` for this op and its
 * inverses — the scene passes its own, since not every adapter an edit is
 * applied through can write poses.
 */
export function createArrangeOp(
  args: ArrangeArgs,
  compute?: () => ArrangedPose[],
  write?: (id: string, pose: unknown) => void,
): Op {
  const self: ArrangeArgs = { ...(args.placed ? { placed: args.placed } : {}) };
  return {
    name: 'arrange',
    args: self,
    label: 'Arrange',
    // Names what it moved, so a coalesced entry never undoes to a pose only
    // a later push wrote.
    get coalesceKey() {
      return self.placed === undefined ? undefined : `arrange:${self.placed.map((p) => p.id).sort().join(',')}`;
    },
    apply(adapter) {
      if (self.placed === undefined) self.placed = compute?.() ?? [];
      const set = write ?? ((id: string, pose: unknown) => (adapter as ArrangeAdapter).setPose(id, pose));
      for (const p of self.placed) set(p.id, p.to);
      return self.placed.length > 0 ? undefined : 'noop';
    },
    invert() {
      const placed = self.placed ?? [];
      return createArrangeOp({
        placed: [...placed].reverse().map((p) => ({ id: p.id, from: p.to, to: p.from })),
      }, undefined, write);
    },
  };
}

registerOpFactory<ArrangeArgs>('arrange', (args) => createArrangeOp(args));

import type { Op } from 'core/ops/types';

/** What a dep source commits through: one undoable batch of ops, with a label for the history entry. */
export interface OpsApplier {
  applyOps(ops: Op[], label?: string): void;
}

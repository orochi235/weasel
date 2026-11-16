/**
 * The `operands` dep: the ids an edit acts on. Editing actions read it rather
 * than the selection, so what they act on is whatever the host supplies — the
 * selection by default, or any other list. It holds ids, not geometry, so a 3D
 * host supplies it the same way.
 */
import type { NodeId } from 'core/scene/types';

/** The ids an edit acts on, and where it hands back the ids it leaves to act on next. */
export interface OperandsDep {
  /** The ids to act on now, in the provider's order. */
  get(): readonly NodeId[];
  /** Takes the ids an edit leaves behind — a duplicate's copies, a new group, none after a delete — and
   *  what an undo of the edit puts back. A selection selects them; a fixed list holds them in its place. */
  set(ids: readonly NodeId[]): void;
}

/** Operands held in a list of their own, starting at `ids`: an edit acts on them, and what it hands back
 *  replaces them. For acting on nodes no selection names. */
export function operandList(ids: readonly NodeId[] = []): OperandsDep {
  let held: readonly NodeId[] = [...ids];
  return {
    get: () => held,
    set: (next) => { held = [...next]; },
  };
}

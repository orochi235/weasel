import type { Op } from '@weasel-js/core';

/**
 * An undo entry over one value: it holds the value as it stood `before`, and
 * catches the value to redo to each time it is undone, since a snapshot is
 * taken when an undoable event fires, before the change it announces has
 * necessarily landed. One `T` across all three is what keeps the snapshot and
 * the restore covering the same fields. Never serialized: trial undo is
 * session-only.
 */
export function stateOp<T>(before: T, read: () => T | undefined, write: (value: T) => void): Op {
  let after: T | undefined;
  const forward: Op = {
    label: 'state',
    apply: () => {
      if (after !== undefined) write(structuredClone(after));
    },
    invert: () => {
      after = structuredClone(read());
      return { label: 'state', apply: () => write(structuredClone(before)), invert: () => forward };
    },
  };
  return forward;
}

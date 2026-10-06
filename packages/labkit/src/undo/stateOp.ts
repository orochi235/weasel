import type { Op } from '@weasel-js/core';

/**
 * An undo entry over a trial's whole `state`: it holds the state as it stood
 * `before`, and catches the state to redo to each time it is undone, since a
 * snapshot is taken when an undoable event fires, before the change it
 * announces has necessarily landed. Never serialized: trial undo is
 * session-only.
 */
export function stateOp(before: unknown, read: () => unknown, write: (state: unknown) => void): Op {
  let after: unknown;
  const forward: Op = {
    label: 'state',
    apply: () => write(structuredClone(after)),
    invert: () => {
      after = structuredClone(read());
      return { label: 'state', apply: () => write(structuredClone(before)), invert: () => forward };
    },
  };
  return forward;
}

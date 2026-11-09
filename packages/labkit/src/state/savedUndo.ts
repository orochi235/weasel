import type {
  History,
  SerializedHistory,
  SerializedHistoryEntry,
  SerializedOp,
} from '@weasel-js/core';
import { TRIAL_EDIT_OP, type TrialEditArgs } from '../trial/trialEditOp';
import type { InstrumentSerializers } from './types';

type Serializer = InstrumentSerializers[string];

/** What a trial's record keeps of its undo across a reload. */
export interface SavedTrialUndo {
  /** The trial's own history, with each edit's state put through the
   *  instrument's `serialize`. */
  trial?: SerializedHistory;
  /** The history the instrument handed over with `useTrialHistory`, as its
   *  `serialize` wrote it. */
  own?: unknown;
}

/** `history` as a trial's record saves it: undefined with nothing to undo or redo. */
export function savedTrialHistory(
  history: History,
  serializer: Serializer,
): SerializedHistory | undefined {
  const out = history.serialize();
  if (out.undoStack.length === 0 && out.redoStack.length === 0 && !out.branches) return undefined;
  const serialize = serializer?.serialize;
  return serialize ? withEditStates(out, (state) => serialize(state)) : out;
}

/** A saved trial history as it restores: each edit's state put back through `deserialize`. */
export function restorableTrialHistory(
  saved: SerializedHistory,
  serializer: Serializer,
): SerializedHistory {
  const deserialize = serializer?.deserialize;
  return deserialize ? withEditStates(saved, deserialize) : saved;
}

/** The latest stamp any entry of `saved` holds. */
export function latestStamp(saved: SerializedHistory): number {
  const entries = [
    ...saved.undoStack,
    ...saved.redoStack,
    ...(saved.branches ?? []).flatMap((b) => b.entries),
  ];
  return entries.reduce((max, e) => Math.max(max, e.timestamp ?? 0), Number.NEGATIVE_INFINITY);
}

/** `saved`, with `map` run over the state each trial edit holds. */
function withEditStates(
  saved: SerializedHistory,
  map: (state: unknown, config: unknown) => unknown,
): SerializedHistory {
  const side = <T extends TrialEditArgs['before'] | undefined>(value: T): T =>
    value && 'state' in value ? { ...value, state: map(value.state, value.config) } : value;
  const op = (o: SerializedOp): SerializedOp => {
    const args = o.args as TrialEditArgs;
    if (o.name !== TRIAL_EDIT_OP || args.fields !== 'edit') return o;
    const after = side(args.after);
    return {
      name: o.name,
      args: { ...args, before: side(args.before), ...(after ? { after } : {}) },
    };
  };
  const entry = (e: SerializedHistoryEntry): SerializedHistoryEntry => ({
    ...e,
    forwardOps: e.forwardOps.map(op),
    baseOps: e.baseOps.map(op),
  });
  return {
    ...saved,
    undoStack: saved.undoStack.map(entry),
    redoStack: saved.redoStack.map(entry),
    ...(saved.branches
      ? { branches: saved.branches.map((b) => ({ ...b, entries: b.entries.map(entry) })) }
      : {}),
  };
}

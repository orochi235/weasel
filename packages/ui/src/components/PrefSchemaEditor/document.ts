import { swapOp as swap, type Op, type SerializedHistory } from '@weasel-js/core';
import { SWAP, type DraftStorage } from './draft';

/** A draft as a document opens it. */
export interface OpenedDocument<V> {
  savedAt: number;
  value: V;
  /** The steps around it, when they were kept and still read. */
  stacks: SerializedHistory | null;
  /** How the draft met the baseline it opens on: saved against this `same` one, `carried` onto it from another,
   *  or of a baseline `unknown`. */
  met: 'same' | 'carried' | 'unknown';
}

/** How one kind of value is kept in storage and reconciled with its baseline. */
export interface DocumentCodec<V> {
  openDraft(key: string, base: V, storage?: DraftStorage): OpenedDocument<V> | null;
  saveDraft(key: string, value: V, base: V, stacks: SerializedHistory, savedAt: number, storage?: DraftStorage): void;
  dropDraft(key: string, storage?: DraftStorage): void;
  /** `value`, just submitted, as storage can hold it. */
  packSent(value: V, base: V): unknown;
  /** `value` once what was `sent` is in `base`: edits made since the submission stay. */
  afterTaken(value: V, sent: unknown, base: V): V;
}

/** An edit as the swap of one whole value for another: values are immutable, so the snapshots cost nothing. */
export function swapOp<V>(before: V, after: V, emit: (v: V) => void, coalesceKey?: string): Op {
  return swap({ name: SWAP, label: 'edit schema', before, after, emit, coalesceKey });
}

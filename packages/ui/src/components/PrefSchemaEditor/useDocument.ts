import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createHistory, useLatest } from '@weasel-js/core';
import { SWAP, swapOp, type DocumentCodec, type DraftStorage, type OpenedDocument } from './document';

/** Edits this close together under one coalesce key undo as one, so typing a name is one step. */
const COALESCE_MS = 800;

export interface DocumentOptions<V> {
  value: V;
  onChange(next: V): void;
  /** What the change list and the draft are measured against. */
  base: V;
  codec: DocumentCodec<V>;
  /** The draft found under `draftKey` as the editor mounted, which the document hands to `onChange` once. */
  opened: OpenedDocument<V> | null;
  draftKey?: string;
  draftStorage?: DraftStorage;
  /** Nothing sent is still waiting: what was last sent is in `base` now. */
  taken: boolean;
  /** The selection a step records and restores. */
  selection: { get(): string[]; set(ids: readonly string[]): void };
}

export interface EditorDocument<V> {
  /** Replace the value as one step back. Steps sharing a `coalesceKey` close together are one. */
  commit(next: V, coalesceKey?: string): void;
  step(to: 'undo' | 'redo'): void;
  canUndo: boolean;
  canRedo: boolean;
  /** When the draft was last kept; `null` with none. */
  draftSavedAt: number | null;
  /** The value last handed to `onChange`, ahead of the render that shows it. */
  current(): V;
  /** Run a submission, and remember what it carried once it succeeds. */
  send(run: () => Promise<void> | void): Promise<void>;
}

interface Swap<V> { before: V; after: V }

/** One controlled value's undo history, its draft in storage, and what of it was sent. */
export function useDocument<V>(options: DocumentOptions<V>): EditorDocument<V> {
  const { value, base, codec, opened, draftKey, draftStorage, taken } = options;
  const latest = useLatest(options);
  const emitted = useRef(value);
  const hand = (next: V) => {
    emitted.current = next;
    latest.current.onChange(next);
  };
  const [history] = useState(() =>
    createHistory(null, {
      coalesceWindowMs: COALESCE_MS,
      selection: {
        get: () => latest.current.selection.get(),
        set: (ids) => latest.current.selection.set(ids),
      },
      rebuildOp: (name, args) => (name === SWAP ? swapOp((args as Swap<V>).before, (args as Swap<V>).after, hand) : null),
    }),
  );
  useSyncExternalStore(history.subscribe, history.getVersion);
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    history.clear();
  }, [value, history]);

  // The draft follows every step, with the steps around it; back at the baseline there is nothing to keep.
  const [draftSavedAt, setDraftSavedAt] = useState(() => opened?.savedAt ?? null);
  const keep = () => {
    if (draftKey === undefined) return;
    const savedAt = emitted.current === base ? null : Date.now();
    if (savedAt === null) codec.dropDraft(draftKey, draftStorage);
    else codec.saveDraft(draftKey, emitted.current, base, history.serialize(), savedAt, draftStorage);
    setDraftSavedAt(savedAt);
  };
  useEffect(() => {
    if (!opened || draftKey === undefined) return;
    hand(opened.value);
    if (opened.stacks) history.restore(opened.stacks);
    // Saved again as an edit of this baseline, so the next editor has nothing to carry.
    if (opened.met === 'carried') codec.saveDraft(draftKey, opened.value, base, history.serialize(), opened.savedAt, draftStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a draft is opened once, by the editor that finds it
  }, []);

  const sent = useRef<unknown>(null);
  useEffect(() => {
    sent.current ??= draftKey === undefined ? null : codec.openSent(draftKey, draftStorage);
    if (!taken || sent.current === null) return;
    const next = codec.afterTaken(emitted.current, sent.current, base);
    sent.current = null;
    if (draftKey !== undefined) codec.dropSent(draftKey, draftStorage);
    hand(next);
    history.clear();
    keep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the host's word is the only thing that sets this off
  }, [taken]);

  return {
    commit(next, coalesceKey) {
      history.applyOps([swapOp(latest.current.value, next, hand, coalesceKey)], 'edit schema');
      keep();
    },
    step(to) {
      history[to]();
      keep();
    },
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    draftSavedAt,
    current: () => emitted.current,
    async send(run) {
      const packed = codec.packSent(emitted.current, base);
      await run();
      sent.current = packed;
      if (draftKey !== undefined) codec.saveSent(draftKey, packed, draftStorage);
    },
  };
}

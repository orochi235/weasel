/**
 * A bounded journal of the node ids a scene's changes touched, read back by
 * token. A reader holds the token of its last read and asks what was touched
 * since; once the journal no longer reaches back that far, the answer is that
 * it does not know, and the reader starts over.
 */
import type { NodeId } from './types';

/** How a journal entry touched its id. */
export const TOUCH_CONTENT = 1;
/** The id's children changed: one was added, removed, moved in or out, or reordered. `null` is the roots. */
export const TOUCH_CHILDREN = 2;
/** The render order changed without any children list changing: a node moved to another layer. */
export const TOUCH_ORDER = 4;

/** What a journal holds between two tokens. */
export interface JournalSpan {
  /** Ids whose own content changed. */
  readonly content: ReadonlySet<NodeId>;
  /** Containers whose children changed, `null` standing for the roots. */
  readonly parents: ReadonlySet<NodeId | null>;
  /** Whether anything in the span moved the render order. */
  readonly structural: boolean;
}

export interface TouchJournal {
  note(id: NodeId | null, how: number): void;
  /** Forget everything: every reader holding an earlier token is told `'unknown'`. */
  reset(): void;
  /** The token a read now is current as of. */
  token(): number;
  /** What was touched since `token`, or `'unknown'` when the journal does not reach back that far. */
  since(token: number): JournalSpan | 'unknown';
}

/** Entries kept. A reader that falls further behind than this rebuilds. */
export const JOURNAL_CAPACITY = 4096;

export function createTouchJournal(capacity = JOURNAL_CAPACITY): TouchJournal {
  const ids: (NodeId | null)[] = new Array(capacity).fill(null);
  const hows = new Uint8Array(capacity);
  /** Entries ever noted; the token after the newest. */
  let seq = 0;
  /** The earliest token a span can start from. */
  let floor = 0;
  return {
    note(id, how) {
      const at = seq % capacity;
      ids[at] = id;
      hows[at] = how;
      seq++;
    },
    reset() {
      // Past every token handed out, so a reader holding the current one is told too.
      hows[seq % capacity] = 0;
      seq++;
      floor = seq;
    },
    token: () => seq,
    since(token) {
      if (token < floor || token > seq || seq - token > capacity) return 'unknown';
      const content = new Set<NodeId>();
      const parents = new Set<NodeId | null>();
      let structural = false;
      for (let t = token; t < seq; t++) {
        const at = t % capacity;
        const how = hows[at]!;
        const id = ids[at]!;
        if ((how & TOUCH_CONTENT) !== 0 && id !== null) content.add(id);
        if ((how & TOUCH_CHILDREN) !== 0) {
          parents.add(id);
          structural = true;
        }
        if ((how & TOUCH_ORDER) !== 0) structural = true;
      }
      return { content, parents, structural };
    },
  };
}

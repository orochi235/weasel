/** A root's history steps read a slice at a time through their cursor, the stack's entries along with them on request. */
import type { DevtoolsHistorySlice } from './protocol';
import type { DevtoolsClient } from './client';

/** A cursor over one root's history steps. */
export interface HistoryFollower {
  /** The steps recorded since the last read, and where the history stands now. Reads run one after another. */
  read(): Promise<DevtoolsHistorySlice>;
  /** Ask for the stack's entries with every read from the next on. */
  setHistoryEntries(on: boolean): void;
}

/** Follow `rootId`'s history steps through `client`, from the oldest step the canvas still holds. */
export function followHistory(client: DevtoolsClient, rootId: string): HistoryFollower {
  let cursor = 0;
  let historyEntries = false;
  let last: Promise<unknown> = Promise.resolve();

  const readOnce = async (): Promise<DevtoolsHistorySlice> => {
    const slice = await client.request(rootId, { type: 'get-history', cursor, ...(historyEntries ? { historyEntries } : {}) });
    cursor = slice.cursor;
    return slice;
  };

  return {
    read() {
      const next = last.then(readOnce, readOnce);
      last = next.catch(() => undefined);
      return next;
    },
    setHistoryEntries(on) {
      historyEntries = on;
    },
  };
}

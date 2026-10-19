/** A root's dispatch trace read a slice at a time, each read picking up where the last left off. */
import type { SerializedValue } from '@weasel-js/core/devtools-protocol';
import type { DevtoolsClient } from './client';

/** What one read hands back. `coords` is present only while coord records are asked for. */
export interface TraceRead {
  entries: SerializedValue[];
  live: SerializedValue;
  coords?: SerializedValue[];
}

/** A cursor over one root's dispatch trace, and over its coord records once asked. */
export interface TraceFollower {
  /** The trace and, when on, the coord records recorded since the last read. Reads run one after another. */
  read(): Promise<TraceRead>;
  /** Ask for coord records from the next read on. Turned on, it starts from the oldest the canvas still holds. */
  setCoords(on: boolean): void;
}

/** Follow `rootId`'s dispatch trace through `client`, from the oldest record the canvas still holds. */
export function followTrace(client: DevtoolsClient, rootId: string): TraceFollower {
  let cursor = 0;
  let coordCursor: number | null = null;
  let last: Promise<unknown> = Promise.resolve();

  const readOnce = async (): Promise<TraceRead> => {
    const slice = await client.request(rootId, {
      type: 'get-trace', cursor, ...(coordCursor !== null ? { coordCursor } : {}),
    });
    cursor = slice.cursor;
    const out: TraceRead = { entries: slice.entries, live: slice.live };
    if (slice.coords && coordCursor !== null) {
      coordCursor = slice.coords.cursor;
      out.coords = slice.coords.entries;
    }
    return out;
  };

  return {
    read() {
      const next = last.then(readOnce, readOnce);
      last = next.catch(() => undefined);
      return next;
    },
    setCoords(on) {
      if (on && coordCursor === null) coordCursor = 0;
      else if (!on) coordCursor = null;
    },
  };
}

import type { RecordCache } from '@weasel-js/storage';

let held: RecordCache | undefined;

/** Where draw's session is kept: the IndexedDB records `openSession` opened, or `undefined` for `localStorage`,
 *  before they have opened or where IndexedDB would not. */
export const sessionRecords = (): RecordCache | undefined => held;

export function holdSessionRecords(records: RecordCache | undefined): void {
  held = records;
}

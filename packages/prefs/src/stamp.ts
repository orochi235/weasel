/**
 * How a pref is stored: its value, stamped with the schema version it was
 * written at. The stamp is what lets a record be migrated from its own
 * version, whatever the store's version record says by the time it is read.
 */
export interface StampedRecord {
  /** The schema version `value` is in the shape of. */
  $at: number;
  value: unknown;
}

const isVersion = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function stampRecord(value: unknown, at: number): StampedRecord {
  return { $at: at, value };
}

export function isStampedRecord(record: unknown): record is StampedRecord {
  if (record === null || typeof record !== 'object') return false;
  const keys = Object.keys(record);
  return keys.length === 2 && Object.hasOwn(record, 'value') && isVersion((record as StampedRecord).$at);
}

/**
 * A stored record's value and the version it is in. One with no stamp was
 * written by a build from before records carried one, and is read as being
 * in `unstamped`, the version the store said it was at.
 */
export function readRecord(record: unknown, unstamped: number): { at: number; value: unknown; stamped: boolean } {
  return isStampedRecord(record)
    ? { at: record.$at, value: record.value, stamped: true }
    : { at: unstamped, value: record, stamped: false };
}

/** A stored record's value, whatever version it is in. */
export function recordValue(record: unknown): unknown {
  return isStampedRecord(record) ? record.value : record;
}

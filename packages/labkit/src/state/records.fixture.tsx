/**
 * Lets a test send the record cache's queued writes at once, rather than wait out its write debounce on the
 * clock: under a loaded full run that wait outlasts `waitFor`'s deadline. Test-only: nothing in the package
 * imports it.
 */
import { act } from '@testing-library/react';
import type { RecordCache } from '@weasel-js/storage';
import { useContext } from 'react';
import { PersistenceContext } from './Persistence';

/** Where `<CatchRecords>` puts the records it takes. */
export interface CaughtRecords {
  records: RecordCache | null;
  take: (records: RecordCache | null) => void;
}

/** An empty catch for `<CatchRecords into>`. */
export function createCatch(): CaughtRecords {
  const caught: CaughtRecords = {
    records: null,
    take: (records) => {
      caught.records = records;
    },
  };
  return caught;
}

/** Rendered under a `<Lab>`, `<Persistence>` or `SingletonExperimentProvider`, hands its records to `into`. */
export function CatchRecords({ into }: { into: CaughtRecords }): null {
  into.take(useContext(PersistenceContext));
  return null;
}

/** Sends the caught records' queued writes, and fails if one did not land. */
export async function flushCaught(caught: CaughtRecords): Promise<void> {
  await act(async () => {
    if (!caught.records)
      throw new Error('flushCaught: render <CatchRecords> under the provider first');
    if (!(await caught.records.flush()))
      throw new Error('flushCaught: a queued write did not land');
  });
}

/**
 * Lets a test send the record cache's queued writes at once, rather than wait out its write debounce on the
 * clock: under a loaded full run that wait outlasts `waitFor`'s deadline. Test-only: nothing in the package
 * imports it.
 */
import { act } from '@testing-library/react';
import type { RecordCache } from '@weasel-js/storage';
import { useContext } from 'react';
import { PersistenceContext } from './Persistence';

/** `Catch`, rendered under a `<Lab>`, `<Persistence>` or `SingletonExperimentProvider`, takes its records;
 *  `flush` sends their queued writes and fails if one did not land. */
export function catchRecords(): { Catch: () => null; flush: () => Promise<void> } {
  let records: RecordCache | null = null;
  const Catch = (): null => {
    records = useContext(PersistenceContext);
    return null;
  };
  const flush = async (): Promise<void> => {
    await act(async () => {
      if (!records) throw new Error('catchRecords: render <Catch /> under the provider first');
      if (!(await records.flush())) throw new Error('catchRecords: a queued write did not land');
    });
  };
  return { Catch, flush };
}

import { useEffect, useReducer, useState } from 'react';
import { localStorageAdapter, openRecordsSync, readLocal, type RecordCache } from '@weasel-js/storage';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import { useVisiblePoll } from '../useVisiblePoll';
import s from './StorageDemo.module.css';

const PREFIX = 'weasel-demo-storage.';
const NAMES = ['count', 'note'] as const;

const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

/** Every record under `PREFIX`, open while the demo is mounted. */
function useRecords(): RecordCache | null {
  const [cache, setCache] = useState<RecordCache | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const opened = openRecordsSync({ storage: localStorageAdapter, prefix: PREFIX });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the cache's lifetime is this effect's
    setCache(opened);
    const off = opened.subscribe(bump);
    return () => {
      off();
      void opened.close();
    };
  }, []);
  return cache;
}

export function StorageDemo() {
  const cache = useRecords();
  // What localStorage itself holds, read again a few times a second so the debounce shows.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useVisiblePoll(bump, 200);
  if (!cache) return null;
  const count = typeof cache.get('count') === 'number' ? (cache.get('count') as number) : 0;
  const note = typeof cache.get('note') === 'string' ? (cache.get('note') as string) : '';

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <Button onClick={() => cache.set('count', count + 1)}>Add one</Button>
        <span className={s.count}>{count}</span>
        <Input aria-label="Note" placeholder="Note" value={note} onChange={(v) => cache.set('note', v)} className={s.note} />
        <Button variant="ghost" onClick={() => NAMES.forEach((n) => cache.delete(n))}>Clear</Button>
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">record</th>
            <th scope="col">cache.get()</th>
            <th scope="col">localStorage</th>
            <th scope="col">pending</th>
          </tr>
        </thead>
        <tbody>
          {NAMES.map((name) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>{show(cache.get(name))}</td>
              <td>{show(readLocal(PREFIX + name))}</td>
              <td>{cache.pending(name) ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

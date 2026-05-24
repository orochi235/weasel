import { describe, it, expect } from 'vitest';
import { createJournalCache } from './journalCache';

const makeJournal = (id: string) => ({ id, applyBatch: () => {}, commit: () => {}, cancel: () => {}, suspend: () => {} } as never);

describe('createJournalCache', () => {
  it('stores and retrieves a journal by (modeId, targetId)', () => {
    const cache = createJournalCache({ capacity: 8 });
    const j = makeJournal('a');
    cache.put('path-edit', 'p1', j);
    expect(cache.get('path-edit', 'p1')).toBe(j);
    expect(cache.get('path-edit', 'p2')).toBe(null);
    expect(cache.get('isolation', 'p1')).toBe(null);
  });

  it('evicts least-recently-used when capacity is exceeded', () => {
    const cache = createJournalCache({ capacity: 2 });
    cache.put('m', 'a', makeJournal('a'));
    cache.put('m', 'b', makeJournal('b'));
    cache.put('m', 'c', makeJournal('c'));  // evicts 'a'
    expect(cache.get('m', 'a')).toBe(null);
    expect(cache.get('m', 'b')).not.toBe(null);
    expect(cache.get('m', 'c')).not.toBe(null);
  });

  it('get marks an entry as most-recently-used', () => {
    const cache = createJournalCache({ capacity: 2 });
    cache.put('m', 'a', makeJournal('a'));
    cache.put('m', 'b', makeJournal('b'));
    cache.get('m', 'a');                    // bump a to MRU
    cache.put('m', 'c', makeJournal('c'));  // should evict b (now LRU)
    expect(cache.get('m', 'a')).not.toBe(null);
    expect(cache.get('m', 'b')).toBe(null);
    expect(cache.get('m', 'c')).not.toBe(null);
  });

  it('clear() removes everything (called on save/load)', () => {
    const cache = createJournalCache({ capacity: 8 });
    cache.put('m', 'a', makeJournal('a'));
    cache.clear();
    expect(cache.get('m', 'a')).toBe(null);
  });

  it('remove() drops a specific entry (called on discard)', () => {
    const cache = createJournalCache({ capacity: 8 });
    cache.put('m', 'a', makeJournal('a'));
    cache.remove('m', 'a');
    expect(cache.get('m', 'a')).toBe(null);
  });
});

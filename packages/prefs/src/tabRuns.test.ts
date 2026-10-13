import { describe, expect, it } from 'vitest';
import { prefTabRuns } from './tabRuns';

const isTab = (item: string): boolean => item.startsWith('t');

describe('prefTabRuns', () => {
  it('folds each run of neighboring tabs into one step, in order', () => {
    expect(prefTabRuns(['a', 't1', 't2', 'b', 't3'], isTab)).toEqual([
      { item: 'a' },
      { tabs: ['t1', 't2'] },
      { item: 'b' },
      { tabs: ['t3'] },
    ]);
  });

  it('starts a new run after anything that is not a tab', () => {
    expect(prefTabRuns(['t1', 'a', 't2'], isTab)).toEqual([{ tabs: ['t1'] }, { item: 'a' }, { tabs: ['t2'] }]);
  });

  it('is empty for no items', () => {
    expect(prefTabRuns([], isTab)).toEqual([]);
  });
});

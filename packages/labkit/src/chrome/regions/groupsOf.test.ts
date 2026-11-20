import { describe, expect, it } from 'vitest';
import type { ContributionBase } from '../types';
import { groupsOf } from './groupsOf';

const c = (id: string, over: Partial<ContributionBase> = {}): ContributionBase => ({ id, ...over });

describe('groupsOf', () => {
  it('pushes a group to the far end when a later member asks', () => {
    const groups = groupsOf([
      c('loupe', { group: 'view' }),
      c('grid', { group: 'view', end: true }),
    ]);
    expect(groups.map((g) => [g.key, g.end])).toEqual([['view', true]]);
  });

  it('keeps a group at the far end when a later member leaves end unset', () => {
    const groups = groupsOf([
      c('export', { group: 'trial', end: true }),
      c('share', { group: 'trial' }),
    ]);
    expect(groups.map((g) => [g.key, g.end])).toEqual([['trial', true]]);
  });
});

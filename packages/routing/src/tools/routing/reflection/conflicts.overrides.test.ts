import { describe, it, expect } from 'vitest';
import { findScopedConflicts } from './conflicts';
import type { Contribution } from '../../../contributions/types';
import type { GestureSpec } from '@weasel-js/gestures';

const key = (k: string): GestureSpec => ({ kind: 'key', key: k });
const ambient = (id: string, k: string): Contribution => ({
  id, eligibility: { always: true }, bindings: [{ spec: key(k), actionId: `${id}.run` }],
});

describe('findScopedConflicts under binding overrides', () => {
  it('reports a binding an override moves onto a taken key', () => {
    const scopes = { registry: [], ambient: [ambient('a', 'L'), ambient('b', 'M')] };
    expect(findScopedConflicts(scopes)).toEqual([]);
    const conflicts = findScopedConflicts({ ...scopes, overrides: new Map([['b#0', key('L')]]) });
    expect(conflicts.map((c) => c.ownerIds)).toEqual([['a', 'b']]);
  });

  it('drops a binding an override unbinds', () => {
    const scopes = { registry: [], ambient: [ambient('a', 'L'), ambient('b', 'L')] };
    expect(findScopedConflicts(scopes)).toHaveLength(1);
    expect(findScopedConflicts({ ...scopes, overrides: new Map([['b#0', null]]) })).toEqual([]);
  });
});

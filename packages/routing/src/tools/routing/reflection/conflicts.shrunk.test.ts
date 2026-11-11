/** Ties `findConflicts` misread, as its property test shrank them. */
import { describe, expect, it } from 'vitest';
import type { Contribution } from '../../../contributions/types';
import { findConflicts } from './conflicts';

const entry = (id: string, ...specs: object[]): Contribution<unknown> =>
  ({ id, eligibility: { always: true }, bindings: specs.map((spec, i) => ({ spec, actionId: `${id}.${i}` })) }) as Contribution<unknown>;

describe('findConflicts, shrunk', () => {
  it('does not flag a binding whose phase outranks the other', () => {
    const phased = { kind: 'key', key: 'a', phase: [{ channel: '&', phase: 'initial' }, { channel: '&', phase: 'engaged' }] };
    expect(findConflicts([entry('o0', phased, { kind: 'key', key: 'a' })])).toEqual([]);
  });

  it('flags a binding of either phase against an initial one of equal rank', () => {
    const either = { kind: 'key', key: 'a', phase: '*' };
    const initial = { kind: 'key', key: 'a', phase: [{ channel: '*', phase: 'initial' }] };
    expect(findConflicts([entry('o0', either), entry('o1', initial)]).map((c) => c.ownerIds)).toEqual([['o0', 'o1']]);
  });

  it('flags two owners whose bindings tie while one is engaged and the other idle', () => {
    const engaged = { kind: 'key', key: 'a', phase: 'engaged' };
    const initial = { kind: 'key', key: 'a', phase: 'initial' };
    expect(findConflicts([entry('o0', engaged), entry('o1', initial)]).map((c) => c.ownerIds)).toEqual([['o0', 'o1']]);
    expect(findConflicts([entry('o0', engaged, initial)])).toEqual([]);
  });

  it('flags bindings whose codes overlap whatever their keys, once each', () => {
    const one = { kind: 'key', key: 'a', code: ['Digit1', 'KeyA'] };
    const other = { kind: 'key', key: 'Enter', code: 'Digit1' };
    expect(findConflicts([entry('o0', one), entry('o1', other)]).map((c) => c.ownerIds)).toEqual([['o0', 'o1']]);
    const same = { kind: 'key', key: 'a', code: 'KeyA' };
    expect(findConflicts([entry('o0', same), entry('o1', { ...same })])).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflicts';
import { phasesTie } from './conflictKeys';
import type { RegistryEntry } from './registry';
import type { Tool } from '../../types';

const tool = (id: string, views: string[]) =>
  ({ id, bindings: [{ spec: { kind: 'key', key: 'k' }, actionId: id, opts: { views } }] }) as unknown as Tool;

describe('findConflicts: one bucket holding separate ties', () => {
  it('reports each set of bindings that tie with each other, not one conflict naming all', () => {
    const c = findConflicts([tool('a', ['x']), tool('b', ['x']), tool('c', ['y']), tool('d', ['y'])]);
    expect(c.map((x) => x.ownerIds)).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('reports each pair of a chain of ties, never naming two that do not tie', () => {
    const c = findConflicts([tool('a', ['x']), tool('b', ['x', 'y']), tool('c', ['y'])]);
    expect(c.map((x) => x.ownerIds)).toEqual([['a', 'b'], ['b', 'c']]);
  });
});

describe('findConflicts: phases naming many channels', () => {
  const phased = (id: string, phase: unknown) =>
    ({ id, bindings: [{ spec: { kind: 'key', key: 'k', phase }, actionId: id }] }) as unknown as Tool;

  it('ties two bindings with the same phase list however many channels it names', () => {
    const phase = Array.from({ length: 29 }, (_, i) => ({ channel: `c${i}`, phase: 'engaged' }));
    expect(findConflicts([phased('a', phase), phased('b', phase)]).map((x) => x.ownerIds)).toEqual([['a', 'b']]);
  });

  it('ties two phases only where one engagement state meets both', () => {
    const entry = (ownerId: string, phase: unknown) => ({ ownerId, spec: { kind: 'key', key: 'k', phase } }) as unknown as RegistryEntry;
    const x = (phase: string) => [{ channel: 'x', phase }];
    const anyCh = (phase: string) => [{ channel: '*', phase }];
    expect(phasesTie(entry('a', x('engaged')), entry('b', x('initial')))).toBe(false);
    expect(phasesTie(entry('a', x('engaged')), entry('b', [...x('initial'), ...anyCh('engaged')]))).toBe(true);
    expect(phasesTie(entry('a', anyCh('initial')), entry('b', 'engaged'))).toBe(false);
    expect(phasesTie(entry('a', anyCh('engaged')), entry('b', 'initial'))).toBe(true);
    expect(phasesTie(entry('a', 'engaged'), entry('a', [{ channel: 'a', phase: 'initial' }]))).toBe(false);
    expect(phasesTie(entry('a', anyCh('initial')), entry('b', anyCh('engaged')))).toBe(false);
    expect(phasesTie(entry('a', []), entry('b', x('*')))).toBe(true);
  });
});

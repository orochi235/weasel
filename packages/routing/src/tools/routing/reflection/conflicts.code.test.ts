import { describe, it, expect } from 'vitest';
import { findConflicts } from './conflicts';
import type { Tool } from '../../types';

const tool = (id: string, spec: object) => ({ id, bindings: [{ spec, actionId: id }] }) as unknown as Tool;

describe('findConflicts: a physical key code', () => {
  it('flags a code spec against a key spec typed by that key', () => {
    const c = findConflicts([tool('a', { kind: 'key', key: 'y', code: 'KeyZ' }), tool('b', { kind: 'key', key: 'z' })]);
    expect(c.map((x) => x.ownerIds)).toEqual([['a', 'b']]);
  });

  it('does not flag a code spec against a key on another physical key', () => {
    expect(findConflicts([tool('a', { kind: 'key', key: 'y', code: 'KeyZ' }), tool('b', { kind: 'key', key: 'x' })])).toEqual([]);
  });
});

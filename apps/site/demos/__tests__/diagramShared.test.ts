import { describe, expect, it } from 'vitest';
import type { DataEdge } from '@weasel-js/diagram';
import { connected } from '../diagram/shared';

describe('connected', () => {
  it('adds a connect once, and hands back the same edges when its id is already there', () => {
    const wire: DataEdge = { from: 'scale', fromPort: 'out', to: 'load' };
    const once = connected([], wire);
    expect(once).toEqual([wire]);
    expect(connected(once, { ...wire })).toBe(once);
    expect(connected(once, { ...wire, toPort: 's' })).toHaveLength(2);
  });
});

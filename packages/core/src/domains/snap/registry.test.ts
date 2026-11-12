import { describe, expect, it } from 'vitest';
import { createSnapSourceRegistry } from './registry';
import type { SnapSource } from './types';

const source = (id: string) => ({ id }) as unknown as SnapSource;

describe('createSnapSourceRegistry', () => {
  it('a release takes out its own add of a shared source and leaves the other', () => {
    const registry = createSnapSourceRegistry();
    const shared = source('grid');
    const first = registry.add(shared);
    registry.add(shared);
    first();
    expect(registry.list()).toEqual([shared]);
    first();
    expect(registry.list()).toEqual([shared]);
  });

  it('keeps mount order when the earlier of two adds of one source goes', () => {
    const registry = createSnapSourceRegistry();
    const s = source('s');
    const t = source('t');
    const first = registry.add(s);
    registry.add(t);
    registry.add(s);
    first();
    expect(registry.list()).toEqual([t, s]);
  });
});

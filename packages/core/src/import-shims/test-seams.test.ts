import { describe, expect, it } from 'vitest';
import * as seams from './test-seams';

describe('@weasel-js/core/test-seams', () => {
  it('exports each seam under one name', () => {
    const names = new Map<unknown, string[]>();
    for (const [name, value] of Object.entries(seams)) names.set(value, [...(names.get(value) ?? []), name]);
    expect([...names.values()].filter((n) => n.length > 1)).toEqual([]);
  });
});

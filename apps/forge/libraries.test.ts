import { describe, expect, it } from 'vitest';
import { LIBRARIES } from './libraries';
import { stories } from './viteShared';

describe('the workshop libraries', () => {
  it('name the package of every directory the workshop reads stories from', () => {
    const dirs = stories.map((glob) => `/${glob.split('/').slice(0, 2).join('/')}/`);
    expect(LIBRARIES.map((l) => l.path).sort()).toEqual([...new Set(dirs)].sort());
  });
});

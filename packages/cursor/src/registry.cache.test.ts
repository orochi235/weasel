import { describe, expect, it, vi } from 'vitest';

vi.mock('./bake', async (importOriginal) => {
  const real = await importOriginal<typeof import('./bake')>();
  return { ...real, bakeCursor: vi.fn(real.bakeCursor) };
});

const { bakeCursor } = await import('./bake');
const { CURSOR_BAKE_CACHE_LIMIT, cursorFor } = await import('./registry');

describe('cursorFor cache', () => {
  it('stays bounded under a continuously varying size, evicting the least recently used', () => {
    const bakes = vi.mocked(bakeCursor);
    const sizeOf = (i: number) => 1 + i / 1000;
    for (let i = 0; i <= CURSOR_BAKE_CACHE_LIMIT; i++) cursorFor('pen', { size: sizeOf(i) });
    bakes.mockClear();
    // The newest entry is still a hit; the oldest was evicted and bakes again.
    cursorFor('pen', { size: sizeOf(CURSOR_BAKE_CACHE_LIMIT) });
    expect(bakes).not.toHaveBeenCalled();
    cursorFor('pen', { size: sizeOf(0) });
    expect(bakes).toHaveBeenCalledTimes(1);
  });
});

import { it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({ fail: true }));

vi.mock('./vendor/harfbuzzjs/harfbuzz', async (importOriginal) => {
  const real = await importOriginal<typeof import('./vendor/harfbuzzjs/harfbuzz')>();
  return {
    default: (...args: Parameters<typeof real.default>) =>
      (state.fail ? Promise.reject(new Error('offline')) : real.default(...args)),
  };
});

it('loads again after a load that failed, rather than answering its failure for good', async () => {
  const { loadShaper } = await import('./shaper');
  await expect(loadShaper()).rejects.toThrow('offline');
  state.fail = false;
  const shaper = await loadShaper();
  expect(typeof shaper.shape).toBe('function');
  expect(loadShaper()).toBe(loadShaper());
});

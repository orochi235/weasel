import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { _resetPaintKindsForTests, getPaintKind, registerPaintKindLoader } from '../core/paintKinds';
import { warmRender } from './renderSceneToPixels';

beforeEach(() => {
  _resetPaintKindsForTests();
  _resetFontRegistryForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  _resetPaintKindsForTests();
  _resetFontRegistryForTests();
});

describe('warmRender', () => {
  it('loads a paint kind declared lazily', async () => {
    const load = vi.fn(async () => ({ ...getPaintKind('solid')!, id: 'test-late', label: 'Late' }));
    registerPaintKindLoader('test-late', load);
    await warmRender();
    expect(load).toHaveBeenCalledTimes(1);
    expect(getPaintKind('test-late')?.label).toBe('Late');
  });

  it('starts a font registered lazily and waits for it to settle', async () => {
    let land!: () => void;
    const fetched = new Promise<void>((r) => { land = r; });
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await fetched;
      throw new Error('offline');
    });
    void registerFont('late', {}, '/l.json', '/l.png', { lazy: true }).catch(() => {});
    let settled = false;
    const warm = warmRender().catch(() => {}).finally(() => { settled = true; });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    expect(settled).toBe(false);
    land();
    await warm;
    expect(settled).toBe(true);
  });

  it('rejects for a family nothing registered', async () => {
    await expect(warmRender({ families: ['nope'] })).rejects.toThrow(/nope/);
  });
});

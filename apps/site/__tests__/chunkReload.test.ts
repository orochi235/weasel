import { describe, expect, it } from 'vitest';
import { isChunkLoadError, RELOAD_WINDOW_MS, reloadOnce, type ReloadStore } from '../chunkReload';

const memory = (): ReloadStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('isChunkLoadError', () => {
  it("recognizes each engine's wording for a chunk that failed to load", () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://michaelbaker.tech/weasel/assets/AnnotationCaptureDemo-Bhhd94Cd.js',
      'error loading dynamically imported module: https://example.com/weasel/assets/a.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /weasel/assets/a.css',
    ]) {
      expect(isChunkLoadError(new TypeError(message)), message).toBe(true);
    }
  });

  it('leaves every other error alone', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('reloadOnce', () => {
  it('allows one reload, then refuses until the window has passed', () => {
    const store = memory();
    expect(reloadOnce(store, 1_000)).toBe(true);
    expect(reloadOnce(store, 1_000 + RELOAD_WINDOW_MS - 1)).toBe(false);
    expect(reloadOnce(store, 1_000 + RELOAD_WINDOW_MS)).toBe(true);
  });

  it('refuses when nothing can remember the last reload', () => {
    expect(reloadOnce(undefined, 1_000)).toBe(false);
    const denied: ReloadStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
    };
    expect(reloadOnce(denied, 1_000)).toBe(false);
  });
});

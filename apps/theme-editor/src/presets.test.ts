import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL, liveHistory, liveOf, loadLive, loadSaved, persist, persistLive, savedOf, storedPresets } from './presets';

/** A stored value as `JSON.parse` reads it back. */
const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('restoring the live state', () => {
  it('round-trips what was on screen', () => {
    const state = { ...INITIAL, c: { ...INITIAL.c, count: 14 }, surfaceKey: 'light' as const };
    expect(liveOf(stored(state))).toEqual(state);
  });

  it('fills a constraint that did not exist when the state was written', () => {
    // The failure this guards: a missing field reaches the generator as
    // undefined and every measurement comes back NaN.
    const restored = liveOf({ c: { count: 12 }, surfaceKey: 'dark', anchors: [] });
    expect(restored.c.count).toBe(12);
    expect(restored.c.minDistance).toBe(INITIAL.c.minDistance);
    expect(Number.isFinite(restored.c.hueFloor)).toBe(true);
  });

  it('takes the default for a constraint stored as the wrong kind of value', () => {
    const restored = liveOf({ c: { count: null, hueFloor: '0.5', anchors: {}, order: 7, minContrast: 3 } });
    expect(restored.c).toEqual({ ...INITIAL.c, minContrast: 3 });
  });

  it('refuses a value that is not a state, so loading keeps it aside', () => {
    expect(() => liveOf('{not json')).toThrow();
    expect(() => liveOf(42)).toThrow();
  });

  it('keeps only the anchors the generator can read', () => {
    const good = { name: 'red', hue: 25, lightness: 0.6 };
    const muted = { name: 'tan', hue: 70, lightness: 0.7, chroma: 0.05 };
    const anchors = [good, null, 'red', { name: 'x' }, { name: 'y', hue: '25', lightness: 0.5 }, { name: 'z', hue: 25, lightness: null }, { ...muted, chroma: 'lots' }, muted];
    expect(liveOf({ c: {}, anchors }).anchors).toEqual([good, muted]);
  });

  it('defaults an unknown surface rather than passing it through', () => {
    expect(liveOf({ c: {}, surfaceKey: 'chartreuse', anchors: [] }).surfaceKey).toBe('dark');
  });
});

describe('saved presets', () => {
  it('round-trips a saved one', () => {
    expect(savedOf(stored(storedPresets([{ name: 'mine', state: INITIAL }]))).map((p) => p.name)).toEqual(['mine']);
  });

  it('does not store built-ins, which the app already ships', () => {
    const kept = storedPresets([
      { name: 'Default', state: INITIAL, builtin: true },
      { name: 'mine', state: INITIAL },
    ]);
    expect(kept.map((p) => p.name)).toEqual(['mine']);
  });

  it('fills a constraint that did not exist when the preset was saved', () => {
    const [restored] = savedOf([{ name: 'old', state: { c: { count: 12 }, surfaceKey: 'light' } }]);
    expect(restored?.state.c.count).toBe(12);
    expect(restored?.state.c.minDistance).toBe(INITIAL.c.minDistance);
    expect(restored?.state.surfaceKey).toBe('light');
    expect(restored?.state.anchors).toEqual([]);
  });

  it('drops entries that are not presets', () => {
    expect(savedOf([{ nope: 1 }, 'x', null])).toEqual([]);
  });
});

describe('the stored presets and live state', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('are none when nothing was stored', () => {
    expect(loadLive()).toBeNull();
    expect(loadSaved()).toEqual([]);
  });

  it('keeps saved presets it cannot read aside, so the next save cannot cost them', async () => {
    const key = 'weasel.theme-editor.presets';
    localStorage.setItem(key, '[{"name":');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadSaved()).toEqual([]);
    expect(await persist([{ name: 'mine', state: INITIAL }])).toBe(true);
    expect(JSON.parse(localStorage.getItem(`${key}:unreadable`)!)).toBe('[{"name":');
    expect(loadSaved().map((p) => p.name)).toEqual(['mine']);
  });

  it('keeps a live state it cannot read aside, so the next save cannot cost it', async () => {
    const key = 'weasel.theme-editor.live';
    localStorage.setItem(key, '{"c":');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadLive()).toBeNull();
    expect(await persistLive(INITIAL)).toBe(true);
    expect(JSON.parse(localStorage.getItem(`${key}:unreadable`)!)).toBe('{"c":');
    expect(loadLive()).toEqual(INITIAL);
  });
});

describe('the live history', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is kept off the live state key, so saving the state never reads the history', async () => {
    const items = new Map<string, string>();
    const getItem = vi.fn((k: string) => items.get(k) ?? null);
    vi.stubGlobal('localStorage', {
      get length() {
        return items.size;
      },
      key: (i: number) => [...items.keys()][i] ?? null,
      getItem,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    });
    liveHistory.save({ state: INITIAL, history: { version: 1, undoStack: [], redoStack: [] } as never });
    const historyKeys = [...items.keys()];
    expect(historyKeys).toHaveLength(1);
    getItem.mockClear();
    await persistLive(INITIAL);
    expect(getItem.mock.calls.map(([k]) => k)).not.toContain(historyKeys[0]);
  });

  it('moves a history kept under the live state key out from under it', () => {
    const saved = { state: INITIAL, history: { version: 1, undoStack: [], redoStack: [] } };
    localStorage.setItem('weasel.theme-editor.live.history', JSON.stringify(saved));
    expect(liveHistory.load()).toEqual(saved);
    expect(localStorage.getItem('weasel.theme-editor.live.history')).toBeNull();
    localStorage.clear();
  });
});

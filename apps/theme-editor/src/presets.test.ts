import { describe, expect, it } from 'vitest';
import { INITIAL, parseLive, parseSaved, serializeSaved } from './presets';

/**
 * These exercise the parsing, not the browser. This project's jsdom provides
 * `window` but no `localStorage`, so a test that reached for storage would be
 * asserting a stub of mine rather than anything the app relies on. The thin
 * wrappers around `getItem`/`setItem` are covered in the browser instead.
 */
describe('restoring the live state', () => {
  it('round-trips what was on screen', () => {
    const state = { ...INITIAL, c: { ...INITIAL.c, count: 14 }, surfaceKey: 'light' as const };
    expect(parseLive(JSON.stringify(state))).toEqual(state);
  });

  it('is null when nothing was stored', () => {
    expect(parseLive(null)).toBeNull();
    expect(parseLive('')).toBeNull();
  });

  it('fills a constraint that did not exist when the state was written', () => {
    // The failure this guards: a missing field reaches the generator as
    // undefined and every measurement comes back NaN.
    const restored = parseLive(JSON.stringify({ c: { count: 12 }, surfaceKey: 'dark', anchors: [] }));
    expect(restored?.c.count).toBe(12);
    expect(restored?.c.minDistance).toBe(INITIAL.c.minDistance);
    expect(Number.isFinite(restored?.c.hueFloor)).toBe(true);
  });

  it('ignores a corrupt store rather than failing to start', () => {
    expect(parseLive('{not json')).toBeNull();
    expect(parseLive('42')).toBeNull();
  });

  it('defaults an unknown surface rather than passing it through', () => {
    const restored = parseLive(JSON.stringify({ c: {}, surfaceKey: 'chartreuse', anchors: [] }));
    expect(restored?.surfaceKey).toBe('dark');
  });
});

describe('saved presets', () => {
  it('round-trips a saved one', () => {
    const raw = serializeSaved([{ name: 'mine', state: INITIAL }]);
    expect(parseSaved(raw).map((p) => p.name)).toEqual(['mine']);
  });

  it('does not store built-ins, which the app already ships', () => {
    const raw = serializeSaved([
      { name: 'Default', state: INITIAL, builtin: true },
      { name: 'mine', state: INITIAL },
    ]);
    expect(parseSaved(raw).map((p) => p.name)).toEqual(['mine']);
  });

  it('drops entries that are not presets', () => {
    expect(parseSaved(JSON.stringify([{ nope: 1 }, 'x', null]))).toEqual([]);
  });
});

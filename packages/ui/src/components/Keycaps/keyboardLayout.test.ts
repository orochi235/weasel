import { describe, expect, it } from 'vitest';
import { KEYBOARD_LAYOUTS, placeKeys, type KeyboardLayout } from './keyboardLayout';

const keyAt = (layout: KeyboardLayout, code: string, only?: ReadonlySet<string>) =>
  placeKeys(layout, only).banks.flatMap((b) => b.keys).find((k) => k.code === code);

describe('the ANSI layouts', () => {
  it.each(Object.entries(KEYBOARD_LAYOUTS))('%s fills every main-block row to 15 units', (_name, layout) => {
    const main = placeKeys(layout).banks.find((b) => b.id === 'main')!;
    const ends = new Map<number, number>();
    for (const k of main.keys) ends.set(k.y, Math.max(ends.get(k.y) ?? 0, k.x + k.width));
    expect([...ends.values()]).toEqual([15, 15, 15, 15, 15]);
  });

  it('lines the navigation cluster up with the number row', () => {
    const layout = KEYBOARD_LAYOUTS.windows;
    expect(keyAt(layout, 'Insert')!.y).toBe(keyAt(layout, 'Digit1')!.y);
    expect(keyAt(layout, 'ArrowDown')!.y).toBe(keyAt(layout, 'Space')!.y);
    expect(keyAt(layout, 'ArrowUp')!.x).toBe(keyAt(layout, 'ArrowDown')!.x);
  });

  it('measures the whole keyboard', () => {
    const { width, height } = placeKeys(KEYBOARD_LAYOUTS.linux);
    expect(width).toBe(18.5);
    expect(height).toBe(6.25);
  });
});

describe('placeKeys with a set of keys', () => {
  it('keeps only those keys, drops empty banks, and moves the rest to the corner', () => {
    const only = new Set(['KeyQ', 'KeyW', 'KeyA', 'ArrowUp']);
    const placement = placeKeys(KEYBOARD_LAYOUTS.macos, only);
    expect(placement.banks.map((b) => b.id)).toEqual(['main', 'arrows']);
    expect(keyAt(KEYBOARD_LAYOUTS.macos, 'KeyQ', only)).toMatchObject({ x: 0, y: 0 });
    expect(keyAt(KEYBOARD_LAYOUTS.macos, 'KeyA', only)).toMatchObject({ x: 0.25, y: 1 });
    expect(placement.height).toBe(3);
  });

  it('places nothing when no key matches', () => {
    expect(placeKeys(KEYBOARD_LAYOUTS.macos, new Set(['Nope']))).toEqual({ banks: [], width: 0, height: 0 });
  });
});

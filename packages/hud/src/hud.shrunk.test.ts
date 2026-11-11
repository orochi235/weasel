/** Counterexamples `hud.pbt.test.ts` shrank to, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { createHud } from './hud';
import type { Widget } from './widget';

describe('createHud counterexamples', () => {
  it('holds a widget added twice once, where it was', () => {
    const w = (id: string): Widget => ({
      id, bounds: { x: 0, y: 0, w: 1, h: 1 }, hidden: false, draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    });
    const hud = createHud();
    const a = w('a'), b = w('b');
    hud.add(a);
    hud.add(b);
    hud.add(a);
    expect(hud.widgets()).toEqual([a, b]);
    hud.remove(a);
    expect(hud.widgets()).toEqual([b]);
  });
});

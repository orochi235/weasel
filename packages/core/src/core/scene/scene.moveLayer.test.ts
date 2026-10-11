import { describe, it, expect } from 'vitest';
import { createScene } from './scene';

type Layer = 'a' | 'b' | 'c' | 'd';

function makeScene(coalesceWindowMs: number) {
  const scene = createScene<object, Layer>({
    systemLayers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    coalesceWindowMs,
  });
  const order = () => scene.layers.map((l) => l.id).join('');
  return { scene, order };
}

describe('Scene — moveLayer under undo and redo', () => {
  it('two moves of one layer inside the coalesce window undo to the starting order', () => {
    const { scene, order } = makeScene(60_000);
    scene.moveLayer('a', 2);
    scene.moveLayer('a', 1);
    expect(order()).toBe('bacd');
    expect(scene.history.undoDepth()).toBe(1);

    scene.undo();
    expect(order()).toBe('abcd');
    scene.redo();
    expect(order()).toBe('bacd');
    scene.undo();
    expect(order()).toBe('abcd');
  });

  it.each([0, 60_000])('round-trips a run of moves with a %ims coalesce window', (windowMs) => {
    const { scene, order } = makeScene(windowMs);
    const moves: [Layer, number][] = [['a', 3], ['a', 1], ['c', 0], ['c', 3], ['c', 2], ['b', 3], ['a', 0]];
    const seen = [order()];
    const depths = [0];
    for (const [layer, index] of moves) {
      scene.moveLayer(layer, index);
      seen[scene.history.undoDepth()] = order();
      depths.push(scene.history.undoDepth());
    }
    const top = scene.history.undoDepth();

    for (let depth = top - 1; depth >= 0; depth--) {
      scene.undo();
      expect(order()).toBe(seen[depth]);
    }
    for (let depth = 1; depth <= top; depth++) {
      scene.redo();
      expect(order()).toBe(seen[depth]);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { renderOrderCompare } from './renderRank';

const box = { x: 0, y: 0, width: 1, height: 1 };

describe('renderOrderCompare', () => {
  it('orders ids as the scene paints them, and follows a structural edit', () => {
    const scene = createScene<Record<string, never>, 'default', typeof box>({ systemLayers: [{ id: 'default' }] });
    for (const id of ['a', 'g', 'b']) scene.add({ id: asNodeId(id), kind: id === 'g' ? 'group' : 'mark', layer: 'default', pose: box, data: {} });
    scene.add({ id: asNodeId('c'), kind: 'mark', layer: 'default', parent: asNodeId('g'), pose: box, data: {} });
    const compare = renderOrderCompare(scene);
    expect(['b', 'c', 'a'].sort(compare)).toEqual(['a', 'c', 'b']);
    expect(compare('missing', 'a')).toBeLessThan(0);
    scene.remove(asNodeId('a'));
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: box, data: {} });
    expect(['b', 'c', 'a'].sort(compare)).toEqual(['c', 'b', 'a']);
  });

  it('reads the render order once per structural edit, not once per comparison', () => {
    const scene = createScene<Record<string, never>, 'default', typeof box>({ systemLayers: [{ id: 'default' }] });
    for (const id of ['a', 'b', 'c']) scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: box, data: {} });
    // Ranking walks the order once, reading its length each step; a scan per comparison reads it far more.
    let walks = 0;
    const order = new Proxy(scene.renderOrderNodes(), {
      get: (t, k) => { if (k === 'length') walks++; return Reflect.get(t, k); },
    });
    const compare = renderOrderCompare({ renderOrderNodes: () => order });
    ['c', 'b', 'a', 'c', 'b'].sort(compare);
    expect(walks).toBeLessThanOrEqual(4);
  });
});

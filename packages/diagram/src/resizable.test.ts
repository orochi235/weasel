import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { edgeLabelSpec } from './edgeLabel';
import { diagramResizable } from './resizable';

interface Rect { x: number; y: number; width: number; height: number }

describe('diagramResizable', () => {
  it('refuses edges and edge labels, and allows the shapes they join', () => {
    const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
    for (const [id, x] of [['a', 0], ['b', 300]] as const) {
      scene.add({ id: id as never, kind: 'leaf', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
    }
    scene.add({
      id: 'e' as never, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router: 'straight' } },
      dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH as never,
    });
    scene.add(edgeLabelSpec('e', 'yes', { layer: 'main' }) as never);
    const resizable = diagramResizable(scene);
    expect(['a', 'b', 'e', 'e/label'].map(resizable)).toEqual([true, true, false, false]);
  });
});

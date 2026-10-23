import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from './edge';
import { edgeLabelSpec } from './edgeLabel';
import { diagramScene } from './fromData';
import { diagramResizable } from './resizable';

interface Rect { x: number; y: number; width: number; height: number }

describe('diagramResizable', () => {
  it('refuses edges and edge labels, and allows the shapes they join', () => {
    const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
    for (const [id, x] of [['a', 0], ['b', 300]] as const) {
      scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } });
    }
    scene.add({
      id: 'e' as never, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { diagram: { from: {}, to: {}, router: 'straight' } },
      dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH as never,
    });
    scene.add(edgeLabelSpec('e', 'yes', { layer: 'main' }) as never);
    const resizable = diagramResizable(scene);
    expect(['a', 'b', 'e', 'e/label'].map(resizable)).toEqual([true, true, false, false]);
  });

  it('refuses a lane, which its boundaries resize, and allows its pool', () => {
    const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
    const at = { x: 0, y: 0, width: 100, height: 40 };
    scene.add({ id: 'p' as never, kind: 'group', layer: 'main', pose: at, data: { diagram: { container: { role: 'pool' } } } });
    scene.add({ id: 'l' as never, kind: 'group', layer: 'main', pose: at, parent: 'p' as never, data: { diagram: { container: { role: 'lane' } } } });
    expect(['p', 'l'].map(diagramResizable(scene))).toEqual([true, false]);
  });

  it("refuses a group's box, which takes its size from its members", () => {
    const specs = diagramScene({ nodes: [{ id: 'a', lines: ['a'] }], edges: [], groups: [{ id: 'g', members: ['a'] }] });
    const scene = createScene<unknown, 'main', Rect>({ systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry() });
    expect(['a', 'g'].map(diagramResizable(scene))).toEqual([true, false]);
  });
});

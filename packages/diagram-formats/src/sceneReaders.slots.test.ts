import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { DIAGRAM_THEMES, diagramScene, withDiagramRegistry, type DataNode } from '@weasel-js/diagram';
import { readShape, type ReadNode } from './sceneReaders';

const MEASURE = (text: string) => ({ width: text.length * 7, height: 16 });

function readBack(node: DataNode): DataNode {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
    initial: diagramScene({ nodes: [node], edges: [] }, { layout: 'none', measure: MEASURE }) as never,
  });
  return readShape(scene as never, scene.get(node.id as never) as unknown as ReadNode, { x: 0, y: 0 }, DIAGRAM_THEMES.night!);
}

describe('readShape on a body with slot rows', () => {
  it('reads each slot back in its place, with its height, image, id and width', () => {
    const rows: DataNode['rows'] = [
      { kind: 'label', text: 'A' },
      { kind: 'slot', height: 40, image: { src: 'x.png', opacity: 0.5 } },
      { kind: 'label', text: 'B' },
      { kind: 'slot', height: 30, width: 20, id: 'frame' },
    ];
    expect(readBack({ id: 'n', at: { x: 0, y: 0 }, width: 120, rows }).rows).toEqual(rows);
  });
});

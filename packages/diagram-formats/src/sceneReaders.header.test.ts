import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { DIAGRAM_THEMES, diagramScene, withDiagramRegistry, type DataNode } from '@weasel-js/diagram';
import { readShape, type ReadNode } from './sceneReaders';

const NODE: DataNode = {
  id: 'n', at: { x: 0, y: 0 },
  rows: [{ kind: 'header', text: 'Title', aside: 'v2', pad: 2 }, { kind: 'label', text: 'one' }],
};

describe('readShape on a body with a header', () => {
  it('reads the header back as a header, with its aside and its pad, and not as a label row', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: diagramScene({ nodes: [NODE], edges: [] }, { layout: 'none' }) as never,
    });
    const node = readShape(scene as never, scene.get('n' as never) as unknown as ReadNode, { x: 0, y: 0 }, DIAGRAM_THEMES.blueprint!);
    expect(node.rows).toEqual(NODE.rows);
  });
});

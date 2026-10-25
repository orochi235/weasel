import { createScene, createTransformOp, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { DIVIDER_HEIGHT } from './body';
import { bodyFollower } from './bodyFollower';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData } from './fromData';

type Box = { x: number; y: number; width: number; height: number };

const DATA: DiagramData = {
  nodes: [{
    id: 'c', at: { x: 0, y: 0 }, width: 120, padding: 8, gap: 4,
    rows: [{ kind: 'label', text: 'Name' }, { kind: 'divider' }, { kind: 'label', text: 'x' }],
  }],
  edges: [],
};

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(DATA) as never, registry: withDiagramRegistry(),
  });
  const box = (id: string) => scene.get(id as never)!.pose as Box;
  const [name, x] = scene.childrenOf('c' as never).map(String);
  return { scene, box, name: name!, x: x! };
}

describe('bodyFollower', () => {
  it('stacks a resized body\'s rows again at its new size, in the same batch', () => {
    const { scene, box, name, x } = setup();
    const from = box('c');
    const to = { ...from, width: from.width + 60, height: from.height + 40 };
    const ops = bodyFollower(scene).finish([createTransformOp({ id: 'c', from, to })], 'Resize');
    scene.applyBatch(ops!, 'Resize', scene);
    expect(box(name)).toMatchObject({ x: 8, width: to.width - 16, y: 8 + 20 });
    expect(box(x).y).toBe(8 + 20 + 17 + 4 + DIVIDER_HEIGHT + 4);
  });

  it('previews the rows where the frame\'s size puts them', () => {
    const { scene, box, name } = setup();
    const from = box('c');
    const frame = new Map([['c', { ...from, height: from.height + 40 }]]);
    const preview = bodyFollower(scene).preview(frame, new Map());
    expect(preview.find((p) => p.id === name)!.pose).toMatchObject({ y: 8 + 20 });
  });

  it('leaves a body that only moved to the move', () => {
    const { scene, box } = setup();
    const from = box('c');
    const op = createTransformOp({ id: 'c', from, to: { ...from, x: 50 } });
    expect(bodyFollower(scene).finish([op], 'Move')).toEqual([op]);
  });
});

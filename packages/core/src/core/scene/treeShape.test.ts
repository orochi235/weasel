import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { hasChildren, isLeaf } from './treeShape';
import type { RectPose } from './types';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const LAYERS = [{ id: 'main' as const }];

describe('treeShape', () => {
  it('reads a node with no children, or an empty list, as a leaf', () => {
    expect(isLeaf({})).toBe(true);
    expect(isLeaf({ children: [] })).toBe(true);
    expect(isLeaf({ children: ['a'] as never })).toBe(false);
  });

  it('narrows a node holding children', () => {
    expect(hasChildren({ children: ['a'] as never })).toBe(true);
    expect(hasChildren({ children: [] })).toBe(false);
    expect(hasChildren({})).toBe(false);
  });

  it('lets a mark take a child', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const m = scene.add({ kind: 'mark', id: 'm' as never, layer: 'main', pose: POSE, data: {} });
    const c = scene.add({ kind: 'mark', id: 'c' as never, layer: 'main', pose: POSE, data: {}, parent: m });
    expect(scene.childrenOf(m)).toEqual([c]);
  });
});

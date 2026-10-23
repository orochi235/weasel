import { describe, expect, it } from 'vitest';
import { translate, type Affine, type Path } from '@weasel-js/geom';
import { svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { serializeSvg } from './serialize';
import type { SvgGroupNode } from './types';

const square: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const pose = { x: 0, y: 0, width: 10, height: 10 };

function treeWith(copies: readonly Affine[], clip?: Path): SvgKitTree {
  const nodes: Record<string, SvgKitTreeNode> = {
    g: { kind: 'group', data: clip ? { path: clip } : {}, pose, copiesFromPose: () => copies },
    a: { kind: 'path', data: { path: square }, pose },
  };
  return { roots: ['g'], childrenOf: (id) => (id === 'g' ? ['a'] : []), get: (id) => nodes[id] };
}

describe('svgNodesFromKit: a container drawing copies', () => {
  it('writes each copy as a transformed group after the original', () => {
    const shift = translate(40, 0);
    const [g] = svgNodesFromKit(treeWith([shift])) as SvgGroupNode[];
    expect(g.children).toHaveLength(2);
    const [original, copy] = g.children as SvgGroupNode[];
    expect(original.kind).toBe('group');
    expect(original.transform).toBeUndefined();
    expect(copy.transform).toEqual(shift);
    expect(copy.children).toHaveLength(1);
    expect(serializeSvg([g])).toMatch(/<g transform="[^"]*40/);
  });

  it('clips the content inside each copy, so the clip travels with it', () => {
    const clip: Path = { kind: 'rect', x: 0, y: 0, width: 5, height: 5 };
    const [g] = svgNodesFromKit(treeWith([translate(40, 0)], clip)) as SvgGroupNode[];
    expect(g.clip).toBeUndefined();
    const [original, copy] = g.children as SvgGroupNode[];
    expect(original.clip).toBeDefined();
    expect((copy.children[0] as SvgGroupNode).clip).toBeDefined();
  });

  it('writes a plain group when the container draws no copies', () => {
    const [g] = svgNodesFromKit(treeWith([])) as SvgGroupNode[];
    expect(g.children.map((c) => c.kind)).toEqual(['path']);
  });
});

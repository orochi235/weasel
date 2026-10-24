import { describe, expect, it } from 'vitest';
import { clipOutline } from '@weasel-js/core';
import { translate, type Path } from '@weasel-js/geom';
import { svgLeafFromKit, svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { serializeSvg } from './serialize';
import type { SvgGroupNode, SvgNode } from './types';

const BOX = { x: 0, y: 0, width: 10, height: 10 };
const square: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const RED = { paint: { kind: 'solid' as const, color: '#ff0000' } };

function tree(nodes: Record<string, SvgKitTreeNode>, kids: Record<string, string[]>, roots = ['p']): SvgKitTree {
  return { roots, childrenOf: (id) => kids[id] ?? [], get: (id) => nodes[id] };
}

const box = (extra: Partial<SvgKitTreeNode> = {}): SvgKitTreeNode => (
  { kind: 'mark', data: { path: square, fill: RED }, pose: BOX, ...extra }
);
const kid: SvgKitTreeNode = { kind: 'mark', data: { text: 'row' }, pose: { x: 2, y: 2, width: 6, height: 4 } };

describe('svgNodesFromKit: a mark with children', () => {
  it('writes a <g> holding its own shape, then its children', () => {
    const [g] = svgNodesFromKit(tree({ p: box(), k: kid }, { p: ['k'] })) as SvgGroupNode[];
    expect(g.kind).toBe('group');
    expect(g.children.map((c) => c.kind)).toEqual(['path', 'text']);
    expect(serializeSvg([g])).toMatch(/<g[^>]*><path d="M0 0h10v10h-10Z"[^>]*\/><text/);
  });

  it('writes a mark with no children as its own element', () => {
    const [n] = svgNodesFromKit(tree({ p: box() }, {}));
    expect(n!.kind).toBe('path');
  });

  it('hands its own paint to a child that inherits it', () => {
    const child: SvgKitTreeNode = { kind: 'mark', data: { path: square, fill: 'inherit' }, pose: BOX };
    const [g] = svgNodesFromKit(tree({ p: box(), k: child }, { p: ['k'] })) as SvgGroupNode[];
    expect(serializeSvg([g])).not.toMatch(/<path[^>]*fill="none"/);
    expect((g.children[1] as SvgNode & { inherits?: unknown }).inherits).toEqual({ fill: true });
    expect(g.fill).toBeDefined();
  });

  it('clips its children, and only them, when it declares a clip', () => {
    const [g] = svgNodesFromKit(tree({ p: box({ clip: 'outline' }), k: kid }, { p: ['k'] })) as SvgGroupNode[];
    expect(g.clip).toBeUndefined();
    const [self, inner] = g.children as [SvgNode, SvgGroupNode];
    expect(self.kind).toBe('path');
    expect(inner.clip).toBeDefined();
    expect(inner.children.map((c) => c.kind)).toEqual(['text']);
  });

  it.each(['mark', 'group'] as const)('clips the children of a %s to the outline the canvas clips them to', (kind) => {
    const node: SvgKitTreeNode = { kind, data: { shape: 'ellipse' }, pose: BOX, clip: 'outline' };
    const out = svgNodesFromKit(tree({ p: node, k: kid }, { p: ['k'] })) as SvgGroupNode[];
    const clipped = kind === 'group' ? out[0]! : out[0]!.children.at(-1) as SvgGroupNode;
    expect(clipped.clip).toEqual(clipOutline(node as never, BOX));
    expect(clipped.clip?.kind).not.toBe('rect');
  });

  it('clips the children of a mark only the rect fallback claims to its box, as the canvas does', () => {
    const node: SvgKitTreeNode = { kind: 'mark', data: {}, pose: BOX, clip: 'outline' };
    const [g] = svgNodesFromKit(tree({ p: node, k: kid }, { p: ['k'] }), {
      leaf: (id, n) => (id === 'p' ? { kind: 'path', path: square, fill: { kind: 'none' } } : svgLeafFromKit(n.data as never, n.pose)),
    }) as SvgGroupNode[];
    expect((g.children.at(-1) as SvgGroupNode).clip).toEqual({ kind: 'rect', x: 0, y: 0, width: 10, height: 10 });
  });

  it('copies its children, not itself', () => {
    const [g] = svgNodesFromKit(tree({ p: box({ copiesFromPose: () => [translate(20, 0)] }), k: kid }, { p: ['k'] })) as SvgGroupNode[];
    expect(g.children.filter((c) => c.kind === 'path')).toHaveLength(1);
    expect(serializeSvg([g]).match(/<text/g)).toHaveLength(2);
  });
});

describe('svgNodesFromKit: a group', () => {
  it('writes a <g> with no shape of its own, whatever its data', () => {
    const group: SvgKitTreeNode = { kind: 'group', data: { path: square, fill: RED }, pose: BOX };
    const [g] = svgNodesFromKit(tree({ p: group, k: kid }, { p: ['k'] })) as SvgGroupNode[];
    expect(g.kind).toBe('group');
    expect(g.children.map((c) => c.kind)).toEqual(['text']);
  });
});

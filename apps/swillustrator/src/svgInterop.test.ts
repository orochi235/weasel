/**
 * Direct tests on the Obj ↔ SvgNode bridge. The baseline pins current
 * behavior so later tasks (groups, text style, namespace metadata) show
 * up as intentional edits to these expectations.
 */

import { describe, it, expect } from 'vitest';
import type { SvgNode, SvgPathNode, SvgTextNode, SvgGroupNode } from '@orochi235/weasel-svg';
import { objToSvgNode, svgNodesToObjs, svgNodesToObjsWithGroups, objsToSvgNodes } from './svgInterop';

// Minimal local mirror of svgInterop's internal Obj union. Keep in sync
// with the file under test; baseline tests don't need every field, just
// the structurally-required ones the bridge reads.
interface RectObjT { id: string; kind: 'rect'; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number }
interface TextObjT { id: string; kind: 'text'; x: number; y: number; width: number; height: number; text: string }
interface PathObjT {
  id: string; kind: 'path'; x: number; y: number; width: number; height: number;
  path: { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' };
  closed: boolean; fill: string; stroke: string; strokeWidth: number;
}

function ids(): () => string {
  let n = 0;
  return () => `i${n++}`;
}

describe('objToSvgNode', () => {
  it('lowers a RectObj to an SvgPathNode with a RectPath and solid fill', () => {
    const rect: RectObjT = {
      id: 'r1', kind: 'rect',
      x: 10, y: 20, width: 30, height: 40,
      fill: '#ff0000', stroke: '#000000', strokeWidth: 2,
    };
    const node = objToSvgNode(rect as never) as SvgPathNode;
    expect(node.kind).toBe('path');
    expect(node.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 30, height: 40 });
    expect(node.fill).toEqual({ kind: 'solid', color: '#ff0000' });
    expect(node.stroke).toEqual({ paint: { kind: 'solid', color: '#000000' }, width: 2 });
  });

  it('skips stroke emission when strokeWidth is 0', () => {
    const rect: RectObjT = {
      id: 'r2', kind: 'rect',
      x: 0, y: 0, width: 10, height: 10,
      fill: '#abcdef', stroke: '#000000', strokeWidth: 0,
    };
    const node = objToSvgNode(rect as never) as SvgPathNode;
    expect(node.stroke).toBeUndefined();
  });

  it('lowers a TextObj to an SvgTextNode preserving geometry and text', () => {
    const text: TextObjT = {
      id: 't1', kind: 'text',
      x: 5, y: 6, width: 100, height: 20,
      text: 'hello',
    };
    const node = objToSvgNode(text as never) as SvgTextNode;
    expect(node.kind).toBe('text');
    expect(node).toMatchObject({ x: 5, y: 6, width: 100, height: 20, text: 'hello' });
  });

  it('emits fill=none on an open PathObj', () => {
    const path: PathObjT = {
      id: 'p1', kind: 'path',
      x: 0, y: 0, width: 50, height: 50,
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1]), coords: new Float32Array([0, 0, 50, 0, 50, 50]), fillRule: 'nonzero' },
      closed: false,
      fill: '#ff0000', stroke: '#000000', strokeWidth: 1,
    };
    const node = objToSvgNode(path as never) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'none' });
  });

  it('emits a solid fill on a closed PathObj', () => {
    const path: PathObjT = {
      id: 'p2', kind: 'path',
      x: 0, y: 0, width: 50, height: 50,
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 4]), coords: new Float32Array([0, 0, 50, 0, 50, 50]), fillRule: 'nonzero' },
      closed: true,
      fill: '#00ff00', stroke: '#000000', strokeWidth: 1,
    };
    const node = objToSvgNode(path as never) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });
});

describe('svgNodesToObjs (baseline — pre-namespace, pre-groups-preservation)', () => {
  it('lowers an SvgPathNode (rect) to a RectObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 1, y: 2, width: 3, height: 4 },
      fill: { kind: 'solid', color: '#aabbcc' },
      stroke: { paint: { kind: 'solid', color: '#112233' }, width: 1.5 },
    };
    const out = svgNodesToObjs([node], ids());
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: 'rect', x: 1, y: 2, width: 3, height: 4,
      fill: '#aabbcc', stroke: '#112233', strokeWidth: 1.5,
    });
  });

  it('lowers an SvgTextNode to a TextObj', () => {
    const node: SvgTextNode = {
      kind: 'text',
      x: 10, y: 11, width: 200, height: 30,
      text: 'hi',
    };
    const out = svgNodesToObjs([node], ids());
    expect(out[0]).toMatchObject({ kind: 'text', x: 10, y: 11, text: 'hi' });
  });

  it('downgrades a gradient fill to black solid (lossy edge)', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      // Gradient paint shape is opaque to the bridge; cast covers it.
      fill: { kind: 'gradient', paint: { fill: 'linear', stops: [] } as never },
    };
    const out = svgNodesToObjs([node as SvgNode], ids());
    expect((out[0] as RectObjT).fill).toBe('#000000');
  });

  it('treats SvgPathNode without stroke as strokeWidth=0', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abcdef' },
    };
    const out = svgNodesToObjs([node], ids());
    expect((out[0] as RectObjT).strokeWidth).toBe(0);
    expect((out[0] as RectObjT).stroke).toBe('#000000');
  });
});

describe('svgNodesToObjsWithGroups — groups preserved', () => {
  it('returns a Group record for each SvgGroupNode and inlines members', () => {
    const child: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#000000' },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'g1' } } },
      children: [child],
    };
    const result = svgNodesToObjsWithGroups([g], ids());
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('rect');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toBe('g1');
    expect(result.groups[0].members).toEqual([result.items[0].id]);
  });

  it('handles nested groups by including child group ids in the parent member list', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const inner: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'inner' } } },
      children: [leaf],
    };
    const outer: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'outer' } } },
      children: [inner],
    };
    const result = svgNodesToObjsWithGroups([outer], ids());
    expect(result.items).toHaveLength(1);
    expect(result.groups.map((g) => g.id).sort()).toEqual(['inner', 'outer']);
    const innerGroup = result.groups.find((g) => g.id === 'inner');
    const outerGroup = result.groups.find((g) => g.id === 'outer');
    expect(innerGroup!.members).toEqual([result.items[0].id]);
    expect(outerGroup!.members).toEqual(['inner']);
  });

  it('groups without swill:group-id synthesize an id from the nextId fn', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#fff' },
    };
    const g: SvgGroupNode = { kind: 'group', children: [leaf] };
    const result = svgNodesToObjsWithGroups([g], ids());
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].id).toMatch(/^i\d+$/);
    expect(result.groups[0].members).toEqual([result.items[0].id]);
  });
});

describe('objsToSvgNodes — groups emitted', () => {
  it('builds an SvgGroupNode wrapping the members of a Group', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
      { id: 'b', kind: 'rect' as const, x: 20, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [{ id: 'g1', members: ['a', 'b'] }];
    const nodes = objsToSvgNodes(items as never, groups);
    expect(nodes).toHaveLength(1);
    const n0 = nodes[0];
    expect(n0.kind).toBe('group');
    if (n0.kind !== 'group') throw new Error('expected group');
    expect(n0.meta?.swill?.attrs?.['group-id']).toBe('g1');
    expect(n0.children).toHaveLength(2);
  });

  it('emits items not in any group at the document root', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
      { id: 'b', kind: 'rect' as const, x: 20, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [{ id: 'g1', members: ['a'] }];
    const nodes = objsToSvgNodes(items as never, groups);
    // One group (wrapping 'a') + one root-level path ('b').
    expect(nodes).toHaveLength(2);
    expect(nodes[0].kind).toBe('group');
    expect(nodes[1].kind).toBe('path');
  });

  it('nests SvgGroupNodes for nested Groups', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    const groups = [
      { id: 'inner', members: ['a'] },
      { id: 'outer', members: ['inner'] },
    ];
    const nodes = objsToSvgNodes(items as never, groups);
    expect(nodes).toHaveLength(1);
    const outer = nodes[0];
    if (outer.kind !== 'group') throw new Error('expected outer group');
    expect(outer.meta?.swill?.attrs?.['group-id']).toBe('outer');
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0];
    if (inner.kind !== 'group') throw new Error('expected inner group');
    expect(inner.meta?.swill?.attrs?.['group-id']).toBe('inner');
  });

  it('rejects multi-group membership at the persistence boundary', () => {
    const items = [
      { id: 'a', kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10, fill: '#fff', stroke: '#000', strokeWidth: 0 },
    ];
    // 'a' is claimed by two groups — this violates the single-membership invariant.
    const groups = [
      { id: 'g1', members: ['a'] },
      { id: 'g2', members: ['a'] },
    ];
    expect(() => objsToSvgNodes(items as never, groups)).toThrow(/multi-group membership/i);
  });
});

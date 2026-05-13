/**
 * Direct tests on the Obj ↔ SvgNode bridge. The baseline pins current
 * behavior so later tasks (groups, text style, namespace metadata) show
 * up as intentional edits to these expectations.
 */

import { describe, it, expect } from 'vitest';
import type { SvgNode, SvgPathNode, SvgTextNode, SvgGroupNode } from '@orochi235/weasel-svg';
import { parseSvg, serializeSvg } from '@orochi235/weasel-svg';
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

});

describe('text style round-trip via the bridge', () => {
  it('emits and reads back every persisted TextStyle field including lineHeight', () => {
    const text = {
      id: 't1', kind: 'text' as const,
      x: 0, y: 0, width: 100, height: 20, text: 'Hi',
      style: {
        fontSize: 18,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontStyle: 'italic' as const,
        align: 'center' as const,
        lineHeight: 1.4,
        fill: { fill: 'solid' as const, color: '#b03030' },
      },
    };
    const node = objToSvgNode(text as never);
    expect(node.kind).toBe('text');
    if (node.kind !== 'text') throw new Error('expected text');
    // lineHeight rides in meta, not style.
    expect(node.style?.lineHeight).toBeUndefined();
    expect(node.meta?.swill?.attrs?.['line-height']).toBe('1.4');

    const back = svgNodesToObjs([node], ids());
    expect(back).toHaveLength(1);
    const t = back[0] as { kind: 'text'; style?: { lineHeight?: number } };
    expect(t.style?.lineHeight).toBe(1.4);
    expect(t.style).toEqual(text.style);
  });
});

describe('objsToSvgNodes — multi-group rejection', () => {
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

describe('svgNodesToObjs — coverage gaps', () => {
  it('lowers an SvgPathNode (PolygonPath, closed) to a closed PathObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      // M h v h Z — equivalent to a 50x50 box, but as a polygon
      path: {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1, 1, 4]),  // PATH_M, PATH_L*3, PATH_Z
        coords: new Float32Array([0, 0, 50, 0, 50, 50, 0, 50]),
        fillRule: 'nonzero',
      },
      fill: { kind: 'solid', color: '#7fb069' },
      stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 },
    };
    const out = svgNodesToObjs([node], ids());
    expect(out).toHaveLength(1);
    const o = out[0] as { kind: 'path'; closed: boolean; fill: string; strokeWidth: number };
    expect(o.kind).toBe('path');
    expect(o.closed).toBe(true);
    expect(o.fill).toBe('#7fb069');
    expect(o.strokeWidth).toBe(2);
  });

  it('lowers an SvgPathNode (PolygonPath, open) to an open PathObj', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: {
        kind: 'polygon',
        commands: new Uint8Array([0, 1, 1]),  // PATH_M, PATH_L, PATH_L, no Z
        coords: new Float32Array([0, 0, 50, 50, 100, 0]),
        fillRule: 'nonzero',
      },
      fill: { kind: 'none' },
      stroke: { paint: { kind: 'solid', color: '#000' }, width: 1 },
    };
    const out = svgNodesToObjs([node], ids());
    const o = out[0] as { kind: 'path'; closed: boolean; fill: string };
    expect(o.closed).toBe(false);
    // Open paths upcast their fill string to the bridge's fallback when
    // SvgPaint.kind === 'none'. Document the behavior; it's a known edge
    // not fixed in this plan.
    expect(o.fill).toBe('#000000');
  });

  it('returns an empty list for an empty input array', () => {
    const out = svgNodesToObjs([], ids());
    expect(out).toEqual([]);
  });

  it('handles a deeply nested mixed tree', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const innerText: SvgTextNode = { kind: 'text', x: 0, y: 0, width: 10, height: 10, text: 'x' };
    const inner: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'inner' } } },
      children: [leaf, innerText],
    };
    const outer: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'outer' } } },
      children: [inner],
    };
    const result = svgNodesToObjsWithGroups([outer], ids());
    expect(result.items).toHaveLength(2);  // leaf + text
    expect(result.groups.map((g) => g.id).sort()).toEqual(['inner', 'outer']);
    expect(result.groups.find((g) => g.id === 'outer')?.members).toEqual(['inner']);
    expect(result.groups.find((g) => g.id === 'inner')?.members).toHaveLength(2);
  });

  it('preserves text style across a group boundary', () => {
    const t: SvgTextNode = {
      kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'hi',
      style: { fontSize: 24, fill: { fill: 'solid', color: '#b03030' } },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { swill: { attrs: { 'group-id': 'g1' } } },
      children: [t],
    };
    const result = svgNodesToObjsWithGroups([g], ids());
    const item = result.items[0] as { kind: 'text'; style?: unknown };
    expect(item.style).toEqual(t.style);
  });
});

describe('objToSvgNode — coverage gaps', () => {
  it('passes the TextStyle through verbatim (no field stripping besides lineHeight)', () => {
    const text = {
      id: 'x', kind: 'text' as const,
      x: 0, y: 0, width: 100, height: 20, text: 'Hi',
      style: { fontSize: 12, align: 'right' as const },
    };
    const node = objToSvgNode(text as never);
    if (node.kind !== 'text') throw new Error('expected text');
    expect(node.style).toEqual({ fontSize: 12, align: 'right' });
    // No lineHeight in the input → no meta bag.
    expect(node.meta).toBeUndefined();
  });

  it('round-trips an open PathObj losslessly through both directions', () => {
    const original = {
      id: 'p', kind: 'path' as const,
      x: 0, y: 0, width: 100, height: 50,
      path: {
        kind: 'polygon' as const,
        commands: new Uint8Array([0, 1, 1]),
        coords: new Float32Array([0, 0, 50, 50, 100, 0]),
        fillRule: 'nonzero' as const,
      },
      closed: false, fill: '#aaa', stroke: '#000', strokeWidth: 2,
    };
    const node = objToSvgNode(original as never);
    expect(node.kind).toBe('path');
    const out = svgNodesToObjs([node], ids());
    const back = out[0] as { kind: 'path'; closed: boolean; strokeWidth: number };
    expect(back.kind).toBe('path');
    expect(back.closed).toBe(false);
    expect(back.strokeWidth).toBe(2);
  });
});

describe('rotation emit', () => {
  it('writes transform="rotate(...)" for a rotated rect', () => {
    const items = [{
      id: 'r', kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      fill: '#3366ff', stroke: '#000', strokeWidth: 0, rotation: Math.PI / 6,
    }];
    const nodes = objsToSvgNodes(items as never, []);
    const svg = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).toContain('transform="rotate(30 50 25)"');
  });

  it('writes transform="rotate(...)" for a rotated text', () => {
    const items = [{
      id: 't', kind: 'text' as const, x: 100, y: 50, width: 200, height: 40,
      text: 'Hi', rotation: Math.PI / 4,
    }];
    const nodes = objsToSvgNodes(items as never, []);
    const svg = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    expect(svg).toMatch(/transform="rotate\(45 200 70\)"/);
  });

  it('omits transform when rotation is 0 or undefined', () => {
    const items = [{
      id: 'r', kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      fill: '#3366ff', stroke: '#000', strokeWidth: 0,
    }];
    const nodes = objsToSvgNodes(items as never, []);
    const svg = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).not.toContain('transform=');
  });
});

describe('rotation parse', () => {
  it('round-trips a rotated rect through serialize → parse → svgNodesToObjsWithGroups', () => {
    const items = [{
      id: 'r', kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      fill: '#3366ff', stroke: '#000000', strokeWidth: 0, rotation: Math.PI / 6,
    }];
    const nodes = objsToSvgNodes(items as never, []);
    const svg = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    const parsed = parseSvg(svg);
    let next = 0;
    const out = svgNodesToObjsWithGroups(parsed.nodes, () => `id${next++}`);
    expect(out.items).toHaveLength(1);
    const r = out.items[0];
    expect(r.kind).toBe('rect');
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.width).toBeCloseTo(100, 5);
    expect(r.rotation).toBeCloseTo(Math.PI / 6, 5);
  });

  it('round-trips a rotated text object through serialize → parse → svgNodesToObjsWithGroups', () => {
    const items = [{
      id: 't', kind: 'text' as const, x: 100, y: 50, width: 200, height: 40,
      text: 'Hi', rotation: Math.PI / 4,
    }];
    const nodes = objsToSvgNodes(items as never, []);
    const svg = serializeSvg(nodes, { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    const parsed = parseSvg(svg);
    let next = 0;
    const out = svgNodesToObjsWithGroups(parsed.nodes, () => `id${next++}`);
    expect(out.items).toHaveLength(1);
    const t = out.items[0];
    expect(t.kind).toBe('text');
    expect(t.rotation).toBeCloseTo(Math.PI / 4, 5);
  });
});

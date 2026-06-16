/**
 * Direct tests on the Obj ↔ SvgNode bridge. The baseline pins current
 * behavior so later tasks (text style, namespace metadata) show up as
 * intentional edits to these expectations.
 *
 * SVG `<g>` maps to the scene's structural container tree, not the old
 * membership `Group` records: import emits parent-before-child scene
 * drafts (`svgNodesToSceneDrafts`); export walks the scene's container
 * tree (`sceneToSvgNodes`).
 */

import { describe, it, expect } from 'vitest';
import type { SvgNode, SvgPathNode, SvgTextNode, SvgGroupNode } from '@weasel-js/svg';
import { parseSvg, serializeSvg } from '@weasel-js/svg';
import {
  objToSvgNode,
  svgNodesToSceneDrafts,
  sceneToSvgNodes,
  type SceneDraft,
  type SceneSource,
} from './svgInterop';

// Minimal local mirror of svgInterop's internal Obj union. Keep in sync
// with the file under test; baseline tests don't need every field, just
// the structurally-required ones the bridge reads.
interface RectObjT {
  id: string; tool: 'rect'; x: number; y: number; width: number; height: number;
  path: { kind: 'rect'; x: number; y: number; width: number; height: number };
  closed: boolean; fill: string; stroke: string; strokeWidth: number;
}
interface TextObjT { id: string; tool: 'text'; x: number; y: number; width: number; height: number; text: string }
interface PathObjT {
  id: string; tool: 'pen' | 'pencil' | 'imported' | 'ellipse' | 'polygon' | 'star' | 'line';
  x: number; y: number; width: number; height: number;
  path: { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' };
  closed: boolean; fill: string; stroke: string; strokeWidth: number;
}

function ids(): () => string {
  let n = 0;
  return () => `i${n++}`;
}

// Read a node tree back through the production import path and return just
// the leaf `Obj`s (drafts' containers dropped). Lets bridge round-trip tests
// assert on the lowered objects without the dead `svgNodesToObjs` wrapper.
function leavesOf(nodes: readonly SvgNode[], nextId: () => string) {
  return svgNodesToSceneDrafts(nodes, nextId)
    .filter((d): d is Extract<SceneDraft, { kind: 'leaf' }> => d.kind === 'leaf')
    .map((d) => d.obj);
}

describe('objToSvgNode', () => {
  it('lowers a rect-tool PathObj to an SvgPathNode with a RectPath and solid fill', () => {
    const rect: RectObjT = {
      id: 'r1', tool: 'rect',
      x: 10, y: 20, width: 30, height: 40,
      path: { kind: 'rect', x: 10, y: 20, width: 30, height: 40 }, closed: true,
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
      id: 'r2', tool: 'rect',
      x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#abcdef', stroke: '#000000', strokeWidth: 0,
    };
    const node = objToSvgNode(rect as never) as SvgPathNode;
    expect(node.stroke).toBeUndefined();
  });

  it('lowers a TextObj to an SvgTextNode preserving geometry and text', () => {
    const text: TextObjT = {
      id: 't1', tool: 'text',
      x: 5, y: 6, width: 100, height: 20,
      text: 'hello',
    };
    const node = objToSvgNode(text as never) as SvgTextNode;
    expect(node.kind).toBe('text');
    expect(node).toMatchObject({ x: 5, y: 6, width: 100, height: 20, text: 'hello' });
  });

  it('emits fill=none on an open PathObj', () => {
    const path: PathObjT = {
      id: 'p1', tool: 'pen',
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
      id: 'p2', tool: 'pen',
      x: 0, y: 0, width: 50, height: 50,
      path: { kind: 'polygon', commands: new Uint8Array([0, 1, 1, 4]), coords: new Float32Array([0, 0, 50, 0, 50, 50]), fillRule: 'nonzero' },
      closed: true,
      fill: '#00ff00', stroke: '#000000', strokeWidth: 1,
    };
    const node = objToSvgNode(path as never) as SvgPathNode;
    expect(node.fill).toEqual({ kind: 'solid', color: '#00ff00' });
  });
});

describe('svgNodesToSceneDrafts — <g> → scene container drafts', () => {
  // Convenience: split drafts by kind for assertions.
  const split = (drafts: SceneDraft[]) => ({
    containers: drafts.filter((d) => d.kind === 'container'),
    leaves: drafts.filter((d): d is Extract<SceneDraft, { kind: 'leaf' }> => d.kind === 'leaf'),
  });

  it('importing a <g> with two leaf children yields a container holding two children', () => {
    const a: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const b: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#def' },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { wd: { attrs: { 'group-id': 'g1' } } },
      children: [a, b],
    };
    const drafts = svgNodesToSceneDrafts([g], ids());
    const { containers, leaves } = split(drafts);
    expect(containers).toHaveLength(1);
    expect(containers[0].id).toBe('g1');
    expect(containers[0].parentId).toBeNull();
    expect(leaves).toHaveLength(2);
    // Both leaves parent under the container.
    expect(leaves.every((l) => l.parentId === 'g1')).toBe(true);
    // Container pose = AABB of the two children (0..30 wide, 0..10 tall).
    expect(containers[0].pose).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  });

  it('emits parents before their children (addable in order)', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const g: SvgGroupNode = {
      kind: 'group',
      meta: { wd: { attrs: { 'group-id': 'g1' } } },
      children: [leaf],
    };
    const drafts = svgNodesToSceneDrafts([g], ids());
    const containerIdx = drafts.findIndex((d) => d.kind === 'container');
    const leafIdx = drafts.findIndex((d) => d.kind === 'leaf');
    expect(containerIdx).toBeGreaterThanOrEqual(0);
    expect(leafIdx).toBeGreaterThan(containerIdx);
    // Every child's parent appears earlier in the list.
    const seen = new Set<string>();
    for (const d of drafts) {
      if (d.parentId !== null) expect(seen.has(d.parentId)).toBe(true);
      seen.add(d.id);
    }
  });

  it('nests containers for nested <g>, preserving wd:group-id', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const inner: SvgGroupNode = {
      kind: 'group',
      meta: { wd: { attrs: { 'group-id': 'inner' } } },
      children: [leaf],
    };
    const outer: SvgGroupNode = {
      kind: 'group',
      meta: { wd: { attrs: { 'group-id': 'outer' } } },
      children: [inner],
    };
    const drafts = svgNodesToSceneDrafts([outer], ids());
    const { containers, leaves } = split(drafts);
    expect(containers.map((c) => c.id).sort()).toEqual(['inner', 'outer']);
    expect(containers.find((c) => c.id === 'outer')!.parentId).toBeNull();
    expect(containers.find((c) => c.id === 'inner')!.parentId).toBe('outer');
    expect(leaves).toHaveLength(1);
    expect(leaves[0].parentId).toBe('inner');
  });

  it('synthesizes a container id when wd:group-id is absent', () => {
    const leaf: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#fff' },
    };
    const g: SvgGroupNode = { kind: 'group', children: [leaf] };
    const drafts = svgNodesToSceneDrafts([g], ids());
    const container = drafts.find((d) => d.kind === 'container')!;
    expect(container.id).toMatch(/^i\d+$/);
  });

  it('keeps root-level leaves at root (parentId null)', () => {
    const node: SvgPathNode = {
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { kind: 'solid', color: '#abc' },
    };
    const drafts = svgNodesToSceneDrafts([node], ids());
    expect(drafts).toHaveLength(1);
    expect(drafts[0].kind).toBe('leaf');
    expect(drafts[0].parentId).toBeNull();
  });
});

describe('sceneToSvgNodes — scene container tree → <g>', () => {
  it('emits an SvgGroupNode per container, stamping group-id, and objToSvgNode per leaf', () => {
    // A minimal SceneSource: one container 'c1' holding two leaves.
    const a: RectObjT = {
      id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#fff', stroke: '#000', strokeWidth: 0,
    };
    const b: RectObjT = {
      id: 'b', tool: 'rect', x: 20, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#fff', stroke: '#000', strokeWidth: 0,
    };
    const source: SceneSource = {
      roots: ['c1'],
      childrenOf: (id) => (id === 'c1' ? ['a', 'b'] : []),
      kindOf: (id) => (id === 'c1' ? 'container' : 'leaf'),
      objOf: (id) => (id === 'a' ? (a as never) : id === 'b' ? (b as never) : undefined),
    };
    const nodes = sceneToSvgNodes(source);
    expect(nodes).toHaveLength(1);
    const g = nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    expect(g.meta?.wd?.attrs?.['group-id']).toBe('c1');
    expect(g.children).toHaveLength(2);
    expect(g.children.every((c) => c.kind === 'path')).toBe(true);
  });

  it('emits root leaves at the document root', () => {
    const a: RectObjT = {
      id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#fff', stroke: '#000', strokeWidth: 0,
    };
    const source: SceneSource = {
      roots: ['a'],
      childrenOf: () => [],
      kindOf: () => 'leaf',
      objOf: (id) => (id === 'a' ? (a as never) : undefined),
    };
    const nodes = sceneToSvgNodes(source);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('path');
  });

  it('nests SvgGroupNodes for nested containers', () => {
    const a: RectObjT = {
      id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#fff', stroke: '#000', strokeWidth: 0,
    };
    const source: SceneSource = {
      roots: ['outer'],
      childrenOf: (id) => (id === 'outer' ? ['inner'] : id === 'inner' ? ['a'] : []),
      kindOf: (id) => (id === 'a' ? 'leaf' : 'container'),
      objOf: (id) => (id === 'a' ? (a as never) : undefined),
    };
    const nodes = sceneToSvgNodes(source);
    expect(nodes).toHaveLength(1);
    const outer = nodes[0];
    if (outer.kind !== 'group') throw new Error('expected outer group');
    expect(outer.meta?.wd?.attrs?.['group-id']).toBe('outer');
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0];
    if (inner.kind !== 'group') throw new Error('expected inner group');
    expect(inner.meta?.wd?.attrs?.['group-id']).toBe('inner');
    expect(inner.children).toHaveLength(1);
    expect(inner.children[0].kind).toBe('path');
  });
});

describe('container round-trip: drafts → svg → drafts (stable ids)', () => {
  it('a container holding two leaves survives export + re-import with its id', () => {
    // Build a scene source: container 'c1' with two rect leaves.
    const a: RectObjT = {
      id: 'a', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#112233', stroke: '#000000', strokeWidth: 0,
    };
    const b: RectObjT = {
      id: 'b', tool: 'rect', x: 20, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#445566', stroke: '#000000', strokeWidth: 0,
    };
    const source: SceneSource = {
      roots: ['c1'],
      childrenOf: (id) => (id === 'c1' ? ['a', 'b'] : []),
      kindOf: (id) => (id === 'c1' ? 'container' : 'leaf'),
      objOf: (id) => (id === 'a' ? (a as never) : id === 'b' ? (b as never) : undefined),
    };

    // Export → SvgNode[] → serialize → parse → re-import as drafts.
    const exported = sceneToSvgNodes(source);
    const svg = serializeSvg(exported, { viewBox: { x: 0, y: 0, width: 100, height: 100 }, namespaces: { wd: 'https://weaseldraw.app/svg-ext' } });
    const parsed = parseSvg(svg, { namespaces: { wd: 'https://weaseldraw.app/svg-ext' } });
    let next = 0;
    const drafts = svgNodesToSceneDrafts(parsed.nodes, () => `re-${next++}`);

    const containers = drafts.filter((d) => d.kind === 'container');
    const leaves = drafts.filter((d) => d.kind === 'leaf');
    expect(containers).toHaveLength(1);
    expect(containers[0].id).toBe('c1'); // stable id round-trips via wd:group-id
    expect(leaves).toHaveLength(2);
    expect(leaves.every((l) => l.parentId === 'c1')).toBe(true);
  });
});

describe('text style round-trip via the bridge', () => {
  it('emits and reads back every persisted TextStyle field including lineHeight', () => {
    const text = {
      id: 't1', tool: 'text' as const,
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
    expect(node.meta?.wd?.attrs?.['line-height']).toBe('1.4');

    const back = leavesOf([node], ids());
    expect(back).toHaveLength(1);
    const t = back[0] as unknown as { tool: 'text'; style?: { lineHeight?: number } };
    expect(t.style?.lineHeight).toBe(1.4);
    expect(t.style).toEqual(text.style);
  });
});

describe('objToSvgNode — coverage gaps', () => {
  it('passes the TextStyle through verbatim (no field stripping besides lineHeight)', () => {
    const text = {
      id: 'x', tool: 'text' as const,
      x: 0, y: 0, width: 100, height: 20, text: 'Hi',
      style: { fontSize: 12, align: 'right' as const },
    };
    const node = objToSvgNode(text as never);
    if (node.kind !== 'text') throw new Error('expected text');
    expect(node.style).toEqual({ fontSize: 12, align: 'right' });
    // No lineHeight in the input → meta bag carries only the `tool` attr.
    expect(node.meta?.wd?.attrs).toEqual({ tool: 'text' });
    expect(node.meta?.wd?.attrs?.['line-height']).toBeUndefined();
  });

  it('round-trips an open PathObj losslessly through both directions', () => {
    const original = {
      id: 'p', tool: 'pen' as const,
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
    const out = leavesOf([node], ids());
    const back = out[0] as unknown as { tool: string; closed: boolean; strokeWidth: number };
    expect(back.tool).toBe('pen');
    expect(back.closed).toBe(false);
    expect(back.strokeWidth).toBe(2);
  });
});

describe('rotation emit', () => {
  it('writes transform="rotate(...)" for a rotated rect', () => {
    const a = {
      id: 'r', tool: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      path: { kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50 }, closed: true,
      fill: '#3366ff', stroke: '#000', strokeWidth: 0, rotation: Math.PI / 6,
    };
    const node = objToSvgNode(a as never);
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).toContain('transform="rotate(30 50 25)"');
  });

  it('writes transform="rotate(...)" for a rotated text', () => {
    const a = {
      id: 't', tool: 'text' as const, x: 100, y: 50, width: 200, height: 40,
      text: 'Hi', rotation: Math.PI / 4,
    };
    const node = objToSvgNode(a as never);
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    expect(svg).toMatch(/transform="rotate\(45 200 70\)"/);
  });

  it('omits transform when rotation is 0 or undefined', () => {
    const a = {
      id: 'r', tool: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      path: { kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50 }, closed: true,
      fill: '#3366ff', stroke: '#000', strokeWidth: 0,
    };
    const node = objToSvgNode(a as never);
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    expect(svg).not.toContain('transform=');
  });
});

describe('rotation parse', () => {
  it('round-trips a rotated rect through serialize → parse → drafts', () => {
    const a = {
      id: 'r', tool: 'rect' as const, x: 0, y: 0, width: 100, height: 50,
      path: { kind: 'rect' as const, x: 0, y: 0, width: 100, height: 50 }, closed: true,
      fill: '#3366ff', stroke: '#000000', strokeWidth: 0, rotation: Math.PI / 6,
    };
    const node = objToSvgNode(a as never);
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 200, height: 200 } });
    const parsed = parseSvg(svg);
    let next = 0;
    const out = leavesOf(parsed.nodes, () => `id${next++}`);
    expect(out).toHaveLength(1);
    const r = out[0];
    expect(r.tool).toBe('rect');
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.width).toBeCloseTo(100, 5);
    expect(r.rotation).toBeCloseTo(Math.PI / 6, 5);
  });

  it('round-trips a rotated text object through serialize → parse → drafts', () => {
    const a = {
      id: 't', tool: 'text' as const, x: 100, y: 50, width: 200, height: 40,
      text: 'Hi', rotation: Math.PI / 4,
    };
    const node = objToSvgNode(a as never);
    const svg = serializeSvg([node], { viewBox: { x: 0, y: 0, width: 400, height: 200 } });
    const parsed = parseSvg(svg);
    let next = 0;
    const out = leavesOf(parsed.nodes, () => `id${next++}`);
    expect(out).toHaveLength(1);
    const t = out[0];
    expect(t.tool).toBe('text');
    expect(t.rotation).toBeCloseTo(Math.PI / 4, 5);
  });
});

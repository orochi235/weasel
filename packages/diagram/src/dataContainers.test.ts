import { describe, expect, it } from 'vitest';
import { diagramContainerOf, titleIdOf } from './containers/trait';
import { POOL_HEADER_SIZE } from './containers/laneStack';
import { resolveContainers } from './dataContainers';
import { DEFAULT_LANE_SIZE, DEFAULT_POOL_ACROSS, type DiagramData } from './dataTypes';
import { diagramScene, type DiagramSpec } from './fromData';
import { DIAGRAM_THEMES } from './theme/themes';

const specOf = (specs: readonly DiagramSpec[], id: string) => specs.find((s) => s.id === id)!;
const boxOf = (specs: readonly DiagramSpec[], id: string) => {
  const { x, y, width, height } = specOf(specs, id).pose;
  return { x, y, width, height };
};
const inside = (inner: { x: number; y: number; width: number; height: number }, outer: typeof inner) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

const node = (id: string, at?: { x: number; y: number }) => ({ id, lines: [id], width: 60, height: 40, ...(at ? { at } : {}) });

describe('resolveContainers', () => {
  it('gives each member its region as parent, the first claim winning, and orders parents first', () => {
    const ids = new Set(['a', 'b']);
    const regions = resolveContainers([
      { id: 'inner', role: 'container', members: ['a'] },
      { id: 'outer', role: 'container', members: ['inner', 'a', 'b', 'outer', 'nope'] },
      { id: 'p', role: 'pool', lanes: [{ id: 'l1', members: ['b'] }, { id: 'l2' }] },
    ], ids, new Set(['a', 'b']));
    expect(regions.regions.map((r) => r.id)).toEqual(['outer', 'inner', 'p', 'l1', 'l2']);
    expect(Object.fromEntries(regions.parentOf)).toEqual({ a: 'inner', inner: 'outer', b: 'outer', l1: 'p', l2: 'p' });
    expect([...ids].sort()).toEqual(['a', 'b', 'inner', 'l1', 'l2', 'outer', 'p']);
  });

  it('ignores a pool named as a member, and a claim that would nest a container in itself', () => {
    const regions = resolveContainers([
      { id: 'c1', role: 'container', members: ['c2', 'p'] },
      { id: 'c2', role: 'container', members: ['c1'] },
      { id: 'p', role: 'pool', lanes: [] },
    ], new Set(), new Set());
    expect(Object.fromEntries(regions.parentOf)).toEqual({ c2: 'c1' });
  });

  it('throws on an id already taken', () => {
    expect(() => resolveContainers([{ id: 'a', role: 'container' }], new Set(['a']), new Set(['a']))).toThrow(/"a"/);
    expect(() => resolveContainers([{ id: 'p', role: 'pool', lanes: [{ id: 'p' }] }], new Set(), new Set())).toThrow(/"p"/);
  });
});

describe('diagramScene with containers', () => {
  it('builds each region before its members, and each member with its region as parent', () => {
    const data: DiagramData = {
      nodes: [node('a'), node('b')],
      edges: [],
      containers: [{ id: 'c', role: 'container', label: 'C', members: ['a'], box: { x: 0, y: 0, width: 300, height: 200 } }],
    };
    const specs = diagramScene(data);
    const ids = specs.map((s) => s.id as string);
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('a'));
    expect(specOf(specs, 'c').kind).toBe('container');
    expect(diagramContainerOf(specOf(specs, 'c'))?.role).toBe('container');
    expect(specOf(specs, 'a').parent).toBe('c');
    expect(specOf(specs, 'b').parent ?? null).toBe(null);
    expect(specOf(specs, titleIdOf('c')).data.text).toBe('C');
  });

  it('keeps a boxed container its size, and seeds members with no `at` inside its body in rows', () => {
    const data: DiagramData = {
      nodes: [node('a'), node('b'), node('c'), node('d', { x: 230, y: 160 })],
      edges: [],
      containers: [{ id: 'k', role: 'container', members: ['a', 'b', 'c', 'd'], box: { x: 100, y: 100, width: 180, height: 200 }, pinned: true }],
    };
    const specs = diagramScene(data);
    const box = boxOf(specs, 'k');
    expect(box).toEqual({ x: 100, y: 100, width: 180, height: 200 });
    const [a, b, c] = ['a', 'b', 'c'].map((id) => boxOf(specs, id));
    for (const m of [a!, b!, c!]) expect(inside(m, box)).toBe(true);
    expect(a!.y).toBe(b!.y);
    expect(c!.y).toBeGreaterThan(a!.y);
    expect(a!.y).toBeGreaterThanOrEqual(box.y + 28);
    expect(boxOf(specs, 'd')).toMatchObject({ x: 230, y: 160 });
  });

  it('fits a container with no box around its members, its header above them', () => {
    const data: DiagramData = {
      nodes: [node('a', { x: 0, y: 0 }), node('b', { x: 200, y: 100 })],
      edges: [],
      containers: [{ id: 'k', role: 'container', label: 'K', members: ['a', 'b'] }],
    };
    const specs = diagramScene(data, { layout: 'none', groupPadding: 10 });
    expect(boxOf(specs, 'k')).toEqual({ x: -10, y: -38, width: 280, height: 188 });
    expect(diagramContainerOf(specOf(specs, 'k'))?.fitted).toBe(true);
  });

  it('stacks a pool\'s lanes past its header, sized by the data or sharing the box', () => {
    const data: DiagramData = {
      nodes: [node('a')],
      edges: [],
      containers: [{
        id: 'p', role: 'pool', box: { x: 0, y: 0, width: 400, height: 300 }, pinned: true,
        lanes: [{ id: 'l1', size: 100, members: ['a'] }, { id: 'l2' }, { id: 'l3' }],
      }],
    };
    const specs = diagramScene(data);
    expect(boxOf(specs, 'p')).toEqual({ x: 0, y: 0, width: 400, height: 300 });
    expect(boxOf(specs, 'l1')).toEqual({ x: POOL_HEADER_SIZE, y: 0, width: 400 - POOL_HEADER_SIZE, height: 100 });
    expect(boxOf(specs, 'l2')).toEqual({ x: POOL_HEADER_SIZE, y: 100, width: 400 - POOL_HEADER_SIZE, height: 100 });
    expect(boxOf(specs, 'l3')).toEqual({ x: POOL_HEADER_SIZE, y: 200, width: 400 - POOL_HEADER_SIZE, height: 100 });
    expect(specOf(specs, 'l1').parent).toBe('p');
    expect(specOf(specs, 'a').parent).toBe('l1');
    expect(inside(boxOf(specs, 'a'), boxOf(specs, 'l1'))).toBe(true);
  });

  it('gives a pool with no box its default size, columns stacking along x', () => {
    const data: DiagramData = {
      nodes: [],
      edges: [],
      containers: [{ id: 'p', role: 'pool', axis: 'x', lanes: [{ id: 'l1' }, { id: 'l2', size: 200 }] }],
    };
    const specs = diagramScene(data, { layout: 'none' });
    const p = boxOf(specs, 'p');
    expect(p.width).toBe(DEFAULT_LANE_SIZE + 200);
    expect(p.height).toBe(DEFAULT_POOL_ACROSS);
    expect(boxOf(specs, 'l2')).toEqual({ x: p.x + DEFAULT_LANE_SIZE, y: p.y + POOL_HEADER_SIZE, width: 200, height: DEFAULT_POOL_ACROSS - POOL_HEADER_SIZE });
  });

  it('colors regions from the theme: a container its container style, a pool its lane header, lanes in turn', () => {
    const theme = DIAGRAM_THEMES.night!;
    const data: DiagramData = {
      nodes: [node('a')],
      edges: [],
      containers: [
        { id: 'c', role: 'container', members: ['a'] },
        { id: 'p', role: 'pool', lanes: [{ id: 'l1' }, { id: 'l2' }] },
        { id: 'r', role: 'container', style: 'accent' },
      ],
    };
    const specs = diagramScene(data, { theme });
    const fill = (id: string) => (specOf(specs, id).data.fill?.paint as { color?: string } | undefined)?.color;
    const stroke = (id: string) => (specOf(specs, id).data.stroke?.paint as { color?: string } | undefined)?.color;
    expect(fill('c')).toBe(theme.container.fill);
    expect(fill('p')).toBe(theme.lane.header.fill);
    expect(stroke('l1')).toBe(theme.lane.bodies[0]!.stroke);
    expect(stroke('l2')).toBe(theme.lane.bodies[1 % theme.lane.bodies.length]!.stroke);
    expect(fill('r')).toBe(theme.roles.accent!.fill);
  });
});

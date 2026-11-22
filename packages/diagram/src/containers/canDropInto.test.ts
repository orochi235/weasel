import { describe, expect, it } from 'vitest';
import { dataKeyReader } from '../trait';
import { createScene, unionOfChildren, type NodeId, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { diagramScene } from '../fromData';
import { diagramCanDropInto, diagramDropParentAt } from './canDropInto';

type N = { id: string; kind: 'mark' | 'group'; data: unknown };
const region = (id: string, role: string, side?: 'top' | 'left'): N =>
  ({ id, kind: 'group', data: { diagram: { outline: 'rect', container: { role, ...(side ? { header: { side, size: 32 } } : {}) } } } });
const NODES: Record<string, N> = {
  box: region('box', 'container'),
  pool: region('pool', 'pool'),
  lane: region('lane', 'lane'),
  lane2: region('lane2', 'lane'),
  rows: region('rows', 'pool', 'left'),
  row: region('row', 'lane', 'left'),
  column: region('column', 'lane', 'top'),
  body: { id: 'body', kind: 'group', data: { diagram: { outline: 'rect' } } },
  group: { id: 'group', kind: 'group', data: {} },
  shape: { id: 'shape', kind: 'mark', data: { diagram: { outline: 'rect' } } },
  edge: { id: 'edge', kind: 'mark', data: { diagram: { from: {}, to: {} } } },
  text: { id: 'text', kind: 'mark', data: {} },
  seq: { id: 'seq', kind: 'group', data: { diagram: { sequence: {} } } },
  anchor: { id: 'anchor', kind: 'group', data: { diagram: { anchor: {} } } },
};
const can = diagramCanDropInto({ get: (id: never) => NODES[id as string] });

describe('diagramCanDropInto', () => {
  it('lets containers and lanes take shapes and containers', () => {
    expect(can('box', ['shape', 'box'])).toBe(true);
    expect(can('lane', ['shape', 'box'])).toBe(true);
  });

  it('lets a pool take only lanes, and a lane go only into a pool', () => {
    expect(can('pool', ['lane2'])).toBe(true);
    expect(can('pool', ['shape'])).toBe(false);
    expect(can('pool', [])).toBe(false);
    expect(can('box', ['lane'])).toBe(false);
    expect(can('group', ['lane'])).toBe(false);
  });

  it('lets a lane move only into a pool stacking along its axis', () => {
    expect(can('rows', ['row'])).toBe(true);
    expect(can('rows', ['column'])).toBe(false);
  });

  it('keeps pools out of containers and lanes', () => {
    expect(can('box', ['pool'])).toBe(false);
    expect(can('lane', ['pool'])).toBe(false);
  });

  it('refuses a stencil body, and never drops an edge in', () => {
    expect(can('body', ['shape'])).toBe(false);
    expect(can('box', ['edge'])).toBe(false);
    expect(can('group', ['shape'])).toBe(true);
  });

  it('takes nothing into a mark, or into a group carrying a diagram trait that is no region', () => {
    expect(can('text', ['shape'])).toBe(false);
    expect(can('seq', ['shape'])).toBe(false);
    expect(can('anchor', ['shape'])).toBe(false);
  });

  it('asks the host about a structurally allowed reparent, and answers with its verdict', () => {
    const nodes: Record<string, N & { parent?: string | null }> = { ...NODES, kept: { ...NODES.shape!, id: 'kept', parent: 'box' } };
    const asked: [readonly string[], string][] = [];
    const host = diagramCanDropInto({ get: (id: never) => nodes[id as string] }, (ids, into) => {
      asked.push([ids, into]);
      return into === 'lane' ? { refuse: 'Lanes are closed' } : true;
    });
    expect(host('lane', ['shape'])).toEqual({ refuse: 'Lanes are closed' });
    expect(host('box', ['shape'])).toBe(true);
    expect(host('pool', ['shape'])).toBe(false);
    // A drag within the container a node already sits in is no reparent.
    expect(host('box', ['kept'])).toBe(true);
    expect(asked).toEqual([[['shape'], 'lane'], [['shape'], 'box']]);
  });

  it('leaves lanes out of the participants a connector can end on', () => {
    expect(dataKeyReader(NODES.lane!)).toBeNull();
    expect(dataKeyReader(NODES.pool!)).not.toBeNull();
  });
});

describe('diagramCanDropInto with canReparent', () => {
  it('asks canReparent about an insert, which moves no node', () => {
    const asked: string[][] = [];
    const veto = diagramCanDropInto({ get: (id: never) => NODES[id as string] }, (ids) => { asked.push([...ids]); return false; });
    expect(veto('box', [])).toBe(false);
    expect(asked).toEqual([[]]);
  });
});

describe('diagramDropParentAt', () => {
  it('finds a container where it overhangs the body of the one it is in', () => {
    const specs = diagramScene({
      nodes: [],
      edges: [],
      containers: [
        { id: 'outer', role: 'container', members: ['inner'], box: { x: 100, y: 100, width: 400, height: 300 }, pinned: true },
        { id: 'inner', role: 'container', box: { x: 420, y: 200, width: 150, height: 150 }, pinned: true },
      ],
    }, { layout: 'none' });
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    for (const spec of specs) scene.add(spec as never);
    expect(diagramDropParentAt(scene as never, { x: 540, y: 300 }, null)).toBe('inner');
    expect(diagramDropParentAt(scene as never, { x: 50, y: 50 }, null)).toBe(null);
  });

  it('finds a container nested in another where it is drawn, its pose being in its parent\'s frame', () => {
    const specs = diagramScene({
      nodes: [],
      edges: [],
      containers: [
        { id: 'outer', role: 'container', members: ['inner'], box: { x: 100, y: 100, width: 400, height: 300 }, pinned: true },
        { id: 'inner', role: 'container', box: { x: 300, y: 200, width: 150, height: 150 }, pinned: true },
      ],
    }, { layout: 'none' });
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    for (const spec of specs) scene.add(spec as never);
    expect(diagramDropParentAt(scene as never, { x: 400, y: 300 }, null)).toBe('inner');
    expect(diagramDropParentAt(scene as never, { x: 150, y: 300 }, null)).toBe('outer');
  });

  it('finds a container under an envelope where it is drawn, the envelope being no frame', () => {
    const specs = diagramScene({
      nodes: [], edges: [],
      containers: [{ id: 'box', role: 'container', box: { x: 300, y: 100, width: 200, height: 200 }, pinned: true }],
    }, { layout: 'none' });
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    scene.add({ id: 'env' as NodeId, kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {}, dependsOn: 'children', derivePose: unionOfChildren });
    for (const spec of specs) scene.add({ ...(spec as object), ...((spec as { parent?: unknown }).parent == null ? { parent: 'env' } : {}) } as never);
    expect(scene.get('box' as NodeId)!.parent).toBe('env');
    expect(diagramDropParentAt(scene as never, { x: 400, y: 250 }, null)).toBe('box');
  });

  it('passes over a locked or hidden container, and one canDropInto refuses, for the region around it', () => {
    const specs = diagramScene({
      nodes: [], edges: [],
      containers: [
        { id: 'outer', role: 'container', members: ['inner'], box: { x: 100, y: 100, width: 400, height: 300 }, pinned: true },
        { id: 'inner', role: 'container', box: { x: 300, y: 200, width: 150, height: 150 }, pinned: true },
      ],
    }, { layout: 'none' });
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    for (const spec of specs) scene.add(spec as never);
    const at = { x: 400, y: 300 };
    scene.setLocked('inner' as NodeId, true);
    expect(diagramDropParentAt(scene as never, at, null)).toBe('outer');
    scene.setLocked('inner' as NodeId, false);
    scene.setHidden('inner' as NodeId, true);
    expect(diagramDropParentAt(scene as never, at, null)).toBe('outer');
    scene.setHidden('inner' as NodeId, false);
    expect(diagramDropParentAt(scene as never, at, null, (parent) => parent !== 'inner')).toBe('outer');
    expect(diagramDropParentAt(scene as never, at, null)).toBe('inner');
  });

  it('finds a turned container where it draws', () => {
    const specs = diagramScene({
      nodes: [], edges: [],
      containers: [{ id: 'box', role: 'container', box: { x: 0, y: 0, width: 400, height: 100 }, pinned: true }],
    }, { layout: 'none' });
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    for (const spec of specs) scene.add(spec as never);
    scene.setPose('box' as NodeId, { ...(scene.get('box' as NodeId)!.pose as RectPose), rotation: Math.PI / 2 });
    // Turned a quarter about (200, 50), the box spans x 150..250 and y -150..250.
    expect(diagramDropParentAt(scene as never, { x: 200, y: 200 }, null)).toBe('box');
    expect(diagramDropParentAt(scene as never, { x: 350, y: 50 }, null)).toBeNull();
  });
});

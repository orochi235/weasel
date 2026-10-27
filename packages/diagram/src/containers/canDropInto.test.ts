import { describe, expect, it } from 'vitest';
import { dataKeyReader } from '../trait';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { diagramScene } from '../fromData';
import { diagramCanDropInto, diagramDropParentAt } from './canDropInto';

type N = { id: string; kind: 'mark' | 'group'; data: unknown };
const region = (id: string, role: string): N =>
  ({ id, kind: 'group', data: { diagram: { outline: 'rect', container: { role } } } });
const NODES: Record<string, N> = {
  box: region('box', 'container'),
  pool: region('pool', 'pool'),
  lane: region('lane', 'lane'),
  lane2: region('lane2', 'lane'),
  body: { id: 'body', kind: 'group', data: { diagram: { outline: 'rect' } } },
  group: { id: 'group', kind: 'group', data: {} },
  shape: { id: 'shape', kind: 'mark', data: { diagram: { outline: 'rect' } } },
  edge: { id: 'edge', kind: 'mark', data: { diagram: { from: {}, to: {} } } },
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
    expect(can('box', ['lane'])).toBe(false);
    expect(can('group', ['lane'])).toBe(false);
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

describe('diagramDropParentAt', () => {
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
});

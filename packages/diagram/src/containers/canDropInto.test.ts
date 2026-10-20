import { describe, expect, it } from 'vitest';
import { dataKeyReader } from '../trait';
import { diagramCanDropInto } from './canDropInto';

type N = { id: string; kind: 'leaf' | 'container'; data: unknown };
const region = (id: string, role: string): N =>
  ({ id, kind: 'container', data: { diagram: { outline: 'rect', container: { role } } } });
const NODES: Record<string, N> = {
  box: region('box', 'container'),
  pool: region('pool', 'pool'),
  lane: region('lane', 'lane'),
  lane2: region('lane2', 'lane'),
  body: { id: 'body', kind: 'container', data: { diagram: { outline: 'rect' } } },
  group: { id: 'group', kind: 'container', data: {} },
  shape: { id: 'shape', kind: 'leaf', data: { diagram: { outline: 'rect' } } },
  edge: { id: 'edge', kind: 'leaf', data: { diagram: { from: {}, to: {} } } },
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

  it('leaves lanes out of the participants a connector can end on', () => {
    expect(dataKeyReader(NODES.lane!)).toBeNull();
    expect(dataKeyReader(NODES.pool!)).not.toBeNull();
  });
});

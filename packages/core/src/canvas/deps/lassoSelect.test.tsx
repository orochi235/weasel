import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useLassoSelectDepSource } from './lassoSelect';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

function makeScene(): Scene<unknown, string, unknown> {
  const nodes = new Map<string, { id: string; kind: 'leaf'; pose: { x: number; y: number; width: number; height: number }; data: unknown }>();
  nodes.set('a', { id: 'a', kind: 'leaf', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => ['a'] as NodeId[],
    renderOrderNodes: () => [...nodes.values()],
    get: (id: NodeId) => nodes.get(id as string) as never,
  } as unknown as Scene<unknown, string, unknown>;
}

function makeSelection(): SelectionApi {
  let cur: NodeId[] = [];
  return {
    current: cur,
    set: (ids: NodeId[]) => { cur = ids; },
  } as unknown as SelectionApi;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useLassoSelectDepSource', () => {
  it('registers a `lassoSelect` dep that delegates hitTestArea to the AABB scan', () => {
    let reg!: DepRegistry;
    function Wire() {
      useLassoSelectDepSource(makeScene(), makeSelection());
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('lassoSelect');
    expect(dep).toBeDefined();
    expect(typeof dep.hitTestArea).toBe('function');
    expect(typeof dep.getSelection).toBe('function');
    expect(typeof dep.setSelection).toBe('function');
    expect(dep.hitTestArea({ x: 0, y: 0, width: 5, height: 5 })).toEqual(['a']);
  });
});

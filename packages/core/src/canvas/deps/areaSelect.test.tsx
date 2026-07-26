import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useAreaSelectDepSource } from './areaSelect';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

function makeScene(): Scene<unknown, string, unknown> {
  const nodes = new Map<string, { id: string; kind: 'leaf'; pose: { x: number; y: number; width: number; height: number }; data: unknown }>();
  nodes.set('a', { id: 'a', kind: 'leaf', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
  nodes.set('b', { id: 'b', kind: 'leaf', pose: { x: 100, y: 100, width: 10, height: 10 }, data: null });
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => ['a', 'b'] as NodeId[],
    get: (id: NodeId) => nodes.get(id as string) as never,
  } as unknown as Scene<unknown, string, unknown>;
}

function makeSelection(initial: NodeId[] = []): SelectionApi {
  let cur = initial;
  return {
    current: cur,
    set: (ids: NodeId[]) => { cur = ids; },
    add: () => {},
    toggle: () => {},
    clear: () => {},
    has: () => false,
    get size() { return cur.length; },
  } as unknown as SelectionApi;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useAreaSelectDepSource', () => {
  it('registers an `areaSelect` dep that returns ids whose AABB intersects bounds', () => {
    const scene = makeScene();
    const sel = makeSelection();
    let reg!: DepRegistry;
    function Wire() {
      useAreaSelectDepSource(scene, sel);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('areaSelect');
    expect(dep).toBeDefined();
    expect(dep.hitTestArea({ x: -5, y: -5, width: 8, height: 8 })).toEqual(['a']);
    expect(dep.hitTestArea({ x: 90, y: 90, width: 30, height: 30 })).toEqual(['b']);
    expect(dep.hitTestArea({ x: 200, y: 200, width: 5, height: 5 })).toEqual([]);
  });
});

/**
 * Every dispatched action gets its deps from `buildDepsFromRequires`, whose
 * dev-mode Proxy throws on a read the descriptor didn't declare in `requires`.
 * These descriptors are reachable only through consumer-wired bindings, so a
 * missing name shows up as a dead keystroke rather than a failing test —
 * exercise them through the real bag instead.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildDepsFromRequires } from '../buildDeps';
import type { DepRegistry } from '../depRegistry';
import type { Action } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import { asNodeId } from 'core/scene/types';
import { reorderForwardAction, reorderBackwardAction } from './reorder';
import { alignLeftAction, alignCenterYAction } from './align';
import { distributeHorizontalAction, distributeVerticalAction } from './distribute';
import { pathfinderUnionAction, pathfinderExcludeAction } from './booleans';

const IDS = ['a', 'b', 'c'];

function makeDeps() {
  const applyOps = vi.fn();
  const selection = {
    get: () => IDS.map(asNodeId),
    current: [] as readonly string[],
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(),
    clear: vi.fn(), contains: () => false,
  };
  const scene = {
    get: (id: string) => ({ id: asNodeId(id), pose: { x: 0, y: 0, width: 10, height: 10 }, parent: null }),
    roots: IDS.map(asNodeId),
    childrenOf: () => [],
    setPose: vi.fn(),
    batch: (_label: string, fn: () => unknown) => fn(),
    applyBatch: vi.fn(),
    reorder: vi.fn(),
  };
  const booleansAdapter = {
    getSelection: () => IDS.map(asNodeId),
    getWorldPath: () => undefined,
    compareZ: () => 0,
    createPathNode: () => ({ id: 'merged' }),
    applyBatch: vi.fn(),
  };
  const bag: Record<string, unknown> = { selection, scene, applyOps, booleansAdapter };
  const registry = { get: (name: string) => bag[name] } as unknown as DepRegistry;
  return { registry, applyOps };
}

const DESCRIPTORS: Action[] = [
  reorderForwardAction,
  reorderBackwardAction,
  alignLeftAction,
  alignCenterYAction,
  distributeHorizontalAction,
  distributeVerticalAction,
  pathfinderUnionAction,
  pathfinderExcludeAction,
];

describe('kit descriptors declare every dep they read', () => {
  for (const action of DESCRIPTORS) {
    it(`${action.id} runs on a bag built from its own \`requires\``, () => {
      const { registry } = makeDeps();
      const deps = buildDepsFromRequires(action, registry);
      expect(() => action.enabled?.(deps)).not.toThrow();
      expect(() => (action.invoker as ImmediateInvoker).run(deps, {})).not.toThrow();
    });
  }

  it('reorder routes its ops through the consumer commit hook', () => {
    const { registry, applyOps } = makeDeps();
    for (const action of [reorderForwardAction, reorderBackwardAction]) {
      applyOps.mockClear();
      const deps = buildDepsFromRequires(action, registry);
      (action.invoker as ImmediateInvoker).run(deps, { distance: 'adjacent' });
      expect(applyOps, action.id).toHaveBeenCalled();
    }
  });
});

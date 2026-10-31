import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import type { ActionsRegistry, DepName, DepRegistry } from '@weasel-js/routing';
import {
  ActionsProvider, asNodeId, createHistory, DepRegistryProvider, lastOperationOf, useActionsRegistry, useDepRegistry,
  type Op,
} from '@weasel-js/core';
import { extendToMeetAction } from './extendToMeet';

/** A curved stroke still turning at its end, and a wall it reaches either way. */
const NODES = new Map([
  ['arc', 'M0 0 A50 50 0 0 1 25 6.69872981'],
  ['wall', 'M-200 120 H400'],
].map(([id, d]) => [id, { id: asNodeId(id), kind: 'mark', layer: 'main', pose: pathFromD(d), data: {}, parent: null }]));

function setup() {
  const history = createHistory({});
  const batches: Op[][] = [];
  let registry: ActionsRegistry | null = null;
  let deps: DepRegistry | null = null;
  function Grab() {
    registry = useActionsRegistry();
    deps = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><ActionsProvider><Grab /></ActionsProvider></DepRegistryProvider>);
  const scene = {
    get: (id: string) => NODES.get(id),
    childrenOf: () => [],
    get roots() { return [...NODES.keys()].map(asNodeId); },
    renderOrderNodes: () => [...NODES.values()],
  };
  const register = (name: string, value: unknown) => deps!.register(name as DepName, () => value as never);
  act(() => {
    register('history', history);
    register('scene', scene);
    register('selection', { get: () => [], set: () => {} });
    register('selectionSnapshot', { take: () => () => {} });
    // The stub scene keeps its poses, so the history entry stands in for the ops.
    register('applyOps', (ops: Op[], label: string) => {
      batches.push(ops);
      history.applyOps([{ apply: () => {}, invert() { return this; } } as unknown as Op], label);
    });
    registry!.register(extendToMeetAction);
  });
  return { history, registry: registry!, batches, store: lastOperationOf(registry)! };
}

const commandsOf = (ops: Op[]) => Array.from((ops[0].args as { to: PolygonPath }).to.commands);

describe('Extend to next path as the last operation', () => {
  it('is held after a click, and changing its shape reruns the click in place', () => {
    const { history, registry, batches, store } = setup();
    // What the tool's click binding hands the action: the world point and its reach.
    act(() => { registry.trigger('extendToMeet', { world: { x: 25, y: 7 }, radiusPx: 3 }); });
    expect(store.get()).toMatchObject({ id: 'extendToMeet', values: { shape: 'eased', radiusPx: 3 } });
    const eased = commandsOf(batches[0]);
    act(() => { store.adjust({ shape: 'straight' }); });
    expect(history.undoDepth()).toBe(1);
    const straight = commandsOf(batches[1]);
    expect(eased.length).toBeGreaterThan(straight.length);
  });
});

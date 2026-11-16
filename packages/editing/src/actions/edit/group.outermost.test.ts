import { describe, expect, it } from 'vitest';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/core';
import { groupAction } from './group';
import { makeBooleanGroupAction } from '../pathfinder/booleanGroupAction';

function selectAll() {
  const scene = createScene<Record<string, never>, 'main'>({ systemLayers: [{ id: 'main' }] });
  const box = (x: number) => ({ x, y: 0, width: 10, height: 10 });
  const g = scene.add({ kind: 'group', layer: 'main', pose: box(0), data: {} });
  const c = scene.add({ kind: 'mark', layer: 'main', pose: box(0), data: {}, parent: g });
  const r = scene.add({ kind: 'mark', layer: 'main', pose: box(40), data: {} });
  let current: NodeId[] = [g, c, r];
  const selection = { get: () => [...current], set: (next: NodeId[]) => { current = [...next]; } };
  return { scene, g, c, r, deps: { scene, operands: selection } as never, made: () => current[0]! };
}

describe('grouping a selection that holds a node and its descendant', () => {
  for (const action of [groupAction, makeBooleanGroupAction]) {
    it(`${action.id} takes the outermost, leaving the descendant in its group`, () => {
      const rig = selectAll();
      (action.invoker as ImmediateInvoker).run(rig.deps, undefined as never);
      expect(rig.scene.childrenOf(rig.made())).toEqual([rig.g, rig.r]);
      expect(rig.scene.childrenOf(rig.g)).toEqual([rig.c]);
    });
  }

  it('leaves Make Boolean Group disabled when the outermost are fewer than two', () => {
    const rig = selectAll();
    (rig.deps as { operands: { set(ids: NodeId[]): void } }).operands.set([rig.g, rig.c]);
    expect(makeBooleanGroupAction.enabled!(rig.deps)).toBe(ActionDisabledReason.SelectionRequired);
  });
});

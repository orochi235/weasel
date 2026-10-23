import { describe, it, expect } from 'vitest';
import { ungroupAction } from './group';
import { createScene } from 'core/scene/scene';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import type { NodeId } from 'core/scene/types';
import type { ImmediateInvoker } from '@weasel-js/routing';

const pose = (x: number) => ({ x, y: 0, width: 10, height: 10 });

function markWithChild() {
  const scene = createScene<unknown, 'main'>({ systemLayers: [{ id: 'main' }] });
  const parent = scene.add({ kind: 'mark', layer: 'main', pose: pose(0), data: {} });
  const child = scene.add({ kind: 'mark', layer: 'main', pose: pose(20), data: {}, parent });
  return { scene, parent, child };
}

describe('a mark that has children', () => {
  it('is not dissolved by Ungroup', () => {
    const { scene, parent, child } = markWithChild();
    let selected: NodeId[] = [parent];
    const selection = { get: () => selected, set: (ids: NodeId[]) => { selected = ids; } };

    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);

    expect(scene.get(parent)).toBeDefined();
    expect(scene.get(child)!.parent).toBe(parent);
    expect(selected).toEqual([parent]);
  });

  it('is taken by a marquee, unlike a group', () => {
    const { scene, parent, child } = markWithChild();
    const group = scene.add({ kind: 'group', layer: 'main', pose: pose(100), data: {} });
    const member = scene.add({ kind: 'mark', layer: 'main', pose: pose(100), data: {}, parent: group });
    const box = { x: -5, y: -5, width: 200, height: 30 };

    const taken = hitTestArea(scene as never, box);
    expect(taken).toEqual(expect.arrayContaining([parent, child, member]));
    expect(taken).not.toContain(group);
    expect(hitTestArea(scene as never, box, undefined, undefined, { includeGroups: true })).toContain(group);
  });
});

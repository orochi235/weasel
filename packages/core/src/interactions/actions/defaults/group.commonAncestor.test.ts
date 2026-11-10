import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { groupAction } from './group';

type Layer = 'main';

function nested() {
  const scene = createScene<Record<string, never>, Layer>({ systemLayers: [{ id: 'main' }] });
  const box = (x: number) => ({ x, y: 0, width: 10, height: 10 });
  const behind = scene.add({ kind: 'mark', layer: 'main', pose: box(0), data: {} });
  const header = scene.add({ kind: 'group', layer: 'main', pose: box(0), data: {} });
  const front = scene.add({ kind: 'mark', layer: 'main', pose: box(0), data: {} });
  const logo = scene.add({ kind: 'group', layer: 'main', pose: box(0), data: {}, parent: header });
  const title = scene.add({ kind: 'group', layer: 'main', pose: box(0), data: {}, parent: header });
  const mark = scene.add({ kind: 'mark', layer: 'main', pose: box(0), data: {}, parent: logo });
  const text = scene.add({ kind: 'mark', layer: 'main', pose: box(20), data: {}, parent: title });
  const after = scene.add({ kind: 'mark', layer: 'main', pose: box(40), data: {}, parent: header });
  return { scene, behind, header, front, logo, title, mark, text, after };
}

function group(scene: ReturnType<typeof nested>['scene'], ids: NodeId[]): NodeId {
  let current = [...ids];
  const selection = { get: () => [...current], set: (next: NodeId[]) => { current = [...next]; } };
  (groupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
  return current[0]!;
}

describe('groupAction — members under different parents', () => {
  it('puts the new group in the members\' lowest common ancestor, not the top of the tree', () => {
    const { scene, header, mark, text } = nested();
    const made = group(scene, [mark, text]);
    expect(scene.get(made)!.parent).toBe(header);
    expect(scene.childrenOf(made)).toEqual([mark, text]);
  });

  it('stands in the place of the frontmost member\'s branch, below what stacked above it', () => {
    const { scene, header, logo, title, mark, text, after } = nested();
    const made = group(scene, [mark, text]);
    expect(scene.childrenOf(header)).toEqual([logo, title, made, after]);
  });

  it('keeps the top of the tree when the members only meet there', () => {
    const { scene, behind, mark } = nested();
    const made = group(scene, [behind, mark]);
    expect(scene.get(made)!.parent ?? null).toBeNull();
  });
});

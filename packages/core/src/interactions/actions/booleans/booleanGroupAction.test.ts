/** Making a boolean group of the selection, switching its operation, and releasing it. */
import { describe, expect, it } from 'vitest';
import { pathContainsPoint, type Path } from '@weasel-js/geom';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import { createNodeRouting } from 'core/scene/NodeRouting';
import { sceneDerivedPathOf } from 'canvas/derivedPath';
// Installs the outline reader a boolean group's derivation reads its children through.
import 'canvas/NodeShape';
import { inferredNodeRouting } from 'canvas/SceneCanvas/defaultNodeRouting';
import { inferredNodeProperties } from 'canvas/SceneCanvas/defaultNodeProperties';
import { ungroupAction } from '../defaults/group';
import { makeBooleanGroup, makeBooleanGroupAction } from './booleanGroupAction';

const RED = { paint: { kind: 'solid', color: '#ff0000' } };
const BLUE = { paint: { kind: 'solid', color: '#0000ff' } };
const rect = (x: number): Path => ({ kind: 'rect', x, y: x, width: 100, height: 100 });

function makeScene() {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const under = scene.add({ kind: 'mark', layer: 'main', pose: { x: 500, y: 0, width: 10, height: 10 }, data: {} });
  const back = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { path: rect(0), fill: RED } });
  const front = scene.add({ kind: 'mark', layer: 'main', pose: { x: 50, y: 50, width: 100, height: 100 }, data: { path: rect(50), fill: BLUE } });
  const over = scene.add({ kind: 'mark', layer: 'main', pose: { x: 600, y: 0, width: 10, height: 10 }, data: {} });
  return { scene, under, back, front, over };
}

function selectionOf(ids: string[]) {
  let held = ids;
  return { get: () => held, set: (next: string[]) => { held = next; } };
}

describe('Make Boolean Group', () => {
  it('puts the selection under a union in the frontmost one\'s place, wearing its paint, nothing moving', () => {
    const { scene, under, back, front, over } = makeScene();
    const selection = selectionOf([front, back]);
    (makeBooleanGroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    const [group] = selection.get() as NodeId[];
    expect(scene.roots).toEqual([under, group, over]);
    expect(scene.childrenOf(group!)).toEqual([back, front]);
    expect(scene.get(group!)).toMatchObject({ consumesChildren: true, data: { boolean: 'union', fill: BLUE } });
    expect(scene.get(front)!.pose).toMatchObject({ x: 50, y: 50 });
    const path = sceneDerivedPathOf(scene)(scene.get(group!)!);
    expect(pathContainsPoint(path!, 25, 25) && pathContainsPoint(path!, 125, 125)).toBe(true);
  });

  it('is one undo entry, and needs two nodes', () => {
    const { scene, back, front } = makeScene();
    expect(makeBooleanGroup(scene as never, [back])).toBeNull();
    expect(makeBooleanGroupAction.enabled!({ selection: selectionOf([back]) } as never)).not.toBe(true);
    const before = scene.roots.length;
    makeBooleanGroup(scene as never, [back, front], 'subtract');
    expect(scene.roots).toHaveLength(before - 1);
    scene.undo();
    expect(scene.roots).toHaveLength(before);
  });

  it('switches its operation as a data edit', () => {
    const { scene, back, front } = makeScene();
    const group = makeBooleanGroup(scene as never, [back, front])!;
    scene.update(group, { data: { ...scene.get(group)!.data, boolean: 'intersect' } });
    const path = sceneDerivedPathOf(scene)(scene.get(group)!);
    expect([pathContainsPoint(path!, 25, 25), pathContainsPoint(path!, 75, 75)]).toEqual([false, true]);
  });

  it('is released by Ungroup, its operands back where it stood', () => {
    const { scene, under, back, front, over } = makeScene();
    const group = makeBooleanGroup(scene as never, [back, front])!;
    const selection = selectionOf([group]);
    expect(ungroupAction.enabled!({ scene, selection } as never)).toBe(true);
    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    expect(scene.get(group)).toBeUndefined();
    expect(scene.roots).toEqual([under, back, front, over]);
    expect(selection.get()).toEqual([back, front]);
  });

  it('routes as "boolean", whose properties edit the operation', () => {
    const { scene, back, front } = makeScene();
    const group = makeBooleanGroup(scene as never, [back, front])!;
    const routing = createNodeRouting();
    for (const k of inferredNodeRouting) routing.register(k);
    const node = scene.get(group)!;
    expect(routing.classify(node.data, node)).toBe('boolean');
    const schema = inferredNodeProperties.find((e) => e.name === 'boolean')!.schema;
    expect(Object.keys((schema.members.boolean as { members: object }).members)).toEqual(['data.boolean']);
  });
});

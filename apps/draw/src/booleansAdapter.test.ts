import { describe, it, expect } from 'vitest';
import { applyBooleanOp, asNodeId, createScene, rectPath, type NodeId } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './App';
import { drawBooleansAdapter } from './booleansAdapter';

function setup() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
  });
  const leaf = (id: string, x: number, parent?: string) => scene.add({
    id: asNodeId(id),
    kind: 'leaf',
    layer: 'default',
    pose: { x, y: 0, width: 10, height: 10 },
    data: { path: rectPath(0, 0, 10, 10) },
    ...(parent ? { parent: asNodeId(parent) } : {}),
  });
  // A top-level node and a container ahead of the one under test, so render
  // order and sibling order disagree about every index inside `g`.
  leaf('top', 100);
  scene.add({ id: asNodeId('g0'), kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
  leaf('g0a', 200, 'g0');
  scene.add({ id: asNodeId('g'), kind: 'container', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
  leaf('below', 300, 'g');
  leaf('a', 0, 'g');
  leaf('b', 5, 'g');
  leaf('above', 400, 'g');
  const adapter = drawBooleansAdapter(scene, {
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids: NodeId[]) => scene.setSelection(ids),
  });
  return { scene, adapter };
}

const children = (scene: ReturnType<typeof setup>['scene'], id: string | null) =>
  (id === null ? [...scene.roots] : [...scene.childrenOf(asNodeId(id))]) as string[];

describe('drawBooleansAdapter', () => {
  it('puts the result of a boolean inside a container in its sources\' slot', () => {
    const { scene, adapter } = setup();
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    const result = applyBooleanOp(adapter, 'union');
    expect(result.kind).toBe('applied');
    const [id] = result.kind === 'applied' ? result.resultIds : [];
    expect(children(scene, 'g')).toEqual(['below', id, 'above']);
    expect(children(scene, null)).toEqual(['top', 'g0', 'g']);
  });

  it('restores the sources to their slots on undo', () => {
    const { scene, adapter } = setup();
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    applyBooleanOp(adapter, 'union');
    scene.undo();
    expect(children(scene, 'g')).toEqual(['below', 'a', 'b', 'above']);
    expect(children(scene, null)).toEqual(['top', 'g0', 'g']);
  });

  it('mints ids the scene does not already hold', () => {
    const { scene, adapter } = setup();
    scene.add({ id: asNodeId('b-0'), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    expect(applyBooleanOp(adapter, 'union').kind).toBe('applied');
  });
});

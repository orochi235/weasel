import { describe, it, expect } from 'vitest';
import { applyBooleanOp, asNodeId, createScene, pathFromD, rectPath, type NodeId } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { drawBooleansAdapter } from './booleansAdapter';

function setup() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
  });
  const leaf = (id: string, x: number, parent?: string) => scene.add({
    id: asNodeId(id),
    kind: 'mark',
    layer: 'default',
    pose: { x, y: 0, width: 10, height: 10 },
    data: { path: rectPath(0, 0, 10, 10) },
    ...(parent ? { parent: asNodeId(parent) } : {}),
  });
  // A top-level node and a container ahead of the one under test, so render
  // order and sibling order disagree about every index inside `g`.
  leaf('top', 100);
  scene.add({ id: asNodeId('g0'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
  leaf('g0a', 200, 'g0');
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data: {} });
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
    scene.add({ id: asNodeId('b-0'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} });
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    expect(applyBooleanOp(adapter, 'union').kind).toBe('applied');
  });

  it('keeps a fill of None on the result', () => {
    const { scene, adapter } = setup();
    for (const id of ['a', 'b']) {
      scene.update(asNodeId(id), { data: { path: rectPath(0, 0, 10, 10), fill: null, stroke: { paint: { color: '#000' }, width: 1 } } });
    }
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    const result = applyBooleanOp(adapter, 'union');
    const [id] = result.kind === 'applied' ? result.resultIds : [];
    const node = scene.get(asNodeId(id));
    expect(node?.kind === 'mark' ? node.data.fill : 'missing').toBeNull();
  });
});

describe('drawBooleansAdapter on an op that keeps its pieces apart', () => {
  it('paints each cropped piece like the source it was cut from, not like the mask', () => {
    const { scene, adapter } = setup();
    scene.update(asNodeId('a'), { data: { path: rectPath(0, 0, 10, 10), fill: { paint: { color: '#f00' } } } });
    scene.update(asNodeId('b'), { data: { path: rectPath(0, 0, 10, 10), fill: { paint: { color: '#00f' } } } });
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    const result = applyBooleanOp(adapter, 'crop');
    const [id] = result.kind === 'applied' ? result.resultIds : [];
    expect(scene.get(asNodeId(id!))?.data.fill).toEqual({ paint: { color: '#f00' } });
  });
});

describe('drawBooleansAdapter result data', () => {
  it('takes its topmost source\'s label and paint, whatever order the sources were selected in', () => {
    const { scene, adapter } = setup();
    scene.update(asNodeId('a'), { data: { path: rectPath(0, 0, 10, 10), fill: { paint: { color: '#0f0' } }, label: 'under' } });
    scene.update(asNodeId('b'), { data: { path: rectPath(0, 0, 10, 10), fill: { paint: { color: '#f00' } }, label: 'over' } });
    scene.setSelection([asNodeId('b'), asNodeId('a')]);
    const result = applyBooleanOp(adapter, 'union');
    const [id] = result.kind === 'applied' ? result.resultIds : [];
    expect(scene.get(asNodeId(id!))!.data).toMatchObject({ label: 'over', fill: { paint: { color: '#f00' } } });
  });

  it('keeps the label when the topmost source\'s stroke became the result\'s shape', () => {
    const { scene, adapter } = setup();
    scene.update(asNodeId('b'), {
      data: { path: rectPath(0, 0, 10, 10), fill: null, stroke: { paint: { color: '#f00' }, width: 2 }, label: 'ring' },
    });
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    const result = applyBooleanOp(adapter, 'union', { strokes: 'unfilled' });
    const [id] = result.kind === 'applied' ? result.resultIds : [];
    const { data } = scene.get(asNodeId(id!))!;
    expect(data).toMatchObject({ label: 'ring', fill: { paint: { color: '#f00' } } });
    expect(data.stroke).toBeUndefined();
  });
});

describe('drawBooleansAdapter with strokes counted', () => {
  it('fills a result in its topmost source\'s stroke paint, and does not stroke it again', () => {
    const { scene, adapter } = setup();
    scene.add({
      id: asNodeId('line'), kind: 'mark', layer: 'default', parent: asNodeId('g'),
      pose: { x: -5, y: 5, width: 30, height: 0 },
      data: { path: pathFromD('M0 0 L30 0'), stroke: { paint: { color: '#f00' }, width: 4 } },
    });
    scene.setSelection([asNodeId('a'), asNodeId('line')]);

    const result = applyBooleanOp(adapter, 'union', { strokes: 'unfilled' });

    const [id] = result.kind === 'applied' ? result.resultIds : [];
    const made = scene.get(asNodeId(id!))!;
    expect(made.data.fill).toEqual({ paint: { color: '#f00' } });
    expect(made.data.stroke).toBeUndefined();
    expect(made.pose).toMatchObject({ x: -5, width: 30 });
  });
});

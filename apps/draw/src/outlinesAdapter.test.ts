import { describe, expect, it } from 'vitest';
import { solid, solidStroke } from '@weasel-js/paint';
import { asNodeId, createScene, rectPath, type NodeId } from '@weasel-js/core';
import { applyOutlineStroke } from '@weasel-js/path-tools';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { drawOutlinesAdapter } from './outlinesAdapter';

function setup(data: WeaselDrawData, generateId?: () => NodeId) {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    ...(generateId ? { generateId } : {}),
  });
  scene.add({ id: asNodeId('src'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data });
  scene.setSelection([asNodeId('src')]);
  const adapter = drawOutlinesAdapter(scene, {
    getSelection: () => [...scene.getSelection()],
    setSelection: (ids: NodeId[]) => scene.setSelection(ids),
  });
  return { scene, adapter };
}

const dataOf = (scene: ReturnType<typeof setup>['scene'], id: string) => scene.get(asNodeId(id))!.data;

describe('drawOutlinesAdapter', () => {
  it('names the group a filled, stroked node becomes as the node was named, and leaves its paths unnamed', () => {
    const { scene, adapter } = setup({
      path: rectPath(0, 0, 10, 10), fill: { paint: solid('#f00') }, stroke: solidStroke('#00f', 2), label: 'Welcome',
    });
    const result = applyOutlineStroke(adapter);
    const [group] = result.kind === 'applied' ? result.resultIds : [];
    expect(scene.get(asNodeId(group!))!.kind).toBe('group');
    expect(dataOf(scene, group!)).toEqual({ label: 'Welcome' });
    const parts = [...scene.childrenOf(asNodeId(group!))];
    expect(parts).toHaveLength(2);
    for (const part of parts) expect(dataOf(scene, part).label).toBeUndefined();
  });

  it('names the one path an unfilled, stroked node becomes as the node was named, in the stroke\'s paint', () => {
    const { scene, adapter } = setup({
      path: rectPath(0, 0, 10, 10), fill: null, stroke: solidStroke('#00f', 2), label: 'Frame',
    });
    const result = applyOutlineStroke(adapter);
    const [made] = result.kind === 'applied' ? result.resultIds : [];
    expect(dataOf(scene, made!)).toMatchObject({ label: 'Frame', fill: { paint: solidStroke('#00f', 2).paint } });
    expect(dataOf(scene, made!).stroke).toBeUndefined();
  });

  it('mints no id a reloaded document already holds', () => {
    // A new session's generator starts over, and the document it reopens holds what the last one minted.
    let n = 0;
    const { scene, adapter } = setup(
      { path: rectPath(0, 0, 10, 10), fill: { paint: solid('#f00') }, stroke: solidStroke('#00f', 2) },
      () => asNodeId(`n${n++}`),
    );
    const old = ['n0', 'n1', 'n2'];
    for (const id of old) {
      scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: id } });
    }
    n = 0;
    const result = applyOutlineStroke(adapter);
    expect(result.kind).toBe('applied');
    const [group] = result.kind === 'applied' ? result.resultIds : [];
    const made = [group!, ...scene.childrenOf(asNodeId(group!))];
    expect(made).toHaveLength(3);
    for (const id of made) expect(old).not.toContain(id);
    for (const id of old) expect(dataOf(scene, id).label).toBe(id);
  });
});

describe('drawOutlinesAdapter in a frame', () => {
  it('outlines a paged stroke where the page draws it, stored in the page\'s frame', () => {
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('page'), kind: 'group', layer: 'default', pose: { x: 100, y: 50, width: 200, height: 200 }, data: {} });
    scene.add({
      id: asNodeId('src'), kind: 'mark', layer: 'default', parent: asNodeId('page'),
      pose: { x: 10, y: 10, width: 10, height: 10 },
      data: { path: rectPath(0, 0, 10, 10), fill: null, stroke: solidStroke('#00f', 2) },
    });
    scene.setSelection([asNodeId('src')]);
    const adapter = drawOutlinesAdapter(scene, {
      getSelection: () => [...scene.getSelection()],
      setSelection: (ids: NodeId[]) => scene.setSelection(ids),
    });
    const result = applyOutlineStroke(adapter);
    const [made] = result.kind === 'applied' ? result.resultIds : [];
    const node = scene.get(asNodeId(made!))!;
    expect(node.parent).toBe('page');
    // The 2-wide stroke reaches 1 past the 10-square on each side.
    expect(node.pose).toMatchObject({ x: 9, y: 9, width: 12, height: 12 });
  });
});

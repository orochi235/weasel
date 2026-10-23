import { describe, expect, it } from 'vitest';
import { asNodeId, createScene, pathFromD } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { hasCompoundPath, releaseCompoundPaths } from './releaseCompound';

const box = (x: number) => ({ x, y: 0, width: 10, height: 10 });
const rect = (x: number) => ({ kind: 'rect' as const, ...box(x) });

/** A group holding [below, compound, above], with one more shape over the group. */
function setup() {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  const leaf = { kind: 'mark' as const, layer: 'default' as const };
  const g = scene.add({ kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 10 }, data: {} });
  scene.add({ ...leaf, id: asNodeId('below'), parent: g, pose: box(0), data: { path: rect(0) } });
  scene.add({
    ...leaf, id: asNodeId('compound'), parent: g, pose: { x: 20, y: 0, width: 30, height: 10 },
    data: { path: pathFromD('M20 0 H30 V10 H20 Z M40 0 H50 V10 H40 Z'), label: 'two squares' },
  });
  scene.add({ ...leaf, id: asNodeId('above'), parent: g, pose: box(60), data: { path: rect(60) } });
  scene.add({ ...leaf, id: asNodeId('top'), pose: box(80), data: { path: rect(80) } });
  return { scene, g };
}

describe('releaseCompoundPaths', () => {
  it('leaves the pieces in the group, where the compound path was in the stack', () => {
    const { scene, g } = setup();
    const out = releaseCompoundPaths(scene, ['compound']);
    expect(out).toHaveLength(2);
    expect(scene.childrenOf(g)).toEqual([asNodeId('below'), ...out, asNodeId('above')]);
    expect(scene.roots).toEqual([g, asNodeId('top')]);
    expect(out.map((id) => scene.get(id)!.pose)).toEqual([box(20), box(40)]);
    expect(scene.get(out[0])!.data.label).toBe('two squares');
  });

  it('keeps a path with one subpath as it is', () => {
    const { scene, g } = setup();
    expect(releaseCompoundPaths(scene, ['below'])).toEqual([asNodeId('below')]);
    expect(scene.childrenOf(g)).toHaveLength(3);
  });

  it('undoes as one step', () => {
    const { scene, g } = setup();
    releaseCompoundPaths(scene, ['compound']);
    scene.undo();
    expect(scene.childrenOf(g)).toEqual(['below', 'compound', 'above'].map(asNodeId));
  });
});

describe('hasCompoundPath', () => {
  it('is true only when a selected leaf holds more than one subpath', () => {
    const { scene } = setup();
    expect(hasCompoundPath(scene, ['compound'])).toBe(true);
    expect(hasCompoundPath(scene, ['below', 'compound'])).toBe(true);
    expect(hasCompoundPath(scene, ['below', 'top'])).toBe(false);
    expect(hasCompoundPath(scene, [])).toBe(false);
    expect(hasCompoundPath(scene, ['gone'])).toBe(false);
  });
});

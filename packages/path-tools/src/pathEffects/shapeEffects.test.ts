/**
 * Roughen, Zigzag, and Pucker & Bloat: the path effects of one shape each.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathToAnchors, rectPath, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import {
  createScene, derivedDepOf, type NodeId, pathEffectOf, pathEffectParts, type RectPose, type Scene, sceneFromJSON,
  withPathEffectsRegistry,
} from '@weasel-js/core';
import { editPathEffectAction, expandPathEffectAction, puckerBloatAction, roughenAction, zigzagAction } from './actions';
import { releasePathEffectAction } from './retarget';
import { readPathEffectSettings } from './settingsForm';

type TestScene = Scene<unknown, 'default', RectPose>;

const box = (id: string, x: number) => ({
  id: id as NodeId,
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x, y: 0, width: 100, height: 100 },
  data: { path: rectPath(0, 0, 100, 100), fill: { paint: { color: '#ff0000' } } },
});

function setup(selected: string[], registered = true) {
  const scene: TestScene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    ...(registered ? { registry: withPathEffectsRegistry() } : {}),
    initial: [box('a', 0), box('b', 200)],
  });
  let current = selected;
  const selection = { get: () => current, set: (next: string[]) => { current = next; } };
  const deps = { scene, selection } as unknown as InvocationCtx['deps'];
  return { scene, deps, selected: () => current };
}

const run = (action: { invoker?: unknown }, deps: InvocationCtx['deps'], params?: Record<string, unknown>) =>
  (action.invoker as ImmediateInvoker).run(deps, params);

function partsOf(scene: TestScene, id: string) {
  const node = scene.get(id as NodeId)!;
  return pathEffectParts(node, (node.dependsOn as NodeId[]).map((d) => derivedDepOf(scene, d)))!;
}

describe('the shape effects', () => {
  it('are disabled with nothing selected, and where the scene cannot hold them', () => {
    expect(roughenAction.enabled!(setup([]).deps)).toBe('selection-required');
    expect(roughenAction.enabled!(setup(['a'], false).deps)).toBe('not-applicable');
    expect(roughenAction.enabled!(setup(['a']).deps)).toBe(true);
  });

  it('make one effect of each selected shape, just over it, hiding it, as one undo step', () => {
    const { scene, deps, selected } = setup(['a', 'b']);
    run(zigzagAction, deps, { size: 4 });
    const made = selected();
    expect(made).toHaveLength(2);
    for (const id of made) {
      const node = scene.get(id as NodeId)!;
      const [source] = node.dependsOn as NodeId[];
      expect(node.dependsOn).toHaveLength(1);
      expect(scene.roots.indexOf(id as NodeId)).toBe(scene.roots.indexOf(source!) + 1);
      expect(scene.get(source!)!.hidden).toBe(true);
      expect(pathEffectOf(node)).toMatchObject({ kind: 'zigzag', size: 4, hideSources: true });
    }
    expect(new Set(made.map((id) => scene.get(id as NodeId)!.dependsOn![0]))).toEqual(new Set(['a', 'b']));
    scene.undo();
    expect(scene.roots).toEqual(['a', 'b']);
    expect(scene.get('a' as NodeId)!.hidden).toBeFalsy();
  });

  it('paint the shape changed, in its paint, and follow it', () => {
    const { scene, deps, selected } = setup(['a']);
    run(puckerBloatAction, deps, { amount: -0.5 });
    const id = selected()[0]!;
    const [part] = partsOf(scene, id);
    expect(part!.fill).toEqual({ paint: { color: '#ff0000' } });
    expect(boundsOfPath(part!.path).width).toBeGreaterThan(100);
    scene.setPose('a' as NodeId, { x: 500, y: 0, width: 100, height: 100 });
    expect(boundsOfPath(partsOf(scene, id)[0]!.path).x).toBeGreaterThan(400);
  });

  it('roughen the same way after a save and load', () => {
    const { scene, deps, selected } = setup(['a']);
    run(roughenAction, deps, { size: 6, seed: 3 });
    const id = selected()[0]!;
    const loaded = sceneFromJSON<unknown, 'default', RectPose>(scene.toJSON(), { registry: withPathEffectsRegistry() });
    const coords = (s: TestScene) => Array.from((partsOf(s, id)[0]!.path as PolygonPath).coords);
    expect(coords(loaded as TestScene)).toEqual(coords(scene));
  });

  it('edit through the Edit Path Effect form', () => {
    const { scene, deps, selected } = setup(['a']);
    run(zigzagAction, deps, {});
    const id = selected()[0]!;
    expect(readPathEffectSettings(deps).values).toMatchObject({ zigzags: 1, zigzag: { size: 5, ridges: 4, smooth: false } });
    run(editPathEffectAction, deps, { ids: [id], kind: 'zigzag', ridges: 1 });
    const [anchors] = pathToAnchors(partsOf(scene, id)[0]!.path as PolygonPath).anchors;
    expect(anchors).toHaveLength(8);
  });

  it('expand to one ordinary path, taking the hidden source with it', () => {
    const { scene, deps, selected } = setup(['a']);
    run(roughenAction, deps, {});
    run(expandPathEffectAction, deps);
    expect(scene.get('a' as NodeId)).toBeUndefined();
    const [made] = selected();
    expect(scene.get(made as NodeId)!.dependsOn).toBeUndefined();
    expect(scene.roots).toEqual([made, 'b']);
  });

  it('release, showing the shape again', () => {
    const { scene, deps, selected } = setup(['a']);
    run(puckerBloatAction, deps, {});
    run(releasePathEffectAction, deps);
    expect(selected()).toEqual(['a']);
    expect(scene.get('a' as NodeId)!.hidden).toBeFalsy();
    expect(scene.roots).toEqual(['a', 'b']);
  });
});

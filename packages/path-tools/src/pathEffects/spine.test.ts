import { describe, expect, it } from 'vitest';
import { boundsOfPath, rectPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx } from '@weasel-js/routing';
import {
  createScene, derivedDepOf, type NodeId, type PathEffect, pathEffectNode, pathEffectOf, pathEffectParts, PATH_EFFECT_DERIVATIONS,
  type RectPose, type Scene, sourcesHiddenBy, withPathEffectsRegistry,
} from '@weasel-js/core';
import { releaseBlendSpineAction, setBlendSpineAction } from './spine';

type TestScene = Scene<unknown, 'default', RectPose>;

const box = (id: string, x: number) => ({
  id: id as NodeId,
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x, y: 0, width: 20, height: 20 },
  data: { path: rectPath(0, 0, 20, 20), fill: { paint: { color: '#f00' } } },
});

/** A horizontal line `y` down, from x 0 to 200. */
const line = (id: string, y: number) => ({
  id: id as NodeId,
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x: 0, y, width: 200, height: 0 },
  data: { path: { kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 200, 0]), fillRule: 'nonzero' }, stroke: { paint: { color: '#000' }, width: 1 } },
});

/** Two boxes 180 apart, a blend of one step between them over `sources`,
 *  and two lines, 100 and 200 down. */
function setup(selected: string[], sources = ['a', 'b'], effect: PathEffect = { kind: 'blend', steps: 1 }) {
  const scene: TestScene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [
      box('a', 0), box('b', 180), line('s1', 100), line('s2', 200),
      {
        ...pathEffectNode(effect, sources as NodeId[], 'default', PATH_EFFECT_DERIVATIONS),
        id: 'blend' as NodeId,
      },
    ],
  });
  let current = selected;
  const selection = { get: () => current, set: (next: string[]) => { current = next; } };
  const deps = { scene, selection } as unknown as InvocationCtx['deps'];
  return { scene, deps, select: (ids: string[]) => { current = ids; }, selected: () => current };
}

const run = (action: { invoker?: unknown }, deps: InvocationCtx['deps']) =>
  (action.invoker as ImmediateInvoker).run(deps, undefined);

/** Where the blend's one step sits, vertically. */
function stepY(scene: TestScene): number {
  const node = scene.get('blend' as NodeId)!;
  const parts = pathEffectParts(node, (node.dependsOn as NodeId[]).map((d) => derivedDepOf(scene, d)))!;
  const b = boundsOfPath(parts[0]!.path);
  return b.y + b.height / 2;
}

describe('setting a blend\'s spine', () => {
  it('lays an existing blend along the selected path, as one undo step', () => {
    const { scene, deps, selected } = setup(['blend', 's1']);
    expect(stepY(scene)).toBeCloseTo(10, 3);
    expect(setBlendSpineAction.enabled!(deps)).toBe(true);
    run(setBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b', 's1']);
    expect(stepY(scene)).toBeCloseTo(100, 3);
    expect(selected()).toEqual(['blend']);
    scene.undo();
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b']);
  });

  it('takes the path whichever order the two were selected in', () => {
    const { scene, deps } = setup(['s1', 'blend']);
    run(setBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b', 's1']);
  });

  it('replaces a spine the blend already has', () => {
    const { scene, deps } = setup(['blend', 's2'], ['a', 'b', 's1']);
    expect(stepY(scene)).toBeCloseTo(100, 3);
    run(setBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b', 's2']);
    expect(stepY(scene)).toBeCloseTo(200, 3);
  });

  it('refuses a path that is already the spine, one of the blend\'s own shapes, or not with a blend', () => {
    expect(setBlendSpineAction.enabled!(setup(['blend', 's1'], ['a', 'b', 's1']).deps)).toBe('not-applicable');
    expect(setBlendSpineAction.enabled!(setup(['blend', 'a']).deps)).toBe('not-applicable');
    expect(setBlendSpineAction.enabled!(setup(['s1', 's2']).deps)).toBe('not-applicable');
    expect(setBlendSpineAction.enabled!(setup(['blend']).deps)).toBe('selection-required');
    const { scene, deps } = setup(['blend', 'a']);
    run(setBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b']);
  });

  it('refuses a path derived from the blend itself, which would be a cycle', () => {
    const { scene, deps, select } = setup([]);
    scene.add({
      ...pathEffectNode({ kind: 'repeatAlong', count: 2 }, ['a' as NodeId, 'blend' as NodeId], 'default', PATH_EFFECT_DERIVATIONS),
      id: 'echo' as NodeId,
    } as never);
    select(['blend', 'echo']);
    expect(setBlendSpineAction.enabled!(deps)).toBe('not-applicable');
  });
});

describe('releasing a blend\'s spine', () => {
  it('drops the spine from the blend, leaves the path in the scene, and selects it', () => {
    const { scene, deps, selected } = setup(['blend'], ['a', 'b', 's1']);
    expect(releaseBlendSpineAction.enabled!(deps)).toBe(true);
    run(releaseBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b']);
    expect(stepY(scene)).toBeCloseTo(10, 3);
    const spine = scene.get('s1' as NodeId)!;
    expect(spine.dependsOn).toBeUndefined();
    expect(spine.pose).toEqual({ x: 0, y: 100, width: 200, height: 0 });
    expect(selected()).toEqual(['s1']);
    scene.undo();
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b', 's1']);
  });

  it('is unavailable on a blend with no spine', () => {
    const { scene, deps } = setup(['blend']);
    expect(releaseBlendSpineAction.enabled!(deps)).toBe('not-applicable');
    run(releaseBlendSpineAction, deps);
    expect(scene.get('blend' as NodeId)!.dependsOn).toEqual(['a', 'b']);
  });
});

describe('a blend that hides its sources, retargeted', () => {
  it('keeps its record of the sources it found hidden in step through Release Spine and Set Spine', () => {
    const effect: PathEffect = { kind: 'blend', steps: 1, hideSources: true, foundHidden: [2] };
    const { scene, deps, select } = setup(['blend'], ['a', 'b', 's1'], effect);
    const blend = 'blend' as NodeId;
    run(releaseBlendSpineAction, deps);
    expect(pathEffectOf(scene.get(blend))?.foundHidden).toBeUndefined();
    select(['blend', 's2']);
    run(setBlendSpineAction, deps);
    expect(sourcesHiddenBy(scene, blend)).toEqual(['a', 'b', 's2']);
    scene.undo();
    scene.undo();
    expect(scene.get(blend)!.dependsOn).toEqual(['a', 'b', 's1']);
    expect(pathEffectOf(scene.get(blend))?.foundHidden).toEqual([2]);
    scene.redo();
    scene.redo();
    expect(sourcesHiddenBy(scene, blend)).toEqual(['a', 'b', 's2']);
  });
});

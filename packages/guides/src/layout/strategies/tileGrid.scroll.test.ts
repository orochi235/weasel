/** A `'scroll'` tile grid in a scene: the wheel scrolls its overflow into view, and nothing stored moves. */
import { describe, expect, it } from 'vitest';
import {
  asNodeId, containerScrollAction, createScene, RIGID_POSE_COMPOSITION, scenePoseAdapter, sceneViewPoseAdapter,
  composeWorldPose, scrollRange, AUTO_POSE_DESCRIPTOR,
} from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import { tileGrid } from './tileGrid';

const G = asNodeId('G');
type ActionDeps = NonNullable<Parameters<NonNullable<typeof containerScrollAction.enabled>>[0]>;
const run = (deps: ActionDeps, params: Record<string, unknown>): void =>
  (containerScrollAction.invoker as { run(d: ActionDeps, p: Record<string, unknown>): void }).run(deps, params);

function grid(tiles: number) {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    composition: RIGID_POSE_COMPOSITION,
    initial: [{
      id: G, kind: 'group', layer: 'l', data: null, pose: { x: 0, y: 0, width: 100, height: 100 },
      layout: tileGrid<RectPose>({ cols: 2, rows: 2, overflow: 'scroll' }),
    }],
  });
  const ids = Array.from({ length: tiles }, () =>
    scene.add({ kind: 'mark', layer: 'l', parent: G, data: null, pose: { x: 0, y: 0, width: 50, height: 50 } }));
  return { scene, ids };
}

describe('a scrolling tileGrid', () => {
  it('scrolls over the rows past its bounds, and shows the last one where the first was', () => {
    const { scene, ids } = grid(6);
    expect(scrollRange(scene as never, G, AUTO_POSE_DESCRIPTOR)).toEqual({ x: [0, 0], y: [0, 50] });
    const last = ids[5];
    const stored = scene.get(last)!.pose;
    const shown = () => composeWorldPose(sceneViewPoseAdapter(scene as never), last, scene.composition.compose as never) as RectPose;
    expect(shown().y).toBe(100);
    const deps = { scene, view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} } } as unknown as ActionDeps;
    expect(containerScrollAction.enabled!(deps, { x: 50, y: 50 })).toBe(true);
    run(deps, { world: { x: 50, y: 50 }, deltaX: 0, deltaY: 500 });
    expect(scene.scroll.get(G)).toEqual({ x: 0, y: 50 });
    expect(shown().y).toBe(50);
    expect(scene.get(last)!.pose).toEqual(stored);
    expect((composeWorldPose(scenePoseAdapter(scene as never), last, scene.composition.compose as never) as RectPose).y).toBe(100);
  });

  it('leaves the wheel to the view when every tile fits', () => {
    const { scene } = grid(4);
    const deps = { scene } as unknown as ActionDeps;
    expect(containerScrollAction.enabled!(deps, { x: 50, y: 50 })).not.toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import type { View } from 'core/viewport/view';
import { buildSceneLayer } from '../buildSceneLayer';
import { defaultDrawOne, defaultPaintBounds } from '../defaultDrawOne';
import { pickWalk, scenePickSource } from '../pickWalk';
import { sceneToAdapter } from '../sceneAdapter';
import { wireSceneSlotToScene } from '../sceneSlotWiring';
import { rungIndexAt } from './ladder';
import { createLodState, type LodState } from './lodState';

const view = (scale: number, x = 0, y = 0): View => ({ x, y, scale: { x: scale, y: scale } });

describe('rungIndexAt', () => {
  const from = [0, 10, 40];

  it('takes the highest rung the size reaches when nothing was shown before', () => {
    expect(rungIndexAt(from, 5, -1)).toBe(0);
    expect(rungIndexAt(from, 10, -1)).toBe(1);
    expect(rungIndexAt(from, 400, -1)).toBe(2);
  });

  it('changes no rung while a zoom oscillates 10% about a threshold for 300 frames', () => {
    for (const start of [0, 1]) {
      let i = start;
      const changes: number[] = [];
      for (let f = 0; f < 300; f++) {
        const next = rungIndexAt(from, 10 * (f % 2 === 0 ? 1.1 : 0.9), i);
        if (next !== i) changes.push(f);
        i = next;
      }
      expect(changes).toEqual([]);
    }
  });

  it('changes once each way on a sweep, at 1.5t going up and 0.67t going down', () => {
    let i = 0;
    const ups: number[] = [];
    for (let s = 1; s <= 30; s += 0.25) {
      const next = rungIndexAt(from, s, i);
      if (next !== i) ups.push(s);
      i = next;
    }
    expect(ups).toEqual([15]);
    const downs: number[] = [];
    for (let s = 30; s >= 1; s -= 0.25) {
      const next = rungIndexAt(from, s, i);
      if (next !== i) downs.push(s);
      i = next;
    }
    expect(downs).toEqual([6.5]);
  });

  it('moves several rungs at once on a fast zoom', () => {
    expect(rungIndexAt(from, 1000, 0)).toBe(2);
    expect(rungIndexAt(from, 1, 2)).toBe(0);
  });
});

type Data = { fill?: unknown; background?: unknown };

/** `groups × groups` groups of 10 world units at a pitch of 20, each holding one rect. */
function gridScene(groups: number) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const ids: { group: string; child: string }[] = [];
  for (let gy = 0; gy < groups; gy++) {
    for (let gx = 0; gx < groups; gx++) {
      const pose = { x: gx * 20, y: gy * 20, width: 10, height: 10 };
      const group = scene.add({ kind: 'group', layer: 'main', pose, data: {} });
      const child = scene.add({
        kind: 'mark', layer: 'main', parent: group, pose: { ...pose, width: 5, height: 5 },
        data: { fill: { paint: { kind: 'solid', color: 'red' } } },
      });
      ids.push({ group, child });
    }
  }
  return { scene, ids };
}

/** The scene layer `<SceneCanvas>` builds, culled, collapsing groups below `collapseBelowPx`. */
function sceneLayer(scene: ReturnType<typeof gridScene>['scene'], state: LodState, collapseBelowPx: number, seen: string[]) {
  const drawOne = (node: never, pose: never, v: View, ctx?: { rung?: string }) => {
    seen.push(`${(node as { id: string }).id}:${ctx?.rung ?? 'full'}`);
    return defaultDrawOne(node, pose, v, ctx as never);
  };
  const wired = wireSceneSlotToScene(
    { drawOne: drawOne as never, cull: true, paintBounds: defaultPaintBounds as never, lod: { collapseBelowPx } },
    scene, undefined, undefined, state,
  );
  return buildSceneLayer(wired as never, sceneToAdapter(scene) as never, () => null, () => null);
}

const DIMS = { width: 200, height: 200, dpr: 1 };

describe('level of detail in the scene walk', () => {
  it('draws a group too small for its children as its box, and visits none of them', () => {
    const { scene, ids } = gridScene(2);
    const state = createLodState();
    const seen: string[] = [];
    const layer = sceneLayer(scene, state, 24, seen);
    // Groups are 10 units: 10 px at scale 1, below 24, above 2.
    layer.draw(null, view(1), DIMS);
    expect(seen.sort()).toEqual(ids.map((n) => `${n.group}:box`).sort());
    expect(state.rungOf(ids[0]!.group)).toBe('box');
    expect(state.skips(ids[0]!.group)).toBe(true);

    seen.length = 0;
    layer.draw(null, view(4), DIMS);
    expect(seen).toContain(`${ids[0]!.child}:full`);
    expect(state.rungOf(ids[0]!.group)).toBe('full');
  });

  it('paints the box rung as a filled rect over the pose box', () => {
    const { scene, ids } = gridScene(1);
    const layer = sceneLayer(scene, createLodState(), 24, []);
    const out = layer.draw(null, view(1), DIMS) as DrawCommand[];
    const json = JSON.stringify(out);
    expect(json).toContain('"kind":"rect","x":0,"y":0,"width":10,"height":10');
    expect(json).not.toContain('"color":"red"');
    expect(ids).toHaveLength(1);
  });

  it('holds no more entries than the last frame visited, through a pan across 2,000 nodes', () => {
    const { scene } = gridScene(32); // 1,024 groups, 2,048 nodes; the view sees about 100 groups.
    const state = createLodState();
    const seen: string[] = [];
    const layer = sceneLayer(scene, state, 24, seen);
    let largest = 0;
    for (let step = 0; step < 40; step++) {
      seen.length = 0;
      layer.draw(null, view(1, step * 16, step * 4), DIMS);
      // Every node the walk visits is a group at the box rung, painted unless the cull rejects it.
      expect(state.size()).toBeLessThanOrEqual(seen.length + 40);
      largest = Math.max(largest, state.size());
    }
    expect(largest).toBeLessThan(350); // of 1,024 groups
    // Off past the scene's edge, the record empties.
    layer.draw(null, view(1, 5000, 5000), DIMS);
    expect(state.size()).toBe(0);
  });

  it('keeps a rung through a zoom parked on its threshold', () => {
    const { scene, ids } = gridScene(1);
    const state = createLodState();
    const layer = sceneLayer(scene, state, 24, []);
    const rungs: (string | undefined)[] = [];
    for (let f = 0; f < 60; f++) {
      // 10 units at 2.4 ± 10% straddles 24 px.
      layer.draw(null, view(2.4 * (f % 2 === 0 ? 1.1 : 0.9)), DIMS);
      rungs.push(state.rungOf(ids[0]!.group));
    }
    expect(new Set(rungs)).toEqual(new Set(['full']));
  });
});

describe('level of detail in picking', () => {
  const at = (x: number, y: number) => (_n: unknown, p: RectPose) =>
    x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height;

  it('lands a click on a collapsed group, not on the child it hides', () => {
    const { scene, ids } = gridScene(1);
    const state = createLodState();
    sceneLayer(scene, state, 24, []).draw(null, view(1), DIMS);
    const q = { hits: at(2, 2), clipAdmits: () => true };
    expect(pickWalk<RectPose>(scenePickSource(scene), q as never)).toEqual([ids[0]!.group, ids[0]!.child]);
    expect(pickWalk<RectPose>(scenePickSource(scene, { lod: state }), q as never)).toEqual([ids[0]!.group]);
    // A query that leaves groups out still takes one drawn as a single item.
    expect(pickWalk<RectPose>(scenePickSource(scene, { lod: state }), { ...q, includeGroups: false } as never))
      .toEqual([ids[0]!.group]);
  });

  it('lets a click on a node drawn at none fall through to what is under it', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const back = scene.add({ kind: 'mark', layer: 'main', pose, data: { fill: { paint: { kind: 'solid', color: 'blue' } } } });
    const label = scene.add({
      kind: 'mark', layer: 'main', pose, data: { fill: { paint: { kind: 'solid', color: 'black' } } },
      lod: [{ as: 'none', fromPx: 0 }, { as: 'full', fromPx: 40 }],
    });
    const state = createLodState();
    const seen: string[] = [];
    sceneLayer(scene, state, 24, seen).draw(null, view(1), DIMS);
    expect(seen).toEqual([`${back}:full`]);
    expect(state.rungOf(label)).toBe('none');
    const q = { hits: at(5, 5), clipAdmits: () => true };
    expect(pickWalk<RectPose>(scenePickSource(scene, { lod: state }), q as never)).toEqual([back]);
  });
});

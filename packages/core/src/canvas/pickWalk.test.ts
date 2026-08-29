/**
 * The gates every hit-test walk shares, and the agreement between the walks
 * that used to implement them separately.
 *
 * The four walks drifted three times without a failing test because nothing
 * asserted they answered alike. The agreement block at the bottom is that
 * missing test; it is the reason the collapse is worth keeping.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { pickWalk, scenePickSource, hiddenLayerIds, type ScenePickSourceOptions } from './pickWalk';
import { hitTestArea } from './deps/hitTestArea';
import { sceneToAdapter } from './sceneAdapter';
import type { RectPose } from 'features/groups/composePose';
import type { Path } from 'features/paths/types';

function rectScene() {
  const scene = createScene<{ kind: string }, 'main' | 'top', RectPose>({
    systemLayers: [{ id: 'main' }, { id: 'top' }],
  });
  scene.add({
    kind: 'leaf', layer: 'main', id: asNodeId('a'),
    pose: { x: 0, y: 0, width: 40, height: 40 }, data: { kind: 'rect' },
  });
  scene.add({
    kind: 'leaf', layer: 'main', id: asNodeId('b'),
    pose: { x: 20, y: 20, width: 40, height: 40 }, data: { kind: 'rect' },
  });
  return scene;
}

/** Point query over a rect scene, the way the two point walks phrase it. */
function pickAt(
  scene: ReturnType<typeof rectScene>,
  x: number,
  y: number,
  opts: ScenePickSourceOptions<RectPose> = {},
): string[] {
  return pickWalk<RectPose>(scenePickSource(scene, opts), {
    hits: (_n, p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height,
    clipAdmits: () => true,
  });
}

describe('pickWalk — alpha', () => {
  it('does not pick a node the view paints at alpha 0', () => {
    const scene = rectScene();
    expect(pickAt(scene, 5, 5)).toEqual(['a']);

    scene.overrides.set(asNodeId('a'), { alpha: 0 });
    scene.overrides.commit();
    expect(pickAt(scene, 5, 5)).toEqual([]);
  });

  it('still picks a node mid-fade — the floor is zero, not a threshold', () => {
    const scene = rectScene();
    scene.overrides.set(asNodeId('a'), { alpha: 0.01 });
    scene.overrides.commit();
    expect(pickAt(scene, 5, 5)).toEqual(['a']);
  });

  it("reads the view's alphaFor, not just the override", () => {
    const scene = rectScene();
    // Scoping-dim to nothing in this view only.
    expect(pickAt(scene, 5, 5, { alphaOf: (id) => (id === 'a' ? 0 : 1) })).toEqual([]);
    // A second view over the same scene is unaffected.
    expect(pickAt(scene, 5, 5)).toEqual(['a']);
  });

  it('multiplies the two sources the way the painter does', () => {
    const scene = rectScene();
    scene.overrides.set(asNodeId('a'), { alpha: 0 });
    scene.overrides.commit();
    // alphaFor says 1, the override says 0 — the product is 0.
    expect(pickAt(scene, 5, 5, {
      alphaOf: (id) => 1 * (scene.overrides.get(asNodeId(id))?.alpha ?? 1),
    })).toEqual([]);
  });
});

describe('pickWalk — layers', () => {
  it('does not pick a node on a layer the scene has hidden', () => {
    const scene = rectScene();
    scene.setLayerVisible('main', false);
    expect(pickAt(scene, 5, 5)).toEqual([]);
  });

  it("does not pick a node on a layer the view does not paint", () => {
    const scene = rectScene();
    // The scene shows `main`; this view's layer order leaves it out.
    expect(pickAt(scene, 5, 5, { layerIsPainted: (l) => l !== 'main' })).toEqual([]);
  });

  it("a view's layer filter never resurrects a layer the scene hid", () => {
    const scene = rectScene();
    scene.setLayerVisible('main', false);
    expect(pickAt(scene, 5, 5, { layerIsPainted: () => true })).toEqual([]);
  });

  it('only an explicit false hides a layer', () => {
    expect(hiddenLayerIds([{ id: 'a' }, { id: 'b', visible: false }])).toEqual(new Set(['b']));
  });
});

describe('pickWalk — order and clips', () => {
  it('returns back-to-front, so the last element is the topmost', () => {
    const scene = rectScene();
    expect(pickAt(scene, 25, 25)).toEqual(['a', 'b']);
  });

  it('resolves each container clip once per query, however many children ask', () => {
    const scene = createScene<{ kind: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    let clipCalls = 0;
    scene.add({
      kind: 'container', layer: 'main', id: asNodeId('box'),
      pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'rect' },
      clipFromPose: (p): Path => {
        clipCalls++;
        return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
      },
    });
    for (const id of ['c1', 'c2', 'c3'].map(asNodeId)) {
      scene.add({
        kind: 'leaf', layer: 'main', id, parent: asNodeId('box'),
        pose: { x: 10, y: 10, width: 20, height: 20 }, data: { kind: 'rect' },
      });
    }
    const hits = pickAt(scene, 15, 15);
    expect(hits).toEqual(['box', 'c1', 'c2', 'c3']);
    expect(clipCalls).toBe(1);
  });
});

describe('the four walks agree', () => {
  /**
   * The point walks and the area walks are different questions, so they cannot
   * be compared hit-for-hit. What they must agree on is *eligibility*: a node
   * gated out for one is gated out for all. These cases each disable a node by
   * one gate and assert every walk drops it.
   */
  const gates = [
    {
      name: 'a hidden layer',
      apply: (s: ReturnType<typeof rectScene>) => s.setLayerVisible('main', false),
    },
    {
      name: 'alpha 0',
      apply: (s: ReturnType<typeof rectScene>) => {
        s.overrides.set(asNodeId('a'), { alpha: 0 });
        s.overrides.set(asNodeId('b'), { alpha: 0 });
        s.overrides.commit();
      },
    },
  ];

  for (const gate of gates) {
    it(`drops a node gated out by ${gate.name} — point walk and area walk both`, () => {
      const scene = rectScene();
      const adapter = sceneToAdapter(scene);
      const wholeScene = { x: -10, y: -10, width: 200, height: 200 };

      // Before: every walk sees both nodes.
      expect(pickAt(scene, 25, 25)).toEqual(['a', 'b']);
      expect([...hitTestArea(scene as never, wholeScene)].sort()).toEqual(['a', 'b']);
      expect([...adapter.hitTestArea!(wholeScene)].sort()).toEqual(['a', 'b']);

      gate.apply(scene);

      expect(pickAt(scene, 25, 25)).toEqual([]);
      expect(hitTestArea(scene as never, wholeScene)).toEqual([]);
      expect(adapter.hitTestArea!(wholeScene)).toEqual([]);
    });
  }

  it('every walk reads the override pose, not the document pose', () => {
    const scene = rectScene();
    const adapter = sceneToAdapter(scene);
    const far = { x: 500, y: 500, width: 50, height: 50 };

    scene.overrides.set(asNodeId('a'), { pose: { x: 510, y: 510, width: 10, height: 10 } });
    scene.overrides.commit();

    // The point walk finds it where the override draws it, not at (0,0).
    expect(pickAt(scene, 515, 515)).toEqual(['a']);
    expect(pickAt(scene, 5, 5)).toEqual([]);
    // Both area walks agree.
    expect(hitTestArea(scene as never, far)).toEqual(['a']);
    expect(adapter.hitTestArea!(far)).toEqual(['a']);
  });
});

/**
 * A container's scroll offset is view state: the view-side fold moves its
 * children by it, and the document fold never sees it.
 */
import { describe, expect, it, vi } from 'vitest';
import { createScene } from './scene';
import {
  RECT_POSE_COMPOSITION,
  RIGID_POSE_COMPOSITION,
  composeChildFrame,
  composeWorldPose,
  rebaseLocalPose,
  scrollRigidPose,
  translateRectPose,
} from './composePose';
import { expectSamePose } from './frameFixture';
import { scenePoseAdapter, sceneViewPoseAdapter } from './scenePoseAdapter';
import type { PoseAdapter } from './composeFrame';
import { createScrollOffsets, scrolledFrames } from './scrollOffsets';
import { documentOf } from './documentOf';
import type { NodeId, RectPose } from './types';

/** The scene's view-side and document folds, at its pose type. */
const viewOf = (scene: unknown) => sceneViewPoseAdapter(scene as never) as PoseAdapter<RectPose>;
const docOf = (scene: unknown) => scenePoseAdapter(scene as never) as PoseAdapter<RectPose>;

const box = (x: number, y: number, w = 10, h = 10, rotation?: number): RectPose =>
  rotation === undefined ? { x, y, width: w, height: h } : { x, y, width: w, height: h, rotation };

function sceneWith(composition = RIGID_POSE_COMPOSITION) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition });
  const c = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(100, 100, 50, 50) });
  const s = scene.add({ kind: 'mark', parent: c, layer: 'main', data: {}, pose: box(10, 60) });
  return { scene, c, s };
}

describe('createScrollOffsets', () => {
  it('stores, clears on zero or null, and notifies only on a change', () => {
    const store = createScrollOffsets();
    const heard = vi.fn();
    store.subscribe(heard);
    const id = 'c' as NodeId;
    store.set(id, { x: 0, y: 40 });
    store.set(id, { x: 0, y: 40 });
    expect(store.get(id)).toEqual({ x: 0, y: 40 });
    expect(heard).toHaveBeenCalledTimes(1);
    store.set(id, { x: 0, y: 0 });
    expect(store.get(id)).toBeUndefined();
    store.set(id, null);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(store.getGeneration()).toBe(2);
  });
});

describe('scrollRigidPose', () => {
  it('composes a child where the unscrolled frame puts it moved by minus the offset in the frame axes', () => {
    const frames: RectPose[] = [
      box(20, 30, 80, 40),
      box(20, 30, 80, 40, Math.PI / 3),
      { ...box(20, 30, 80, 40, 0.4), transform: [1.5, 0.2, -0.1, 0.8] },
    ];
    const child = box(5, 7, 12, 9, 0.25);
    const offset = { x: 13, y: -21 };
    for (const f of frames) {
      expectSamePose(
        RIGID_POSE_COMPOSITION.compose(scrollRigidPose(f, offset), child),
        RIGID_POSE_COMPOSITION.compose(f, translateRectPose(child, -offset.x, -offset.y)),
      );
    }
  });
});

describe('the view-side fold', () => {
  it('moves a scrolled container\'s children and leaves the container and the document fold alone', () => {
    const { scene, c, s } = sceneWith();
    scene.scroll.set(c, { x: 0, y: 40 });
    const view = viewOf(scene);
    const doc = docOf(scene);
    const { compose } = scene.composition;
    expectSamePose(composeWorldPose(view, s, compose), box(110, 120, 10, 10, 0));
    expectSamePose(composeWorldPose(doc, s, compose), box(110, 160, 10, 10, 0));
    expect(composeWorldPose(view, c, compose)).toEqual(composeWorldPose(doc, c, compose));
    expectSamePose(composeChildFrame(view, c, compose), box(100, 60, 50, 50, 0));
  });

  it('writes back through the same fold, so a shown pose stores the content position', () => {
    const { scene, c, s } = sceneWith();
    scene.scroll.set(c, { x: 0, y: 40 });
    const view = viewOf(scene);
    const pc = scene.composition;
    const shown = composeWorldPose(view, s, pc.compose);
    expectSamePose(rebaseLocalPose(view, shown, c, pc.compose, pc.decompose), box(10, 60, 10, 10, 0));
  });

  it('scrolls along a turned container\'s axes', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition: RIGID_POSE_COMPOSITION });
    const c = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 100, 100, Math.PI / 2) });
    const s = scene.add({ kind: 'mark', parent: c, layer: 'main', data: {}, pose: box(45, 45) });
    scene.scroll.set(c, { x: 0, y: 20 });
    // The content moves up its own axis, which a quarter turn points at +x world.
    expectSamePose(composeWorldPose(viewOf(scene), s, scene.composition.compose) as RectPose,
      box(65, 45, 10, 10, Math.PI / 2));
  });

  it('works under a translation-only composition', () => {
    const { scene, c, s } = sceneWith(RECT_POSE_COMPOSITION);
    scene.scroll.set(c, { x: 5, y: 40 });
    expectSamePose(composeWorldPose(viewOf(scene), s, scene.composition.compose) as RectPose,
      box(105, 120));
  });

  it('is absent for a documentOf view, which reads as the document holds it', () => {
    const { scene, c } = sceneWith();
    scene.scroll.set(c, { x: 0, y: 40 });
    expect(scrolledFrames(scene)).toBeDefined();
    expect(scrolledFrames(documentOf(scene))).toBeUndefined();
  });

  it('is never undone, never serialized, and cleared by loadState', () => {
    const { scene, c } = sceneWith();
    const version = scene.getVersion();
    scene.scroll.set(c, { x: 0, y: 40 });
    expect(scene.getVersion()).toBe(version);
    expect(scene.canUndo()).toBe(true); // the adds, not the scroll
    expect(JSON.stringify(scene.toJSON())).not.toContain('scroll');
    scene.loadState(scene.toJSON());
    expect([...scene.scroll.ids()]).toEqual([]);
  });
});

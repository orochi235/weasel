import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { GesturePreviewSource } from '../../canvas/gestureBounds';
import { flattenPreviews, resolvePreviews } from './resolvePreviews';

interface Data {
  label: string;
}
interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}

const AT = (x: number): Pose => ({ x, y: 0, width: 10, height: 10 });

type TestScene = Scene<Data, 'main', Pose>;

/** A parent with two children, plus a loose leaf. */
function makeScene(): { scene: TestScene; parent: string; kid: string; other: string; loose: string } {
  const scene = createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }], initial: [] });
  const parent = scene.add({ kind: 'container', layer: 'main', pose: AT(0), data: { label: 'parent' } });
  const kid = scene.add({ kind: 'leaf', layer: 'main', pose: AT(1), data: { label: 'kid' }, parent });
  const other = scene.add({ kind: 'leaf', layer: 'main', pose: AT(2), data: { label: 'other' }, parent });
  const loose = scene.add({ kind: 'leaf', layer: 'main', pose: AT(3), data: { label: 'loose' } });
  return { scene, parent, kid, other, loose };
}

function source(
  poses: Record<string, Pose | undefined>,
  extra: Partial<GesturePreviewSource> = {},
): GesturePreviewSource {
  return {
    previewIds: () => Object.keys(poses),
    previewPose: (id) => poses[id] ?? null,
    ...extra,
  };
}

describe('resolvePreviews', () => {
  it('is empty when nothing is in flight', () => {
    const { scene } = makeScene();
    expect(resolvePreviews([], scene)).toEqual([]);
  });

  it('carries the interim pose and the committed data', () => {
    const { scene, loose } = makeScene();
    const [entry] = resolvePreviews([source({ [loose]: AT(99) })], scene);
    expect(entry?.pose).toEqual(AT(99));
    expect(entry?.data).toEqual({ label: 'loose' });
    expect(entry?.node.pose).toEqual(AT(3));
  });

  it('takes a data-only preview, keeping the committed pose', () => {
    const { scene, loose } = makeScene();
    const dataOnly: GesturePreviewSource = {
      previewIds: () => [loose],
      previewData: () => ({ label: 'edited' }),
    };
    const [entry] = resolvePreviews([dataOnly], scene);
    expect(entry?.data).toEqual({ label: 'edited' });
    expect(entry?.pose).toEqual(AT(3));
  });

  it('skips an id no source has a pose or data for', () => {
    const { scene, loose } = makeScene();
    expect(resolvePreviews([{ previewIds: () => [loose] }], scene)).toEqual([]);
  });

  it('skips an id with no node — an insert previews before it has one', () => {
    const { scene } = makeScene();
    expect(resolvePreviews([source({ 'not-a-node': AT(1) })], scene)).toEqual([]);
  });

  it('merges sources first-non-null, so a tool-side preview wins', () => {
    const { scene, loose } = makeScene();
    const [entry] = resolvePreviews(
      [source({ [loose]: AT(7) }), source({ [loose]: AT(8) })],
      scene,
    );
    expect(entry?.pose).toEqual(AT(7));
  });

  describe('subtrees', () => {
    it('nests a previewed child under its previewed parent', () => {
      const { scene, parent, kid } = makeScene();
      const roots = resolvePreviews([source({ [parent]: AT(50), [kid]: AT(51) })], scene);
      expect(roots).toHaveLength(1);
      expect(roots[0]?.id).toBe(parent);
      expect(roots[0]?.children.map((c) => c.id)).toEqual([kid]);
    });

    it('leaves a previewed child a root of its own when the parent is not previewing', () => {
      const { scene, kid } = makeScene();
      const roots = resolvePreviews([source({ [kid]: AT(50) })], scene);
      expect(roots.map((r) => r.id)).toEqual([kid]);
    });

    it('does not pull in a sibling the gesture is not previewing', () => {
      const { scene, parent, kid } = makeScene();
      const roots = resolvePreviews([source({ [parent]: AT(50), [kid]: AT(51) })], scene);
      expect(flattenPreviews(roots).map((e) => e.node.data.label)).toEqual(['parent', 'kid']);
    });

    it('flattens parents before children', () => {
      const { scene, parent, kid, other, loose } = makeScene();
      const roots = resolvePreviews(
        [source({ [parent]: AT(1), [kid]: AT(2), [other]: AT(3), [loose]: AT(4) })],
        scene,
      );
      const labels = flattenPreviews(roots).map((e) => e.node.data.label);
      expect(labels[0]).toBe('parent');
      expect(labels.slice(1, 3).sort()).toEqual(['kid', 'other']);
      expect(labels).toContain('loose');
    });
  });

  it('marks the ids a gesture merely displaces as opaque', () => {
    const { scene, loose, kid } = makeScene();
    const roots = resolvePreviews(
      [source({ [loose]: AT(5), [kid]: AT(6) }, { previewOpaqueIds: () => [kid] })],
      scene,
    );
    const byLabel = new Map(flattenPreviews(roots).map((e) => [e.node.data.label, e.opaque]));
    expect(byLabel.get('kid')).toBe(true);
    expect(byLabel.get('loose')).toBe(false);
  });
});

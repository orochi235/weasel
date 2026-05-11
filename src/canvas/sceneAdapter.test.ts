import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

interface Data { label: string; }
interface Pose { x: number; y: number; width: number; height: number; }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

describe('sceneToAdapter', () => {
  it('getNodes returns nodes in render order, hidden layers filtered', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'fg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getNodes().map((n) => n.id)).toEqual([a, b]);
    scene.setLayerVisible('bg', false);
    expect(adapter.getNodes().map((n) => n.id)).toEqual([b]);
  });

  it('getPose / setPose round-trip and record undo', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getPose(id)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    adapter.setPose(id, { x: 5, y: 5, width: 2, height: 2 });
    expect(scene.get(id)!.pose).toEqual({ x: 5, y: 5, width: 2, height: 2 });
    scene.undo();
    expect(adapter.getPose(id)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('getParent / setParent reparent through scene.move', () => {
    const scene = makeScene();
    const parent = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'p' } });
    const child = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getParent!(child)).toBeNull();
    adapter.setParent!(child, parent);
    expect(scene.get(child)!.parent).toBe(parent);
    adapter.setParent!(child, null);
    expect(scene.get(child)!.parent).toBeNull();
  });

  it('getChildren returns container children', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c2' }, parent: p });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getChildren!(p)).toEqual([c1, c2]);
    expect(adapter.getChildren!(c1)).toEqual([]);
  });

  it('getChildren(null) returns root siblings (added for reorder ops)', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'b' } });
    const c = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    expect(adapter.getChildren!(null)).toEqual([a, b, c]);
  });

  it('hitTestLasso routes through polygon helpers per mode', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 20, y: 0, width: 10, height: 10 }, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    // Polygon enclosing only A.
    const poly = [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }];
    expect(adapter.hitTestLasso!(poly, 'centers').sort()).toEqual([a].sort());
    // Wide polygon — both fully inside.
    const wide = [{ x: -5, y: -5 }, { x: 35, y: -5 }, { x: 35, y: 15 }, { x: -5, y: 15 }];
    expect(adapter.hitTestLasso!(wide, 'enclosed').sort()).toEqual([a, b].sort());
    // Degenerate.
    expect(adapter.hitTestLasso!([{ x: 0, y: 0 }, { x: 1, y: 1 }], 'intersect')).toEqual([]);
  });

  it('setChildOrder reorders root siblings via scene.batch (single undo entry)', () => {
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'b' } });
    const c = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' } });
    const adapter = sceneToAdapter(scene);
    // Bring 'a' to the front by writing the new order [b, c, a].
    adapter.setChildOrder!(null, [b, c, a]);
    expect([...scene.roots]).toEqual([b, c, a]);
    // One undo step rolls the batch back.
    scene.undo();
    expect([...scene.roots]).toEqual([a, b, c]);
  });

  it('setChildOrder reorders container children', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c2' }, parent: p });
    const adapter = sceneToAdapter(scene);
    adapter.setChildOrder!(p, [c2, c1]);
    expect(adapter.getChildren!(p)).toEqual([c2, c1]);
  });

  it('getLayers returns visible layers in order, reflects visibility changes', () => {
    const scene = makeScene();
    const adapter = sceneToAdapter(scene);
    expect(adapter.getLayers!().map((l) => l.id)).toEqual(['bg', 'fg']);
    expect(adapter.getLayers!().every((l) => l.visible)).toBe(true);
    scene.setLayerVisible('bg', false);
    const after = adapter.getLayers!();
    expect(after.find((l) => l.id === 'bg')?.visible).toBe(false);
    expect(after.find((l) => l.id === 'fg')?.visible).toBe(true);
  });

  it('applyBatch wraps ops in scene.batch (single undo entry)', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } });
    const adapter = sceneToAdapter(scene);
    const before = scene.canUndo();
    expect(before).toBe(true); // from add
    // Two-op batch via inline Op shims
    adapter.applyBatch!(
      [
        { apply: (a) => (a as typeof adapter).setPose(id, { x: 1, y: 1, width: 1, height: 1 }), invert: () => ({ apply: () => {}, invert: () => ({} as never) }) },
        { apply: (a) => (a as typeof adapter).setPose(id, { x: 2, y: 2, width: 1, height: 1 }), invert: () => ({ apply: () => {}, invert: () => ({} as never) }) },
      ],
      'drag',
    );
    expect(scene.get(id)!.pose).toEqual({ x: 2, y: 2, width: 1, height: 1 });
    // One additional undo entry (the batch), even though two setPose calls happened.
    scene.undo();
    expect(scene.get(id)!.pose).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('hitTestArea respects ancestor clipFromPose', () => {
    // Bed with clip rect at (25..75, 25..75); two children: one in the corner (outside clip), one in center (inside).
    // Marquee covers the entire bed.
    const scene = createScene<Data, 'bg', Pose>({
      systemLayers: [{ id: 'bg' }],
    });
    const bed = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { label: 'bed' },
      clipFromPose: () => ({ kind: 'rect', x: 25, y: 25, width: 50, height: 50 }),
    });
    scene.add({
      kind: 'leaf', layer: 'bg', parent: bed,
      pose: { x: 5, y: 5, width: 10, height: 10 },
      data: { label: 'corner' },
    });
    scene.add({
      kind: 'leaf', layer: 'bg', parent: bed,
      pose: { x: 40, y: 40, width: 10, height: 10 },
      data: { label: 'center' },
    });
    const adapter = sceneToAdapter(scene);
    const hits = adapter.hitTestArea!({ x: 0, y: 0, width: 100, height: 100 });
    const labels = hits.map((id) => scene.get(id as never)!.data.label);
    expect(labels).toContain('center');     // inside clip
    expect(labels).not.toContain('corner'); // outside clip
  });

  it('hitTestLasso respects ancestor clipFromPose', () => {
    const scene = createScene<Data, 'bg', Pose>({
      systemLayers: [{ id: 'bg' }],
    });
    const bed = scene.add({
      kind: 'container', layer: 'bg',
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { label: 'bed' },
      clipFromPose: () => ({ kind: 'rect', x: 25, y: 25, width: 50, height: 50 }),
    });
    scene.add({
      kind: 'leaf', layer: 'bg', parent: bed,
      pose: { x: 5, y: 5, width: 10, height: 10 },
      data: { label: 'corner' },
    });
    scene.add({
      kind: 'leaf', layer: 'bg', parent: bed,
      pose: { x: 40, y: 40, width: 10, height: 10 },
      data: { label: 'center' },
    });
    const adapter = sceneToAdapter(scene);
    const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const hits = adapter.hitTestLasso!(poly, 'intersect');
    const labels = hits.map((id) => scene.get(id as never)!.data.label);
    expect(labels).toContain('center');
    expect(labels).not.toContain('corner');
  });

  it('clipFromPose is called once per query (cached during walk)', () => {
    const scene = createScene<Data, 'bg', Pose>({
      systemLayers: [{ id: 'bg' }],
    });
    let callCount = 0;
    const bed = scene.add({
      kind: 'container', layer: 'bg',
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { label: 'bed' },
      clipFromPose: () => { callCount++; return { kind: 'rect', x: 25, y: 25, width: 50, height: 50 }; },
    });
    for (let i = 0; i < 5; i++) {
      scene.add({
        kind: 'leaf', layer: 'bg', parent: bed,
        pose: { x: i * 10, y: 30, width: 5, height: 5 },
        data: { label: `p${i}` },
      });
    }
    const adapter = sceneToAdapter(scene);
    callCount = 0;
    adapter.hitTestArea!({ x: 0, y: 0, width: 100, height: 100 });
    expect(callCount).toBe(1);  // called once for the bed, not 5 times
  });
});

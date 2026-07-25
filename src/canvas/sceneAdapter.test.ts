import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useClipboardOps } from 'interactions/actions/clipboard/clipboardOps';
import { sceneToAdapter } from './sceneAdapter';

interface Data { label: string; }
interface Pose { x: number; y: number; width: number; height: number; }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

describe('sceneToAdapter', () => {
  it('commitInsert returns a node spec without mutating the scene (InsertDemo regression)', () => {
    // useInsert.onEnd calls adapter.commitInsert AND dispatches an InsertOp
    // whose apply() calls adapter.insertNode. If commitInsert itself mutates
    // the scene, the InsertOp's insertNode collides on id, the throw skips
    // dispatcher.endGesture(), and the next pointerdown is dropped because
    // inFlight is still set. The contract: commitInsert is a pure factory
    // — only the InsertOp performs the actual scene.add.
    const scene = makeScene();
    const adapter = sceneToAdapter(scene, {
      commitInsert: (b) => ({
        pose: { x: b.x, y: b.y, width: b.width, height: b.height },
        data: { label: 'rect-0' },
        id: 'fixture-0',
      }),
      insertLayer: 'bg',
    });
    const node = adapter.commitInsert!({ x: 1, y: 2, width: 10, height: 20 });
    expect(scene.nodes.has('fixture-0' as never)).toBe(false);
    expect(node).toMatchObject({ kind: 'leaf', id: 'fixture-0', layer: 'bg' });
    expect(node!.pose).toEqual({ x: 1, y: 2, width: 10, height: 20 });
    // The InsertOp path is what actually adds — exercise it.
    adapter.insertNode!(node!);
    expect(scene.nodes.has('fixture-0' as never)).toBe(true);
  });

  it('insertNode forwards the index arg so re-insert restores z-order', () => {
    // `createInsertOp.apply` calls `insertNode(node, index)`; undo of a
    // multi-delete relies on the index to restore paint order instead of
    // appending. Insert `c` at index 1 → it must land between a and b.
    const scene = makeScene();
    const a = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'a' } });
    const b = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'b' } });
    const adapter = sceneToAdapter(scene);
    adapter.insertNode!(
      { kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'c' }, id: 'c', parent: null } as never,
      1,
    );
    expect(adapter.getNodes().map((n) => n.id)).toEqual([a, 'c', b]);
  });

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

  it('applyOps records the batch as a single undo entry', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { label: 'x' } });
    const adapter = sceneToAdapter(scene);
    const before = scene.canUndo();
    expect(before).toBe(true); // from add
    // Two-op batch via inline Op shims. The scene's history engine records
    // the external ops themselves (not the decomposed kit:setPose calls), so
    // undo replays each op's invert() against the adapter — the inverts must
    // be real, not stubs.
    const mkSet = (from: Pose, to: Pose) => ({
      apply: (a: unknown) => { (a as typeof adapter).setPose(id, to); },
      invert: () => mkSet(to, from),
    });
    adapter.applyOps!(
      [
        mkSet({ x: 0, y: 0, width: 1, height: 1 }, { x: 1, y: 1, width: 1, height: 1 }),
        mkSet({ x: 1, y: 1, width: 1, height: 1 }, { x: 2, y: 2, width: 1, height: 1 }),
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

// ─── I3: walkClipAware gates containers on ancestor clips ─────────────────────

describe('I3: walkClipAware gates containers on ancestor clips', () => {
  // 3-deep nesting: region → bed → leaf.
  // region has a clip at (50..100, 50..100).
  // bed is at (0..30, 0..30) — OUTSIDE the region clip.
  // leaf is at (5..15, 5..15) — INSIDE the bed but OUTSIDE the region clip.
  // Query rect covers the full 200×200 area.
  // Expected: neither bed nor leaf should be in the results.
  it('excludes container and its children when container is outside ancestor clip', () => {
    const scene = createScene<Data, 'bg', Pose>({
      systemLayers: [{ id: 'bg' }],
    });
    // region: 200×200 with a narrow clip at (50..100, 50..100)
    const region = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: 0, y: 0, width: 200, height: 200 },
      data: { label: 'region' },
      clipFromPose: () => ({ kind: 'rect', x: 50, y: 50, width: 50, height: 50 }),
    });
    // bed: entirely inside the region's AABB but outside the clip.
    const bed = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: 0, y: 0, width: 30, height: 30 },
      data: { label: 'bed' },
      parent: region,
    });
    // leaf: inside the bed, also outside the region clip.
    const leaf = scene.add({
      kind: 'leaf',
      layer: 'bg',
      pose: { x: 5, y: 5, width: 10, height: 10 },
      data: { label: 'leaf' },
      parent: bed,
    });

    const adapter = sceneToAdapter(scene);
    const hits = adapter.hitTestArea!({ x: 0, y: 0, width: 200, height: 200 });
    const ids = new Set(hits);

    // region is the top-level container: no ancestor clips, so it's included
    // if its AABB passes the query rect (it does: full 200×200).
    expect(ids.has(region)).toBe(true);

    // bed is a child of region; region's clip excludes it — not included.
    expect(ids.has(bed)).toBe(false);

    // leaf is a grandchild; also excluded because bed (its parent) is excluded.
    expect(ids.has(leaf)).toBe(false);
  });

  it('includes container and leaf when they are inside the ancestor clip', () => {
    const scene = createScene<Data, 'bg', Pose>({
      systemLayers: [{ id: 'bg' }],
    });
    const region = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: 0, y: 0, width: 200, height: 200 },
      data: { label: 'region' },
      clipFromPose: () => ({ kind: 'rect', x: 50, y: 50, width: 100, height: 100 }),
    });
    // bed: inside the region clip (60..120, 60..120).
    const bed = scene.add({
      kind: 'container',
      layer: 'bg',
      pose: { x: 60, y: 60, width: 60, height: 60 },
      data: { label: 'bed' },
      parent: region,
    });
    const leaf = scene.add({
      kind: 'leaf',
      layer: 'bg',
      pose: { x: 65, y: 65, width: 10, height: 10 },
      data: { label: 'leaf' },
      parent: bed,
    });

    const adapter = sceneToAdapter(scene);
    const hits = adapter.hitTestArea!({ x: 0, y: 0, width: 200, height: 200 });
    const ids = new Set(hits);

    expect(ids.has(region)).toBe(true);
    expect(ids.has(bed)).toBe(true);
    expect(ids.has(leaf)).toBe(true);
  });
});

// ─── Clipboard seam: snapshotSelection / commitPaste / getPasteOffset ─────────

/** Adapter-shaped snapshot item, as captured from a scene node. */
interface SnapItem {
  kind: 'leaf' | 'container';
  id: string;
  layer: string;
  parent: string | null;
  pose: Pose;
  data: Data;
  children?: string[];
}

describe('clipboard seam', () => {
  it('snapshotSelection captures a leaf as a deep copy (mutation does not touch the scene)', () => {
    const scene = makeScene();
    const id = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 10, y: 20, width: 30, height: 40 }, data: { label: 'a' } });
    const adapter = sceneToAdapter(scene);
    const snap = adapter.snapshotSelection!([id]);
    const items = snap.items as SnapItem[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'leaf', id, layer: 'bg', parent: null });
    expect(items[0].pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(items[0].data).toEqual({ label: 'a' });
    // Copies, not references into the scene.
    expect(items[0].pose).not.toBe(scene.get(id)!.pose);
    expect(items[0].data).not.toBe(scene.get(id)!.data);
    items[0].pose.x = 999;
    items[0].data.label = 'mutated';
    expect(scene.get(id)!.pose.x).toBe(10);
    expect(scene.get(id)!.data.label).toBe('a');
  });

  it('snapshotSelection captures a container subtree parents-first and dedupes selected descendants', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 10, y: 10, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 20, y: 20, width: 5, height: 5 }, data: { label: 'c2' }, parent: p });
    const adapter = sceneToAdapter(scene);
    // c1 listed alongside its selected ancestor p (and before it) — the
    // ancestor wins; c1 must not appear twice in the snapshot.
    const snap = adapter.snapshotSelection!([c1, p]);
    const items = snap.items as SnapItem[];
    expect(items.map((i) => i.id)).toEqual([p, c1, c2]);
    expect(items[0].children).toEqual([c1, c2]);
    expect(items[1].parent).toBe(p);
    expect(items[2].parent).toBe(p);
    // children array is a copy, not the live scene array.
    items[0].children!.push('bogus');
    expect(scene.childrenOf(p)).toEqual([c1, c2]);
  });

  it('commitPaste mints fresh ids, remaps parents/children, translates the whole subtree, and does not insert', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 10, y: 10, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 15, y: 15, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 30, y: 30, width: 5, height: 5 }, data: { label: 'c2' }, parent: p });
    const adapter = sceneToAdapter(scene);
    const snap = adapter.snapshotSelection!([p]);
    const nodeCountBefore = scene.nodes.size;

    const created = adapter.commitPaste!(snap, { dx: 12, dy: 12 }) as unknown as SnapItem[];
    expect(created).toHaveLength(3);

    // Fresh ids: paste-prefixed, unique, disjoint from the originals.
    const newIds = created.map((n) => n.id);
    for (const id of newIds) expect(id).toMatch(/^paste-/);
    expect(new Set(newIds).size).toBe(3);
    for (const id of [p, c1, c2]) expect(newIds).not.toContain(id);

    // Parents-before-children; internal parent refs remapped onto fresh ids.
    const [np, nc1, nc2] = created;
    expect(np.kind).toBe('container');
    expect(np.parent).toBeNull();
    expect(nc1.parent).toBe(np.id);
    expect(nc2.parent).toBe(np.id);
    expect(np.children).toEqual([nc1.id, nc2.id]);

    // Scene v1 poses are absolute (see sceneAdapter's cascade notes), so the
    // subtree translates rigidly: every node shifts by the offset.
    expect(np.pose).toEqual({ x: 22, y: 22, width: 100, height: 100 });
    expect(nc1.pose).toEqual({ x: 27, y: 27, width: 5, height: 5 });
    expect(nc2.pose).toEqual({ x: 42, y: 42, width: 5, height: 5 });

    // commitPaste is a pure factory — insertion happens via the hook's
    // InsertOps, never here.
    expect(scene.nodes.size).toBe(nodeCountBefore);
    for (const id of newIds) expect(scene.nodes.has(id as never)).toBe(false);
  });

  it('commitPaste turns items whose parent is outside the snapshot into roots', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 10, y: 10, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    const adapter = sceneToAdapter(scene);
    // Snapshot the child alone: its captured parent (p) is not in the snapshot.
    const snap = adapter.snapshotSelection!([c1]);
    expect((snap.items as SnapItem[])[0].parent).toBe(p);
    const created = adapter.commitPaste!(snap, { dx: 12, dy: 12 }) as unknown as SnapItem[];
    expect(created).toHaveLength(1);
    expect(created[0].parent).toBeNull();
    expect(created[0].pose).toEqual({ x: 22, y: 22, width: 5, height: 5 });
  });

  it('commitPaste uses ctx.dropPoint as the cluster origin, ignoring the offset', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 10, y: 10, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 12, y: 12, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    void c1;
    const adapter = sceneToAdapter(scene);
    const snap = adapter.snapshotSelection!([p]);
    const created = adapter.commitPaste!(
      snap,
      { dx: 12, dy: 12 },
      { dropPoint: { worldX: 100, worldY: 50 } },
    ) as unknown as SnapItem[];
    // Cluster origin (root bounds min corner: 10,10) lands on the drop point;
    // the subtree rides along rigidly.
    expect(created[0].pose).toMatchObject({ x: 100, y: 50 });
    expect(created[1].pose).toMatchObject({ x: 102, y: 52 });
  });

  it('getPasteOffset returns the constant cascade offset', () => {
    const scene = makeScene();
    const adapter = sceneToAdapter(scene);
    expect(adapter.getPasteOffset!({ items: [] })).toEqual({ dx: 12, dy: 12 });
  });

  it('round-trips copy → paste through useClipboardOps: subtree inserted, one undo entry, selection = new ids', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'container', layer: 'bg', pose: { x: 10, y: 10, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 15, y: 15, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'leaf', layer: 'bg', pose: { x: 30, y: 30, width: 5, height: 5 }, data: { label: 'c2' }, parent: p });
    let selection: string[] = [p];
    const adapter = sceneToAdapter(scene, {
      selection: { get: () => selection, set: (ids) => { selection = [...ids]; } },
    });
    const { result } = renderHook(() =>
      useClipboardOps(adapter, { getSelection: () => selection as NodeId[] }),
    );

    act(() => { result.current.copy(); });
    const nodeCountBefore = scene.nodes.size;
    const entriesBefore = scene.historyEntries().length;
    act(() => { result.current.paste(); });

    // The whole subtree exists as fresh nodes.
    expect(scene.nodes.size).toBe(nodeCountBefore + 3);
    const newIds = [...scene.nodes.keys()].filter((id) => String(id).startsWith('paste-'));
    expect(newIds).toHaveLength(3);
    const newContainer = newIds.map((id) => scene.get(id)!).find((n) => n.kind === 'container')!;
    expect(newContainer).toBeDefined();
    expect(scene.childrenOf(newContainer.id)).toHaveLength(2);
    for (const cid of scene.childrenOf(newContainer.id)) {
      expect(String(cid)).toMatch(/^paste-/);
      expect(scene.get(cid)!.parent).toBe(newContainer.id);
    }
    // Originals untouched.
    for (const id of [p, c1, c2]) expect(scene.nodes.has(id)).toBe(true);

    // Selection moved to the pasted ids.
    expect([...selection].sort()).toEqual(newIds.map(String).sort());

    // ONE undo entry for the whole paste; undo removes the entire subtree.
    expect(scene.historyEntries().length).toBe(entriesBefore + 1);
    scene.undo();
    expect(scene.nodes.size).toBe(nodeCountBefore);
    for (const id of newIds) expect(scene.nodes.has(id)).toBe(false);
  });
});

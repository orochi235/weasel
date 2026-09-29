/**
 * `<SceneCanvas>` publishes a working `slice` dep over its own scene, so the
 * kit slice tool cuts with nothing else wired.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { boundsOfPath, rectPath, type Path } from '@weasel-js/geom';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import { useSliceTool } from 'tools/builtin/slice';
import { useSliceDep } from './slice';
import { RECT_POSE_COMPOSITION, RIGID_POSE_COMPOSITION, type PoseComposition } from 'features/groups/composePose';
import type { SliceDep } from 'interactions/actions/depSchema';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { pathInWorld } from 'features/paths/pathInWorld';

afterEach(() => { cleanup(); });

interface Data { path?: Path; fill?: string }
type Layer = 'main';
type S = Scene<Data, Layer, RectPose>;

const across = [{ x: -10, y: 50 }, { x: 110, y: 50 }];

function makeScene(): S {
  const scene = createScene<Data, Layer, RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: asNodeId('sq'), kind: 'leaf', layer: 'main',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { path: rectPath(0, 0, 100, 100), fill: 'red' },
  });
  return scene;
}

const leaves = (scene: S) =>
  [...scene.renderOrder()].map((id) => scene.get(id)!).filter((n) => n.kind === 'leaf');

function mount(scene: S, opts: {
  override?: SliceDep;
  poseComposition?: PoseComposition<RectPose>;
  poseDescriptor?: PoseDescriptor<RectPose>;
  select?: string[];
} = {}) {
  let reg!: DepRegistry;
  let sel!: SelectionApi;
  function Capture() {
    reg = useDepRegistry();
    return null;
  }
  function Override({ dep }: { dep: SliceDep }) {
    useSliceDep(dep);
    return null;
  }
  function Harness() {
    const slice = useSliceTool();
    sel = useSelection({ scene: scene as never, initial: (opts.select ?? []) as NodeId[] });
    return (
      <SceneCanvas<Data, Layer, RectPose>
        features={['draw']}
        scene={scene}
        selection={sel}
        layers={{}}
        width={400}
        height={400}
        tools={{ slice }}
        {...(opts.poseComposition ? { poseComposition: opts.poseComposition } : {})}
        {...(opts.poseDescriptor ? { poseDescriptor: opts.poseDescriptor } : {})}
      >
        <Capture />
        {opts.override ? <Override dep={opts.override} /> : null}
      </SceneCanvas>
    );
  }
  const { container } = render(<Harness />);
  const commit = (cut: { x: number; y: number }[]) =>
    act(() => { ((reg.get as (n: string) => unknown)('slice') as SliceDep).commit(cut); });
  return { commit, selection: () => sel, canvas: container.querySelector('canvas')! };
}

describe('the default slice dep', () => {
  it('swaps a crossed leaf for its pieces, carrying its paint, as one undo step', () => {
    const scene = makeScene();
    const { commit } = mount(scene);
    const depth = scene.historyIndex();
    commit(across);
    const after = leaves(scene);
    expect(after.map((n) => n.id)).not.toContain('sq');
    expect(after).toHaveLength(2);
    for (const n of after) expect(n.data.fill).toBe('red');
    expect(scene.historyIndex()).toBe(depth + 1);

    act(() => { scene.undo(); });
    expect(leaves(scene).map((n) => n.id)).toEqual(['sq']);
  });

  it('cuts a closed loop out of the fill as its own piece', () => {
    const scene = makeScene();
    const { commit } = mount(scene);
    commit([{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 70 }, { x: 30, y: 70 }, { x: 30, y: 30 }]);
    const poses = leaves(scene).map((n) => n.pose);
    expect(poses).toContainEqual({ x: 30, y: 30, width: 40, height: 40 });
    expect(poses).toContainEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('carries the selection over to the pieces of a selected source', () => {
    const scene = makeScene();
    const { commit, selection } = mount(scene, { select: ['sq'] });
    commit(across);
    const ids = leaves(scene).map((n) => n.id);
    expect([...selection().get()].sort()).toEqual([...ids].sort());
  });

  it('leaves a node on a locked layer uncut', () => {
    const scene = makeScene();
    scene.setLayerLocked('main', true);
    const { commit } = mount(scene);
    const depth = scene.historyIndex();
    commit(across);
    expect(leaves(scene).map((n) => n.id)).toEqual(['sq']);
    expect(scene.historyIndex()).toBe(depth);
  });

  it('cuts a child in world space and stores its pieces in the parent frame', () => {
    const scene = createScene<Data, Layer, RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ id: asNodeId('g'), kind: 'container', layer: 'main', pose: { x: 200, y: 200, width: 100, height: 100 }, data: {} });
    scene.add({
      id: asNodeId('kid'), kind: 'leaf', layer: 'main', parent: g,
      pose: { x: 0, y: 0, width: 100, height: 100 },
      data: { path: rectPath(0, 0, 100, 100) },
    });
    const { commit } = mount(scene, { poseComposition: RECT_POSE_COMPOSITION });
    commit([{ x: 190, y: 250 }, { x: 310, y: 250 }]);
    const kids = scene.childrenOf(g).map((id) => scene.get(id)!);
    expect(kids).toHaveLength(2);
    expect(kids.map((n) => n.pose).sort((a, b) => a.y - b.y)).toEqual([
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 100, height: 50 },
    ]);
    for (const k of kids) expect(boundsOfPath(k.data.path!).height).toBe(50);
  });

  describe('under a transformed pose', () => {
    const vertical = [{ x: 50, y: -10 }, { x: 50, y: 110 }];
    const quarter = Math.PI / 2;

    function single(pose: RectPose, path: Path = rectPath(0, 0, 100, 100)): S {
      const scene = createScene<Data, Layer, RectPose>({ systemLayers: [{ id: 'main' }] });
      scene.add({ id: asNodeId('sq'), kind: 'leaf', layer: 'main', pose, data: { path } });
      return scene;
    }
    const drawn = (pose: RectPose, path: Path) => boundsOfPath(pathInWorld(path, pose));
    function expectBoxes(actual: { x: number; y: number; width: number; height: number }[], expected: typeof actual) {
      const order = (bs: typeof actual) => [...bs].sort((a, b) => a.x - b.x || a.y - b.y);
      const a = order(actual), e = order(expected);
      expect(a).toHaveLength(e.length);
      a.forEach((b, i) => {
        for (const k of ['x', 'y', 'width', 'height'] as const) expect(b[k]).toBeCloseTo(e[i]![k], 4);
      });
    }

    it('cuts a rotated leaf where it is drawn, and its pieces keep the rotation in their poses', () => {
      const scene = single({ x: 0, y: 0, width: 100, height: 100, rotation: quarter });
      const { commit } = mount(scene);
      commit(vertical);
      const pieces = leaves(scene);
      for (const n of pieces) expect(n.pose.rotation).toBeCloseTo(quarter);
      expectBoxes(pieces.map((n) => drawn(n.pose, n.data.path!)), [
        { x: 0, y: 0, width: 50, height: 100 },
        { x: 50, y: 0, width: 50, height: 100 },
      ]);
      // Along the leaf's own axes the cut is horizontal, so each piece is the
      // full width and half the height of the unrotated box.
      for (const n of pieces) {
        expect(n.pose.width).toBeCloseTo(100);
        expect(n.pose.height).toBeCloseTo(50);
      }
    });

    it('cuts a leaf whose pose stretches its path, and stores each piece at the size it is drawn', () => {
      const scene = single({ x: 0, y: 0, width: 200, height: 100 });
      const { commit } = mount(scene);
      commit([{ x: 150, y: -10 }, { x: 150, y: 110 }]);
      const pieces = leaves(scene);
      expectBoxes(pieces.map((n) => drawn(n.pose, n.data.path!)), [
        { x: 0, y: 0, width: 150, height: 100 },
        { x: 150, y: 0, width: 50, height: 100 },
      ]);
      for (const n of pieces) {
        const b = boundsOfPath(n.data.path!);
        expect([b.width, b.height]).toEqual([n.pose.width, n.pose.height]);
      }
    });

    it('cuts a stretched, rotated leaf where it is drawn', () => {
      const scene = single({ x: -50, y: 0, width: 200, height: 100, rotation: quarter });
      const { commit } = mount(scene);
      commit([{ x: -10, y: 50 }, { x: 110, y: 50 }]);
      const pieces = leaves(scene);
      expect(pieces).toHaveLength(2);
      for (const n of pieces) expect(n.pose.rotation).toBeCloseTo(quarter);
      expectBoxes(pieces.map((n) => drawn(n.pose, n.data.path!)), [
        { x: 0, y: -50, width: 100, height: 100 },
        { x: 0, y: 50, width: 100, height: 100 },
      ]);
    });

    it('cuts a child of a rotated container in world space and stores its pieces in the container frame', () => {
      const scene = createScene<Data, Layer, RectPose>({ systemLayers: [{ id: 'main' }] });
      const g = scene.add({
        id: asNodeId('g'), kind: 'container', layer: 'main',
        pose: { x: 200, y: 200, width: 100, height: 100, rotation: quarter }, data: {},
      });
      scene.add({
        id: asNodeId('kid'), kind: 'leaf', layer: 'main', parent: g,
        pose: { x: 0, y: 0, width: 100, height: 100 },
        data: { path: rectPath(0, 0, 100, 100) },
      });
      const { commit } = mount(scene, { poseComposition: RIGID_POSE_COMPOSITION });
      commit([{ x: 190, y: 250 }, { x: 310, y: 250 }]);
      const kids = scene.childrenOf(g).map((id) => scene.get(id)!);
      expect(kids).toHaveLength(2);
      // The container is turned a quarter, so a horizontal world cut runs
      // vertically through the child's own frame.
      for (const k of kids) expect(k.pose.rotation ?? 0).toBeCloseTo(0);
      expectBoxes(kids.map((k) => k.pose), [
        { x: 0, y: 0, width: 50, height: 100 },
        { x: 50, y: 0, width: 50, height: 100 },
      ]);
    });

    it('reads a pose it cannot see into through the pose descriptor', () => {
      // Stored as a center and half-extents: no top-level x/y/width/height.
      type Centered = { cx: number; cy: number; hw: number; hh: number; turn?: number };
      const centered: PoseDescriptor<Centered> = {
        getBounds: (p) => ({ x: p.cx - p.hw, y: p.cy - p.hh, width: p.hw * 2, height: p.hh * 2 }),
        remapBounds: (p, _src, dst) => ({
          ...p, cx: dst.x + dst.width / 2, cy: dst.y + dst.height / 2, hw: dst.width / 2, hh: dst.height / 2,
        }),
        fromBounds: (b) => ({ cx: b.x + b.width / 2, cy: b.y + b.height / 2, hw: b.width / 2, hh: b.height / 2 }),
        getRotation: (p) => p.turn ?? 0,
        withRotation: (p, turn) => ({ ...p, turn }),
      };
      const scene = createScene<Data, Layer, RectPose>({ systemLayers: [{ id: 'main' }] });
      scene.add({
        id: asNodeId('c'), kind: 'leaf', layer: 'main',
        pose: { cx: 50, cy: 50, hw: 50, hh: 50, turn: quarter } as unknown as RectPose,
        data: { path: rectPath(0, 0, 100, 100) },
      });
      const { commit } = mount(scene, { poseDescriptor: centered as unknown as PoseDescriptor<RectPose> });
      commit(vertical);
      const pieces = leaves(scene);
      expect(pieces).toHaveLength(2);
      const asDrawn = pieces.map((n) => {
        const p = n.pose as unknown as Centered;
        expect(p.turn).toBeCloseTo(quarter);
        return drawn({ ...centered.getBounds(p), rotation: p.turn }, n.data.path!);
      });
      expectBoxes(asDrawn, [
        { x: 0, y: 0, width: 50, height: 100 },
        { x: 50, y: 0, width: 50, height: 100 },
      ]);
    });
  });

  it('gives way to a slice dep the consumer publishes', () => {
    const scene = makeScene();
    const own = { commit: vi.fn() };
    const { commit } = mount(scene, { override: own });
    commit(across);
    expect(own.commit).toHaveBeenCalledTimes(1);
    expect(leaves(scene).map((n) => n.id)).toEqual(['sq']);
  });

  it('is what the slice tool cuts through, with nothing else wired', () => {
    const scene = makeScene();
    const { canvas } = mount(scene);
    const pointer = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'k', code: 'KeyK' })); });
    act(() => {
      pointer('pointerdown', -10, 50);
      pointer('pointermove', 60, 50);
      pointer('pointermove', 120, 50);
      pointer('pointerup', 120, 50);
    });
    expect(leaves(scene)).toHaveLength(2);
  });
});

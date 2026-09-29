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
import { RECT_POSE_COMPOSITION, type PoseComposition } from 'features/groups/composePose';
import type { SliceDep } from 'interactions/actions/depSchema';

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

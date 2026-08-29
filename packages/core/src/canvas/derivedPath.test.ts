import { describe, it, expect, vi } from 'vitest';
import { resolveDerivedPath, scenePoseLookup, withDerivedPaths } from './derivedPath';
import { wireSceneSlotToScene } from './SceneCanvas';
import { defaultDrawOne } from './defaultDrawOne';
import { findNodeShape, type NodePaintCtx } from './NodeShape';
import { buildSceneViewCommands } from './sceneViewRender';
import { planPixelRender } from './renderSceneToPixels';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type NodeId, type RectPose } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../renderer';
import { linePath } from 'features/paths/builder';

const pose = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

type Derive = (
  node: Node<unknown, string, RectPose>,
  deps: readonly (RectPose | undefined)[],
) => Path | null;

type Data = { label?: string };

function makeNode(derive: Derive): Node<Data, 'main', RectPose> {
  return {
    id: asNodeId('edge'),
    kind: 'leaf',
    layer: 'main',
    data: {},
    parent: null,
    pose: pose(0),
    dependsOn: [asNodeId('a'), asNodeId('b')],
    derive,
  };
}

/** A scene holding two anchors and an edge deriving a line between them.
 *  `derive` reads the dependency poses it is handed, never the scene. */
function makeEdgeScene() {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', pose: pose(0), data: {} });
  const b = scene.add({ kind: 'leaf', layer: 'main', pose: pose(100), data: {} });
  const derive: Derive = (_node, deps) => {
    const [from, to] = deps;
    if (!from || !to) return null;
    return linePath({ x: from.x, y: from.y }, { x: to.x, y: to.y });
  };
  const edge = scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: pose(0),
    data: {},
    dependsOn: [a, b],
    derive,
  });
  return { scene, a, b, edge };
}

/** A `drawOne` that records its arguments and paints nothing. */
function spyDrawOne() {
  return vi.fn((
    _node: Node<Data, 'main', RectPose>,
    _pose: RectPose,
    _view: View,
    _ctx?: NodePaintCtx,
  ): DrawCommand[] => []);
}

/** Every `path` command in a DrawCommand tree, depth-first. */
function pathCommands(cmds: readonly DrawCommand[]): { kind: 'path'; path: Path }[] {
  const out: { kind: 'path'; path: Path }[] = [];
  for (const cmd of cmds) {
    if (cmd.kind === 'path') out.push(cmd as { kind: 'path'; path: Path });
    else if (cmd.kind === 'group') out.push(...pathCommands(cmd.children));
  }
  return out;
}

describe('resolveDerivedPath', () => {
  it('returns null for a node that derives from nothing', () => {
    const plain: Node<Data, 'main', RectPose> = {
      id: asNodeId('n'), kind: 'leaf', layer: 'main', data: {}, parent: null, pose: pose(0),
    };
    expect(resolveDerivedPath(plain, () => undefined)).toBeNull();
  });

  it('calls derive with dependency poses in dependsOn order', () => {
    const derive = vi.fn(() => linePath({ x: 0, y: 0 }, { x: 1, y: 1 }));
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)], [asNodeId('b'), pose(100)]]);
    resolveDerivedPath(node, (id) => poses.get(id));
    expect(derive).toHaveBeenCalledWith(node, [pose(0), pose(100)]);
  });

  it('passes undefined for a dependency that no longer resolves', () => {
    const derive = vi.fn(() => null);
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)]]);
    resolveDerivedPath(node, (id) => poses.get(id));
    expect(derive).toHaveBeenCalledWith(node, [pose(0), undefined]);
  });

  it('memoizes — a second call with unchanged poses does not re-derive', () => {
    const derive = vi.fn(() => linePath({ x: 0, y: 0 }, { x: 1, y: 1 }));
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)], [asNodeId('b'), pose(100)]]);
    const lookup = (id: NodeId) => poses.get(id);
    resolveDerivedPath(node, lookup);
    resolveDerivedPath(node, lookup);
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('re-derives once the scene drops the node\'s pose-keyed memo slots', async () => {
    const { dropPoseKeyedMemoSlots } = await import('core/scene/nodeMemo');
    const derive = vi.fn(() => linePath({ x: 0, y: 0 }, { x: 1, y: 1 }));
    const node = makeNode(derive);
    const poses = new Map([[asNodeId('a'), pose(0)], [asNodeId('b'), pose(100)]]);
    const lookup = (id: NodeId) => poses.get(id);
    resolveDerivedPath(node, lookup);
    dropPoseKeyedMemoSlots(node);
    resolveDerivedPath(node, lookup);
    expect(derive).toHaveBeenCalledTimes(2);
  });
});

describe('scenePoseLookup', () => {
  it('reads the node\'s pose', () => {
    const { scene, a } = makeEdgeScene();
    expect(scenePoseLookup(scene)(a)).toEqual(pose(0));
  });

  it('prefers an ephemeral pose override over the document pose', () => {
    const { scene, a } = makeEdgeScene();
    scene.overrides.set(a, { pose: pose(42) });
    expect(scenePoseLookup(scene)(a)).toEqual(pose(42));
  });

  it('returns undefined for an id the scene no longer holds', () => {
    const { scene } = makeEdgeScene();
    expect(scenePoseLookup(scene)(asNodeId('gone'))).toBeUndefined();
  });
});

describe('withDerivedPaths', () => {
  it('hands the resolved path to the wrapped drawOne', () => {
    const { scene, edge } = makeEdgeScene();
    const drawOne = spyDrawOne();
    const node = scene.get(edge)!;
    withDerivedPaths(scene, drawOne)(node, node.pose, VIEW);
    expect(drawOne.mock.calls[0][3]?.derivedPath)
      .toEqual(linePath({ x: 0, y: 0 }, { x: 100, y: 0 }));
  });

  it('forwards node, pose and view unchanged', () => {
    const { scene, a } = makeEdgeScene();
    const drawOne = spyDrawOne();
    const node = scene.get(a)!;
    withDerivedPaths(scene, drawOne)(node, node.pose, VIEW);
    expect(drawOne.mock.calls[0].slice(0, 3)).toEqual([node, node.pose, VIEW]);
  });

  it('resolves against the moved dependency after a setPose', () => {
    const { scene, edge, b } = makeEdgeScene();
    const drawOne = spyDrawOne();
    const wrapped = withDerivedPaths(scene, drawOne);
    const node = scene.get(edge)!;
    wrapped(node, node.pose, VIEW);
    scene.setPose(b, pose(250));
    wrapped(scene.get(edge)!, node.pose, VIEW);
    expect(drawOne.mock.calls[1][3]?.derivedPath)
      .toEqual(linePath({ x: 0, y: 0 }, { x: 250, y: 0 }));
  });
});

describe('kit:derived painter', () => {
  it('claims a node with dependencies', () => {
    const node = makeNode(() => null);
    expect(findNodeShape(node)?.id).toBe('kit:derived');
  });

  it('leaves an ordinary node to the other painters', () => {
    const plain: Node<Data, 'main', RectPose> = {
      id: asNodeId('n2'), kind: 'leaf', layer: 'main', data: {}, parent: null, pose: pose(0),
    };
    expect(findNodeShape(plain)?.id).toBe('kit:rect-fallback');
  });

  it('paints the derived path it is handed', () => {
    const node = makeNode(() => null);
    const path = linePath({ x: 0, y: 0 }, { x: 100, y: 0 });
    const cmds = defaultDrawOne(node, node.pose, VIEW, { derivedPath: path });
    expect(pathCommands(cmds).map((c) => c.path)).toEqual([path]);
  });

  it('paints nothing when the path is null — never a fallback rect', () => {
    const node = makeNode(() => null);
    expect(defaultDrawOne(node, node.pose, VIEW, { derivedPath: null })).toEqual([]);
  });
});

describe('the scene walks resolve derived geometry', () => {
  it('headless: buildSceneViewCommands paints the derived path', () => {
    const { scene } = makeEdgeScene();
    const cmds = buildSceneViewCommands(scene, VIEW, defaultDrawOne);
    expect(pathCommands(cmds)).toContainEqual(
      expect.objectContaining({ path: linePath({ x: 0, y: 0 }, { x: 100, y: 0 }) }),
    );
  });

  it('headless raster: the default drawOne keeps the walk\'s ctx while adding its own', () => {
    const { scene } = makeEdgeScene();
    const plan = planPixelRender({
      scene,
      sourceRect: { x: 0, y: 0, width: 200, height: 50 },
      scale: { x: 1, y: 1 },
      resolveImage: () => undefined,
    });
    expect(pathCommands(plan.commands)).toContainEqual(
      expect.objectContaining({ path: linePath({ x: 0, y: 0 }, { x: 100, y: 0 }) }),
    );
  });

  it('live: the scene-wired slot paints the derived path', () => {
    const { scene, edge } = makeEdgeScene();
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene);
    const node = scene.get(edge)!;
    const cmds = slot.drawOne(node, node.pose, VIEW);
    expect(pathCommands(cmds).map((c) => c.path)).toEqual([
      linePath({ x: 0, y: 0 }, { x: 100, y: 0 }),
    ]);
  });

  it('live: the scene-wired slot still composes override alpha with alphaFor', () => {
    const { scene, a } = makeEdgeScene();
    scene.overrides.set(a, { alpha: 0.5 });
    const slot = wireSceneSlotToScene({ drawOne: defaultDrawOne }, scene, () => 0.4);
    expect(slot.alphaFor!(a)).toBeCloseTo(0.2);
  });
});

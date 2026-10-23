/**
 * What a derivation is handed: its dependencies' nodes, poses and paths.
 *
 * The path half is what lets a node be placed *along* another — an edge label
 * on a routed edge — so these test it through `effectivePose`, the way a real
 * label reaches it, rather than by calling the resolver directly.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { derivedDepOf, documentDepOf, documentPose, effectivePose } from './effectivePose';
import { PATH_L, PATH_M, type Path, type PolygonPath } from '@weasel-js/geom';
import type { DerivedDep, NodeId, RectPose } from './types';

/** An open two-point polyline, written out because the path builder lives above `core/`. */
const segment = (from: { x: number; y: number }, to: { x: number; y: number }): PolygonPath => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([from.x, from.y, to.x, to.y]),
  fillRule: 'nonzero',
});

const LAYERS = [{ id: 'main' as const }];

const box = (x: number, y: number, w = 10, h = 10): RectPose =>
  ({ x, y, width: w, height: h });

type Scene = ReturnType<typeof createScene<object, 'main', RectPose>>;

const poseOf = (scene: Scene, id: NodeId): RectPose =>
  effectivePose(scene, scene.get(id)!);

/** The first coordinate pair of a path, which is enough to tell two apart. */
const startOf = (path: Path | null): number[] =>
  path === null ? [] : [...(path as { coords: Float32Array }).coords].slice(0, 2);

/** The last coordinate pair of a path. */
const endOf = (path: Path | null): number[] =>
  path === null ? [] : [...(path as { coords: Float32Array }).coords].slice(-2);

/**
 * A scene holding a line between two boxes, and a marker deriving its pose
 * from the *line's path* — the edge-label shape, with a counter on how often
 * the line actually routes.
 */
function labeled() {
  const routes = { count: 0 };
  const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
  const a = scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0), data: {} });
  const b = scene.add({ kind: 'mark', layer: 'main', pose: box(100, 0), data: {} });
  const line = scene.add({
    kind: 'mark', layer: 'main', pose: box(0, 0, 0, 0), data: {},
    dependsOn: [a, b],
    derivePath: (_node, deps): Path | null => {
      routes.count++;
      const [from, to] = deps as (DerivedDep<RectPose> | undefined)[];
      if (from === undefined || to === undefined) return null;
      return segment({ x: from.pose.x, y: from.pose.y }, { x: to.pose.x, y: to.pose.y });
    },
  });
  /** Sits at the far end of the line it depends on. */
  const label = (): NodeId => scene.add({
    kind: 'mark', layer: 'main', pose: box(-1, -1, 4, 4), data: {},
    dependsOn: [line],
    derivePose: (_node, deps): RectPose | null => {
      const path = (deps[0] as DerivedDep<RectPose> | undefined)?.path;
      if (path === null || path === undefined) return null;
      const coords = (path as { coords: Float32Array }).coords;
      return box(coords[coords.length - 2]!, coords[coords.length - 1]!, 4, 4);
    },
  });
  return { scene, a, b, line, label, routes };
}

describe('a dependency carries its path', () => {
  it('reaches a derivation that asks for it', () => {
    const { scene, label } = labeled();
    expect(poseOf(scene, label())).toEqual(box(100, 0, 4, 4));
  });

  it('follows the far end of the line moving', () => {
    const { scene, b, label } = labeled();
    const l = label();
    scene.setPose(b, box(250, 40));
    expect(poseOf(scene, l)).toEqual(box(250, 40, 4, 4));
  });

  it('is null for a dependency that derives no path, so the reader falls back', () => {
    const { scene, a } = labeled();
    // `a` is a plain box. A label hung on one has nothing to sit along.
    const orphan = scene.add({
      kind: 'mark', layer: 'main', pose: box(-1, -1, 4, 4), data: {},
      dependsOn: [a],
      derivePose: (_node, deps): RectPose | null => {
        const path = (deps[0] as DerivedDep<RectPose> | undefined)?.path ?? null;
        return path === null ? null : box(0, 0, 4, 4);
      },
    });
    expect(poseOf(scene, orphan)).toEqual(box(-1, -1, 4, 4));
  });

  it('routes once however many labels read it', () => {
    const { scene, label, routes } = labeled();
    const first = label();
    const second = label();
    routes.count = 0;
    poseOf(scene, first);
    poseOf(scene, second);
    expect(routes.count).toBe(1);
  });

  it('routes again once the line has moved', () => {
    const { scene, b, label, routes } = labeled();
    const l = label();
    poseOf(scene, l);
    routes.count = 0;
    scene.setPose(b, box(300, 0));
    poseOf(scene, l);
    expect(routes.count).toBe(1);
  });

  it('costs nothing for a dependency nobody asks about', () => {
    const { scene, a, line, routes } = labeled();
    routes.count = 0;
    // A node deriving its pose from the line's *pose* never touches the route.
    const bystander = scene.add({
      kind: 'mark', layer: 'main', pose: box(0, 0), data: {},
      dependsOn: [line],
      derivePose: (_node, deps): RectPose | null =>
        (deps[0] as DerivedDep<RectPose> | undefined)?.pose ?? null,
    });
    poseOf(scene, bystander);
    poseOf(scene, a);
    expect(routes.count).toBe(0);
  });

  it('resolves a cycle rather than overflowing the stack', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    // Two paths, each derived from the other's path. `dependsOn` is
    // unvalidated, and a path can now reach a path.
    const first = scene.add({
      kind: 'mark', layer: 'main', pose: box(0, 0), data: {},
      dependsOn: ['second' as NodeId],
      derivePath: (_n, deps): Path | null =>
        (deps[0] as DerivedDep<RectPose> | undefined)?.path
          ?? segment({ x: 1, y: 1 }, { x: 2, y: 2 }),
    });
    const second = scene.add({
      id: 'second' as NodeId, kind: 'mark', layer: 'main', pose: box(0, 0), data: {},
      dependsOn: [first],
      derivePath: (_n, deps): Path | null =>
        (deps[0] as DerivedDep<RectPose> | undefined)?.path
          ?? segment({ x: 3, y: 3 }, { x: 4, y: 4 }),
    });
    const reader = scene.add({
      kind: 'mark', layer: 'main', pose: box(0, 0), data: {},
      dependsOn: [second],
      derivePose: (_n, deps): RectPose | null => {
        const path = (deps[0] as DerivedDep<RectPose> | undefined)?.path ?? null;
        const [x, y] = startOf(path);
        return x === undefined || y === undefined ? null : box(x, y, 1, 1);
      },
    });
    expect(poseOf(scene, reader)).toEqual(box(1, 1, 1, 1));
  });
});

describe('a document read of a path-derived pose', () => {
  it('holds still while the edge it reads is being dragged', () => {
    const { scene, b, label } = labeled();
    const l = label();
    scene.overrides.set(b, { pose: box(300, 50) });
    expect(poseOf(scene, l)).toEqual(box(300, 50, 4, 4));
    expect(documentPose(scene, scene.get(l)!)).toEqual(box(100, 0, 4, 4));
    expect(poseOf(scene, l)).toEqual(box(300, 50, 4, 4));
  });
  it('answers a dependency’s path as the document holds it, through documentDepOf', () => {
    const { scene, b, line } = labeled();
    scene.overrides.set(b, { pose: box(300, 50) });
    expect(endOf(derivedDepOf(scene, line)!.path)).toEqual([300, 50]);
    expect(endOf(documentDepOf(scene, line)!.path)).toEqual([100, 0]);
    expect(documentDepOf(scene, 'missing' as NodeId)).toBeUndefined();
  });
});

describe('a dependency shown by a pose override path', () => {
  /** A plain shape, and a marker that sits at the end of whatever path the shape shows. */
  function followed() {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const shape = scene.add({ kind: 'mark', layer: 'main', pose: box(0, 0, 100, 10), data: {} });
    const marker = scene.add({
      kind: 'mark', layer: 'main', pose: box(-1, -1, 4, 4), data: {},
      dependsOn: [shape],
      derivePose: (_node, deps): RectPose | null => {
        const path = (deps[0] as DerivedDep<RectPose> | undefined)?.path;
        if (path === null || path === undefined) return null;
        const coords = (path as { coords: Float32Array }).coords;
        return box(coords[coords.length - 2]!, coords[coords.length - 1]!, 4, 4);
      },
    });
    return { scene, shape, marker };
  }

  it('answers the override\'s path as the dependency\'s, and the document reading none', () => {
    const { scene, shape, marker } = followed();
    expect(poseOf(scene, marker)).toEqual(box(-1, -1, 4, 4));
    scene.overrides.set(shape, { pose: box(0, -50, 100, 60), path: segment({ x: 0, y: 0 }, { x: 60, y: -50 }) });
    scene.overrides.commit();
    expect(poseOf(scene, marker)).toEqual(box(60, -50, 4, 4));
    expect(documentPose(scene, scene.get(marker)!)).toEqual(box(-1, -1, 4, 4));
    scene.overrides.clear(shape);
    scene.overrides.commit();
    expect(poseOf(scene, marker)).toEqual(box(-1, -1, 4, 4));
  });

  it('follows a path that changes inside the same bounds', () => {
    const { scene, shape, marker } = followed();
    const entry = { pose: box(0, -50, 100, 60), path: segment({ x: 0, y: 0 }, { x: 60, y: -50 }) };
    scene.overrides.set(shape, entry);
    scene.overrides.commit();
    expect(poseOf(scene, marker)).toEqual(box(60, -50, 4, 4));
    entry.path = segment({ x: 0, y: 0 }, { x: 80, y: -20 });
    scene.overrides.commit();
    expect(poseOf(scene, marker)).toEqual(box(80, -20, 4, 4));
  });

  it('prefers the override\'s path to one the dependency derives', () => {
    const { scene, a, line, label } = labeled();
    const l = label();
    expect(poseOf(scene, l)).toEqual(box(100, 0, 4, 4));
    scene.overrides.set(line, { path: segment({ x: 0, y: 0 }, { x: 7, y: 7 }) });
    scene.overrides.commit();
    expect(poseOf(scene, l)).toEqual(box(7, 7, 4, 4));
    expect(scene.get(a)).toBeDefined();
  });
});


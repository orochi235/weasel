/**
 * fast-check arbitraries shared by the canvas layer's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

export interface Box { x: number; y: number; width: number; height: number }

export const LAYERS = ['a', 'b', 'c'] as const;
export type LayerId = (typeof LAYERS)[number];

export interface LayerSpec { id: LayerId; visible: boolean; locked: boolean }

/** One node of a generated scene. `parent` is the index of an earlier group, or null. */
export interface NodeSpec {
  group: boolean;
  parent: number | null;
  layer: LayerId;
  pose: Box;
  hidden: boolean;
  locked: boolean;
  unpickable: boolean;
  faded: boolean;
  /** A group's `clipFromPose`: its own box, {@link clipBox}. */
  clip: boolean;
}

export interface SceneSpec { layers: LayerSpec[]; nodes: NodeSpec[] }

/** An integer box in `[0, 200]²`, at least 1 on a side. */
export const intBox: fc.Arbitrary<Box> = fc.record({
  x: fc.integer({ min: 0, max: 180 }),
  y: fc.integer({ min: 0, max: 180 }),
  width: fc.integer({ min: 1, max: 120 }),
  height: fc.integer({ min: 1, max: 120 }),
});

const rare = fc.integer({ min: 0, max: 9 }).map((n) => n === 0);

const nodeSpec: fc.Arbitrary<NodeSpec> = fc.record({
  group: fc.integer({ min: 0, max: 2 }).map((n) => n === 0),
  parent: fc.option(fc.nat(), { nil: null, freq: 2 }),
  layer: fc.constantFrom(...LAYERS),
  pose: intBox,
  hidden: rare,
  locked: rare,
  unpickable: rare,
  faded: rare,
  clip: fc.integer({ min: 0, max: 3 }).map((n) => n !== 0),
});

export const sceneSpec: fc.Arbitrary<SceneSpec> = fc.record({
  layers: fc.tuple(
    ...LAYERS.map((id) => fc.record({
      id: fc.constant(id),
      visible: fc.integer({ min: 0, max: 7 }).map((n) => n !== 0),
      locked: fc.integer({ min: 0, max: 7 }).map((n) => n === 0),
    })),
  ).map((ls) => [...ls]),
  nodes: fc.array(nodeSpec, { minLength: 1, maxLength: 14 }),
}).map((s) => ({
  ...s,
  nodes: resolveParents(s.nodes),
}));

/** Each parent resolved to an earlier group, or none when there is none, and each child lifted to its parent's layer when it sits
 *  below it, which the scene refuses. */
function resolveParents(nodes: readonly NodeSpec[]): NodeSpec[] {
  const out: NodeSpec[] = [];
  for (const n of nodes) {
    const groups = out.flatMap((m, k) => (m.group ? [k] : []));
    const parent = n.parent === null || groups.length === 0 ? null : groups[n.parent % groups.length]!;
    const floor = parent === null ? 0 : LAYERS.indexOf(out[parent]!.layer);
    out.push({ ...n, parent, layer: LAYERS[Math.max(floor, LAYERS.indexOf(n.layer))]! });
  }
  return out;
}

export const nodeIdOf = (i: number): NodeId => asNodeId(`n${i}`);

/** A clipping group's clip: its box inset by a quarter, so no clip edge lies on an integer box's edge or a
 *  half-integer query's, and no boundary convention decides an answer. */
export const clipBox = (b: Box): Box => ({ x: b.x + 0.25, y: b.y + 0.25, width: b.width - 0.5, height: b.height - 0.5 });

export type BoxScene = Scene<null, LayerId, Box>;

/** The scene `spec` describes, with every pose moved by `(dx, dy)`. */
export function buildScene(spec: SceneSpec, dx = 0, dy = 0): BoxScene {
  const scene = createScene<null, LayerId, Box>({
    systemLayers: spec.layers.map((l) => ({ id: l.id })),
    composition: IDENTITY_POSE_COMPOSITION as never,
  });
  spec.nodes.forEach((n, i) => {
    const pose = { ...n.pose, x: n.pose.x + dx, y: n.pose.y + dy };
    scene.add({
      id: nodeIdOf(i),
      kind: n.group ? 'group' : 'mark',
      layer: n.layer,
      pose,
      data: null,
      ...(n.parent !== null ? { parent: nodeIdOf(n.parent) } : {}),
      ...(n.unpickable ? { pickable: false } : {}),
      ...(n.group && n.clip ? { clipFromPose: (p: Box) => ({ kind: 'rect', ...clipBox(p) }) } : {}),
    } as never);
  });
  // Flags after every add: a lock refuses the edits that follow it.
  spec.nodes.forEach((n, i) => {
    if (n.hidden) scene.setHidden(nodeIdOf(i), true);
    if (n.faded) scene.overrides.set(nodeIdOf(i), { alpha: 0 });
  });
  spec.nodes.forEach((n, i) => { if (n.locked) scene.setLocked(nodeIdOf(i), true); });
  for (const l of spec.layers) {
    if (!l.visible) scene.setLayerVisible(l.id, false);
    if (l.locked) scene.setLayerLocked(l.id, true);
  }
  scene.overrides.commit();
  return scene;
}

/** Ancestors of node `i`, innermost first. */
export function ancestorsOf(spec: SceneSpec, i: number): number[] {
  const out: number[] = [];
  for (let at = spec.nodes[i]!.parent; at !== null; at = spec.nodes[at]!.parent) out.push(at);
  return out;
}

/** `[i, ...ancestors]`. */
export const selfAndUp = (spec: SceneSpec, i: number): number[] => [i, ...ancestorsOf(spec, i)];

export const layerOf = (spec: SceneSpec, id: LayerId): LayerSpec => spec.layers.find((l) => l.id === id)!;

/** Hidden by its own flag or an ancestor's, or by its own layer. */
export function modelHidden(spec: SceneSpec, i: number): boolean {
  return !layerOf(spec, spec.nodes[i]!.layer).visible || selfAndUp(spec, i).some((k) => spec.nodes[k]!.hidden);
}

/** Locked by its own flag or layer, or an ancestor's. */
export function modelLocked(spec: SceneSpec, i: number): boolean {
  return selfAndUp(spec, i).some((k) => spec.nodes[k]!.locked || layerOf(spec, spec.nodes[k]!.layer).locked);
}

/** Strictly inside `b`: callers ask at half-integers, so no point lands on an edge of an integer box. */
export const inside = (b: Box, x: number, y: number): boolean =>
  x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height;

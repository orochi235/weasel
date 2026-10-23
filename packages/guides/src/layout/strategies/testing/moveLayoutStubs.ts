import {
  createPoseOverrides,
  type PoseOverrides,
  type InvocationCtx,
  type LayoutDep,
  type NodeId,
  IDENTITY_POSE_COMPOSITION,
  RECT_POSE_COMPOSITION,
  type PoseComposition,
} from '@weasel-js/core';
import { tileGrid } from '../tileGrid';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from '@weasel-js/geom';

/** Axis-aligned square as a PolygonPath — a container pose that carries NO
 *  direct `x/y/width/height`, so the layout hit-test must derive its AABB via
 *  the pose descriptor rather than casting to a rect. */
export function squarePolygon(x: number, y: number, w: number, h: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    fillRule: 'nonzero',
  };
}

/** A scene here composes by parent translation unless a test asks for
 *  `ABSOLUTE`, the kit's identity default. */
export const LOCAL_PC = RECT_POSE_COMPOSITION as PoseComposition<unknown>;
export const ABSOLUTE = IDENTITY_POSE_COMPOSITION;

export type P = { x: number; y: number; width: number; height: number };

export interface AppliedBatch {
  ops: { name?: string; id?: string; label?: string; args?: { id?: string; toParentId?: string | null; to?: P } }[];
  label: string;
}

export interface StubScene {
  poses: Map<string, P>;
  overrides: PoseOverrides<unknown>;
  composition: PoseComposition<unknown>;
  childMap: Map<string, NodeId[]>;
  roots: NodeId[];
  appliedBatches: AppliedBatch[];
  get(id: NodeId): { kind: 'group' | 'mark'; pose: P; parent: NodeId | null } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  applyBatch(ops: unknown[], label: string, adapter: unknown): void;
  batch(label: string, fn: () => void): void;
  setPose(id: NodeId, pose: P): void;
}

/** Where a move shows `id` mid-drag: the pose it published to the scene's
 *  overrides, or null. */
export function heldPose(scene: StubScene, id: string): P | null {
  return (scene.overrides.read(id as NodeId)?.pose as P | undefined) ?? null;
}

export function makeScene(
  poses: Record<string, P>,
  parents: Record<string, string | null>,
  childMap: Record<string, string[]>,
  roots: string[],
  composition: PoseComposition<unknown> = LOCAL_PC,
): StubScene {
  const p = new Map(Object.entries(poses));
  const c = new Map(Object.entries(childMap).map(([k, v]) => [k, v as NodeId[]]));
  const appliedBatches: AppliedBatch[] = [];
  return {
    poses: p,
    childMap: c,
    overrides: createPoseOverrides<unknown>((id) => (p.has(id) ? { } : undefined)),
    composition,
    roots: roots as NodeId[],
    appliedBatches,
    get(id) {
      if (!p.has(id)) return undefined;
      // A node given a child list is a group, so it takes a drop with no `canDropInto` dep.
      return { kind: c.has(id) ? 'group' : 'mark', pose: p.get(id)!, parent: (parents[id] ?? null) as NodeId | null };
    },
    childrenOf(id) { return c.get(id) ?? []; },
    applyBatch(ops, label) {
      appliedBatches.push({ ops: ops as { id?: string; label?: string }[], label });
    },
    batch(_label, fn) { fn(); },
    setPose(id, pose) { p.set(id as string, pose); },
  };
}

/** Resolve a layout by container id. Either a fn or a map of id → strategy. */
export type GetLayout = NonNullable<LayoutDep['getLayout']> | Record<string, unknown>;

export function makeCtx(
  scene: StubScene,
  selectionIds: string[],
  drag?: InvocationCtx['drag'],
  getLayout?: GetLayout,
  applyOps?: (ops: unknown[], label?: string) => void,
): InvocationCtx {
  const grid = tileGrid<P>({ cols: 2, rows: 1 });
  const defaultGet: LayoutDep['getLayout'] = (id) => (id === 'C' ? (grid as never) : null);
  const resolve: LayoutDep['getLayout'] = getLayout === undefined
    ? defaultGet
    : typeof getLayout === 'function'
      ? getLayout
      : (id) => ((getLayout as Record<string, unknown>)[id] as never) ?? null;
  const layout: LayoutDep = { getLayout: resolve };
  const deps: Record<string, unknown> = {
    selection: { get: () => selectionIds as NodeId[] },
    scene,
    layout,
  };
  if (applyOps) deps.applyOps = applyOps;
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    drag,
  } as unknown as InvocationCtx;
}

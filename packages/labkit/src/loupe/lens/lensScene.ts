import {
  asNodeId,
  createInsertOp,
  createScene,
  createSetDataOp,
  createSetDependsOnOp,
  createTransformOp,
  type DerivePathFn,
  type DerivePoseFn,
  effectivePose,
  type Op,
  type RectPose,
  sceneToAdapter,
} from '@weasel-js/core';
import { linePath } from '@weasel-js/geom';
import {
  BODY_SIZE,
  GLASS_POSE_KEY,
  LEADER_PATH_KEY,
  LENS_DEFAULTS,
  type LensAim,
  type LensBodyData,
  type LensIds,
  type LensNodeData,
  type LensScene,
  type LensSettings,
  type LoupePoint,
} from './lensTypes';

const center = (p: RectPose): LoupePoint => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

/**
 * The patch a lens shows: the body's box divided by the factor, centered on `at`. It is the reticle's pose, so the
 * reticle marks exactly what the body magnifies, and it is drawn and picked in the body's shape.
 */
export function patchAt(body: RectPose, factor: number, at: LoupePoint): RectPose {
  const width = body.width / factor;
  const height = body.height / factor;
  return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}

const factorOf = (node: { data: unknown }): number => {
  const data = node.data as LensNodeData<unknown> | undefined;
  return data?.role === 'lens-body' ? data.factor : LENS_DEFAULTS.factor;
};

const glassPose: DerivePoseFn<RectPose, unknown, string> = (_node, deps) => {
  const body = deps[0];
  return body === undefined ? null : patchAt(body.pose, factorOf(body.node), center(body.pose));
};

/** How far from its center `pose`'s rim lies along the unit direction `(ux, uy)`: on the ellipse or the rect its
 *  box holds, so a resized body and its patch are met where they are drawn. */
function rimReach(square: boolean, pose: RectPose, ux: number, uy: number): number {
  const a = Math.abs(ux) / (pose.width / 2);
  const b = Math.abs(uy) / (pose.height / 2);
  return 1 / (square ? Math.max(a, b) : Math.hypot(a, b));
}

/** Joins the body's rim to the reticle's, or nothing while they overlap. */
const leaderPath: DerivePathFn<RectPose, unknown, string> = (_node, deps) => {
  const [body, reticle] = deps;
  if (body === undefined || reticle === undefined) return null;
  const from = center(body.pose);
  const to = center(reticle.pose);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return null;
  const [ux, uy] = [dx / distance, dy / distance];
  const data = body.node.data as LensNodeData<unknown> | undefined;
  const square = data?.role === 'lens-body' && data.shape === 'square';
  const k = rimReach(square, body.pose, ux, uy);
  const j = rimReach(square, reticle.pose, ux, uy);
  if (distance <= k + j) return null;
  return linePath(
    { x: from.x + ux * k, y: from.y + uy * k },
    { x: to.x - ux * j, y: to.y - uy * j },
  );
};

/** The functions a lens scene's nodes carry, by key: what a restored history resolves them against. */
export const LENS_REGISTRY = {
  derivePose: { [GLASS_POSE_KEY]: glassPose },
  derivePath: { [LEADER_PATH_KEY]: leaderPath },
};

/** An empty lens scene, with its `lenses` layer and the registry its derived poses and paths resolve through. */
export function createLensScene<C>(): LensScene<C> {
  return createScene<LensNodeData<C>, 'lenses', RectPose>({
    systemLayers: [{ id: 'lenses' }],
    registry: LENS_REGISTRY,
  });
}

const idsFor = (lensId: string): LensIds => ({
  lensId,
  body: asNodeId(`${lensId}:body`),
  reticle: asNodeId(`${lensId}:reticle`),
  leader: asNodeId(`${lensId}:leader`),
});

/** Inserts a lens: body centered at `at.body`, reticle centered at `at.reticle`, and the leader joining them. */
export function addLensOps<C>(
  _scene: LensScene<C>,
  lensId: string,
  at: { body: LoupePoint; reticle: LoupePoint },
  settings: Partial<LensSettings<C>> = {},
): Op[] {
  const ids = idsFor(lensId);
  const merged = { ...LENS_DEFAULTS, ...settings } as LensSettings<C>;
  const label = 'add lens';
  const base = { layer: 'lenses', kind: 'leaf' } as const;
  const body = patchAt({ x: 0, y: 0, width: BODY_SIZE, height: BODY_SIZE }, 1, at.body);
  return [
    createInsertOp({
      label,
      node: {
        ...base,
        id: ids.body,
        pose: body,
        data: { ...merged, role: 'lens-body', lensId } satisfies LensBodyData<C>,
      },
    }),
    createInsertOp({
      label,
      node: {
        ...base,
        id: ids.reticle,
        pose: patchAt(body, merged.factor, at.reticle),
        data: { role: 'lens-reticle', lensId },
        derivePose: glassPose,
        ...(merged.aim === 'glass' ? { dependsOn: [ids.body] } : {}),
      },
    }),
    createInsertOp({
      label,
      node: {
        ...base,
        id: ids.leader,
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { role: 'lens-leader', lensId },
        // It ends on the reticle's center, so a press there would take it.
        pickable: false,
        dependsOn: [ids.body, ids.reticle],
        derivePath: leaderPath,
      },
    }),
  ];
}

/** The ids of the lens a node belongs to, or null when it is not a lens node. */
export function lensIdsOf<C>(scene: LensScene<C>, nodeId: string): LensIds | null {
  const data = scene.get(asNodeId(nodeId))?.data;
  return data === undefined ? null : idsFor(data.lensId);
}

/** Every lens in the scene, in render order. */
export function lensesOf<C>(scene: LensScene<C>): readonly LensIds[] {
  const out: LensIds[] = [];
  for (const node of scene.renderOrderNodes()) {
    if (node.data.role === 'lens-body') out.push(idsFor(node.data.lensId));
  }
  return out;
}

/** `ids` widened to every node of each lens they touch. Ids outside the scene are dropped. */
export function lensClosure<C>(scene: LensScene<C>, ids: readonly string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    const lens = lensIdsOf(scene, id);
    if (lens !== null) for (const n of [lens.body, lens.reticle, lens.leader]) out.add(n);
  }
  return [...out];
}

function bodyOf<C>(scene: LensScene<C>, lensId: string): LensBodyData<C> | null {
  const data = scene.get(idsFor(lensId).body)?.data;
  return data?.role === 'lens-body' ? data : null;
}

/** A lens's settings, read off its body; null when no such lens is up. */
export function settingsOf<C>(scene: LensScene<C>, lensId: string): LensSettings<C> | null {
  const data = bodyOf(scene, lensId);
  if (data === null) return null;
  const { role: _role, lensId: _id, ...settings } = data;
  return settings;
}

/** A lens's reticle box moved to center on `at`, at the size it has now: what a Follow reticle is held at. Null when
 *  the lens is gone. */
export function reticleAt<C>(scene: LensScene<C>, lensId: string, at: LoupePoint): RectPose | null {
  const reticle = scene.get(idsFor(lensId).reticle);
  if (!reticle) return null;
  const { width, height } = effectivePose(scene, reticle);
  return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}

/** The shape a lens's body, and so its reticle, is drawn in; null when the lens is gone. */
export function lensShapeOf<C>(
  scene: LensScene<C>,
  lensId: string,
): LensSettings<C>['shape'] | null {
  return bodyOf(scene, lensId)?.shape ?? null;
}

/** Writes a patch to the body's settings. Aim has its own entry point, `setAimOps`. A new factor resizes a pinned or
 *  Follow reticle to the patch it now shows; a Glass one derives it. */
export function setLensOps<C>(
  scene: LensScene<C>,
  lensId: string,
  patch: Partial<Omit<LensSettings<C>, 'aim'>>,
): Op[] {
  const from = bodyOf(scene, lensId);
  if (from === null) return [];
  const ids = idsFor(lensId);
  const keys = Object.keys(patch).sort().join(',');
  const label = 'set lens';
  const coalesceKey = `lens:${lensId}:${keys}`;
  const ops: Op[] = [
    createSetDataOp<LensNodeData<C>>({
      id: ids.body,
      from,
      to: { ...from, ...patch },
      label,
      coalesceKey,
    }),
  ];
  const body = scene.get(ids.body);
  const reticle = scene.get(ids.reticle);
  const factor = patch.factor ?? from.factor;
  if (factor !== from.factor && from.aim !== 'glass' && body && reticle) {
    const to = patchAt(body.pose, factor, center(reticle.pose));
    ops.push(createTransformOp({ id: ids.reticle, from: reticle.pose, to, label, coalesceKey }));
  }
  return ops;
}

/** Applies lens ops to `scene` as one recorded edit, the way the lens canvas writes its own. */
export function applyLensOps<C>(scene: LensScene<C>, ops: readonly Op[]): void {
  if (ops.length > 0) sceneToAdapter(scene).applyOps([...ops], 'lens');
}

/** Switches aim. Entering Glass makes the reticle derive from the body; leaving it plants the reticle where it was drawn. */
export function setAimOps<C>(scene: LensScene<C>, lensId: string, to: LensAim): Op[] {
  const from = bodyOf(scene, lensId);
  if (from === null || from.aim === to) return [];
  const label = 'set lens aim';
  const ids = idsFor(lensId);
  const ops: Op[] = [
    createSetDataOp<LensNodeData<C>>({ id: ids.body, from, to: { ...from, aim: to }, label }),
  ];
  if (to === 'glass') {
    ops.push(createSetDependsOnOp({ id: ids.reticle, from: undefined, to: [ids.body], label }));
  } else if (from.aim === 'glass') {
    const reticle = scene.get(ids.reticle);
    if (reticle !== undefined) {
      ops.push(
        createTransformOp({
          id: ids.reticle,
          from: reticle.pose,
          to: effectivePose(scene, reticle),
          label,
        }),
      );
    }
    ops.push(createSetDependsOnOp({ id: ids.reticle, from: [ids.body], to: undefined, label }));
  }
  return ops;
}

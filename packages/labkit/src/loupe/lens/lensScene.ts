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
  RETICLE_SIZE,
} from './lensTypes';

const center = (p: RectPose): LoupePoint => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

const boxAt = (c: LoupePoint, size: number): RectPose => ({
  x: c.x - size / 2,
  y: c.y - size / 2,
  width: size,
  height: size,
});

const glassPose: DerivePoseFn<RectPose, unknown, string> = (_node, deps) => {
  const body = deps[0];
  return body === undefined ? null : boxAt(center(body.pose), RETICLE_SIZE);
};

const leaderPath: DerivePathFn<RectPose, unknown, string> = (_node, deps) => {
  const [body, reticle] = deps;
  if (body === undefined || reticle === undefined) return null;
  const from = center(body.pose);
  const to = center(reticle.pose);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const data = body.node.data as LensNodeData<unknown> | undefined;
  const square = data?.role === 'lens-body' && data.shape === 'square';
  const reach = square ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.hypot(dx, dy);
  const half = body.pose.width / 2;
  if (reach <= half) return null;
  const k = half / reach;
  return linePath({ x: from.x + dx * k, y: from.y + dy * k }, to);
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
  return [
    createInsertOp({
      label,
      node: {
        ...base,
        id: ids.body,
        pose: boxAt(at.body, BODY_SIZE),
        data: { ...merged, role: 'lens-body', lensId } satisfies LensBodyData<C>,
      },
    }),
    createInsertOp({
      label,
      node: {
        ...base,
        id: ids.reticle,
        pose: boxAt(at.reticle, RETICLE_SIZE),
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

/** Writes a patch to the body's settings. Aim has its own entry point, `setAimOps`. */
export function setLensOps<C>(
  scene: LensScene<C>,
  lensId: string,
  patch: Partial<Omit<LensSettings<C>, 'aim'>>,
): Op[] {
  const from = bodyOf(scene, lensId);
  if (from === null) return [];
  const keys = Object.keys(patch).sort().join(',');
  return [
    createSetDataOp<LensNodeData<C>>({
      id: idsFor(lensId).body,
      from,
      to: { ...from, ...patch },
      label: 'set lens',
      coalesceKey: `lens:${lensId}:${keys}`,
    }),
  ];
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

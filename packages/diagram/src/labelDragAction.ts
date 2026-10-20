/**
 * Moving an edge label along and beside its edge.
 *
 * The label layer (`labelDragLayer`) claims the press; this action moves the
 * label. The drag previews the label's own data at the station the pointer
 * proposes, and the pose that data derives, so the preview stands where the
 * commit will.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  documentDepOf,
  effectivePose,
  translatePoseViaDescriptor,
  type Action,
  type InvocationCtx,
  type OngoingHandle,
} from '@weasel-js/core';
import type { Path, Vec2 } from '@weasel-js/core/math';
import { LABEL_PLACEMENT, diagramLabelOf, type DiagramLabel, type LabelSpot } from './labelTrait';
import { labelCenter, labelSpotAt } from './labels/station';
import { labelScratchOf } from './labelDragLayer';

/** The action that drags an edge label. */
export const MOVE_LABEL_ACTION_ID = 'diagram.moveLabel';

/** A label placed: where it now sits on its edge, or `null` to reset it to {@link LABEL_PLACEMENT}. */
export interface LabelEdit {
  labelId: string;
  edgeId: string;
  placement: DiagramLabel | null;
}

/** Options for {@link createLabelDragAction}. */
export interface LabelDragOptions {
  /** Defaults to {@link commitLabelToScene} against `deps.scene`. */
  commit?: (edit: LabelEdit, ctx: InvocationCtx) => void;
  id?: string;
}

const placementAt = (spot: LabelSpot): DiagramLabel => ({ at: spot.at, offset: spot.offset, dodge: false });

/** `data` with its label trait set where `placement` says. */
function placedData(data: unknown, placement: DiagramLabel): Record<string, unknown> {
  const record = data as Record<string, unknown>;
  return { ...record, diagram: { ...(record.diagram as Record<string, unknown>), label: placement } };
}

/** `data` with its label trait at `spot`, owned by the author from now on:
 *  placement's `placed` is dropped, and placement won't move it again. */
export function movedLabelData(data: unknown, spot: LabelSpot): Record<string, unknown> {
  return placedData(data, placementAt(spot));
}

/** The default commit: the label's placement in `data.diagram.label`, as one
 *  history entry labeled "Move label", or "Reset label" for a `null` placement. */
export function commitLabelToScene(edit: LabelEdit, ctx: InvocationCtx): void {
  const scene = ctx.deps.scene;
  const node = scene?.get(edit.labelId as never);
  if (scene === undefined || node === undefined || diagramLabelOf(node) === null) return;
  const placement = edit.placement ?? LABEL_PLACEMENT;
  scene.batch(edit.placement === null ? 'Reset label' : 'Move label', () => {
    scene.update(node.id, { data: placedData(node.data, placement) as never });
  });
}

/** What a label drag captured at its press, read-only after. */
interface LabelPress {
  labelId: string;
  edgeId: string;
  data: unknown;
  pose: unknown;
  size: { width: number; height: number };
  center: Vec2;
  path: Path;
  /** The label's center less the press point. */
  grab: Vec2;
  deps: InvocationCtx['deps'];
}

function pressOf(ctx: InvocationCtx): LabelPress | null {
  const pressed = labelScratchOf(ctx.drag?.affordance);
  const scene = ctx.deps.scene;
  const node = pressed === null ? undefined : scene?.get(pressed.labelId as never);
  if (pressed === null || scene === undefined || node === undefined || diagramLabelOf(node) === null) return null;
  const path = documentDepOf(scene as never, pressed.edgeId as never)?.path ?? null;
  if (path === null) return null;
  const pose = effectivePose(scene as never, node as never);
  const box = AUTO_POSE_DESCRIPTOR.getBounds(pose);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const press = ctx.drag?.start ?? { x: ctx.world.x, y: ctx.world.y };
  return {
    labelId: pressed.labelId, edgeId: pressed.edgeId, data: node.data, pose, path, center,
    size: { width: box.width, height: box.height },
    grab: { x: center.x - press.x, y: center.y - press.y },
    deps: ctx.deps,
  };
}

/** The station the label's center stands at with the pointer at `ctx.world`. */
const spotAt = (p: LabelPress, ctx: InvocationCtx): LabelSpot | null =>
  labelSpotAt(p.path, { x: ctx.world.x + p.grab.x, y: ctx.world.y + p.grab.y }, p.size);

/** The press pose moved to where `spot` derives the label's center. */
function poseAt(p: LabelPress, spot: LabelSpot): unknown {
  const c = labelCenter(p.path, placementAt(spot), p.size);
  return c === null ? p.pose : translatePoseViaDescriptor(p.pose, c.x - p.center.x, c.y - p.center.y, AUTO_POSE_DESCRIPTOR);
}

/** The `diagram.moveLabel` action: an ongoing drag moving one edge label along and beside its edge. */
export function createLabelDragAction(opts: LabelDragOptions = {}): Action {
  const { commit = commitLabelToScene } = opts;
  return {
    id: opts.id ?? MOVE_LABEL_ACTION_ID,
    label: 'Move label',
    group: 'diagram',
    requires: ['scene'],
    eligible: { mode: { in: ['normal', 'isolation'] } },
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const p = pressOf(ctx);
        if (p === null) return {};
        // Null until the pointer moves, so a still click commits nothing.
        let spot: LabelSpot | null = null;
        let open = true;
        const proposed = () => (open ? spot : null);
        return {
          kind: 'diagram-move-label',
          onMove(moveCtx: InvocationCtx): void {
            spot = spotAt(p, moveCtx);
          },
          previewIds: () => (proposed() === null ? null : [p.labelId]),
          previewPose: (id) => {
            const next = proposed();
            return id === p.labelId && next !== null ? poseAt(p, next) : null;
          },
          previewData: (id) => {
            const next = proposed();
            return id === p.labelId && next !== null ? movedLabelData(p.data, next) : null;
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            const final = reason === 'commit' && spot !== null ? spotAt(p, endCtx) : null;
            if (final !== null) {
              commit({ labelId: p.labelId, edgeId: p.edgeId, placement: placementAt(final) }, { ...endCtx, deps: p.deps });
            }
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

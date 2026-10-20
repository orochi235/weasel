/**
 * Reorder — dragging a member of a group marked `reorder` along that axis,
 * among its siblings, or stepping the selected one with Alt and an arrow key.
 *
 * Nothing is written: the drag shows the member under the pointer and its
 * siblings in the slots they would take, and the release reports the new
 * order. The host writes it to its data, and layout keeps it.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  effectivePose,
  type Action,
  type ActionDeps,
  type Contribution,
  type GestureBinding,
  type InvocationCtx,
  type OngoingHandle,
  type RectPose,
  type Scene,
} from '@weasel-js/core';
import { worldRectOf } from './overlays';
import type { DiagramSceneData } from './fromData';
import { carriedWith, orderWith, packed, reorderTargetOf, type ReorderTarget, type Span } from './reorderModel';

/** The drag that carries a member. */
export const REORDER_ACTION_ID = 'diagram.reorder';
/** Alt and an arrow key: the selected member one place along. */
export const STEP_REORDER_ACTION_ID = 'diagram.stepReorder';

/** A reorderable group's members in their new order. */
export interface ReorderChange {
  group: string;
  order: readonly string[];
}

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

const sceneOf = (deps: ActionDeps | undefined) => deps?.scene as DiagramScene | undefined;

function targetAt(deps: ActionDeps | undefined, id: string | null | undefined): ReorderTarget | null {
  const scene = sceneOf(deps);
  if (scene === undefined || id == null) return null;
  return reorderTargetOf(scene as never, id, (m) => worldRectOf(scene, m));
}

function spansOf(scene: DiagramScene, target: ReorderTarget): Map<string, Span> {
  const out = new Map<string, Span>();
  for (const m of target.members) {
    const box = worldRectOf(scene, m) ?? { x: 0, y: 0, width: 0, height: 0 };
    out.set(m, target.axis === 'x' ? { start: box.x, size: box.width } : { start: box.y, size: box.height });
  }
  return out;
}

const sameOrder = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

const onBody = bodyPredicate((target) => target === 'selected-body' || target === 'unselected-body');

/** The drag action: a ghost of the carried member and its siblings in their slots, then one report. */
export function createReorderAction(report: (change: ReorderChange) => void): Action {
  return {
    id: REORDER_ACTION_ID,
    label: 'Reorder',
    group: 'diagram',
    requires: ['scene', 'nodeAtPoint'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const scene = sceneOf(ctx.deps);
        const target = targetAt(ctx.deps, ctx.deps.nodeAtPoint?.(ctx.world));
        if (scene === undefined || target === null) return {};
        const { axis, member, members } = target;
        const spans = spansOf(scene, target);
        const along = (p: { x: number; y: number }) => (axis === 'x' ? p.x : p.y);
        const from = along(ctx.world);
        let by = 0;
        let order = [...members];
        // Every node a member carries, keyed to the member, for the ghost to move.
        const owner = new Map<string, string>();
        for (const m of members) for (const id of carriedWith(scene as never, m)) owner.set(id, m);
        const shift = (m: string): number => {
          if (m === member) return by;
          return (packed(members, spans, order).get(m) ?? spans.get(m)!.start) - spans.get(m)!.start;
        };
        return {
          kind: 'diagram-reorder',
          onMove(moveCtx) {
            by = along(moveCtx.world) - from;
            order = orderWith(members, spans, member, by);
          },
          previewIds: () => [...owner.keys()].filter((id) => shift(owner.get(id)!) !== 0),
          previewOpaqueIds: () => [...owner.keys()].filter((id) => owner.get(id) !== member),
          previewPose(id) {
            const node = scene.get(id as never);
            const m = owner.get(id);
            if (node === undefined || m === undefined) return null;
            const pose = effectivePose(scene, node);
            const d = shift(m);
            return axis === 'x' ? { ...pose, x: pose.x + d } : { ...pose, y: pose.y + d };
          },
          onEnd(_endCtx, reason) {
            if (reason === 'commit' && !sameOrder(order, members)) report({ group: target.group, order });
          },
        };
      },
    },
    enabled: (deps, at) =>
      at !== undefined && targetAt(deps, deps?.nodeAtPoint?.(at)) !== null ? true : ActionDisabledReason.NotApplicable,
  };
}

const STEPS: readonly { key: string; axis: 'x' | 'y'; step: -1 | 1 }[] = [
  { key: 'ArrowUp', axis: 'y', step: -1 },
  { key: 'ArrowDown', axis: 'y', step: 1 },
  { key: 'ArrowLeft', axis: 'x', step: -1 },
  { key: 'ArrowRight', axis: 'x', step: 1 },
];

/** Steps the selected node's member one place toward the start (`-1`) or the end (`1`). */
export function createStepReorderAction(report: (change: ReorderChange) => void): Action {
  const selectedTarget = (deps: ActionDeps | undefined) => targetAt(deps, deps?.selection?.get()[0]);
  return {
    id: STEP_REORDER_ACTION_ID,
    label: 'Move along',
    group: 'diagram',
    defaultBinding: STEPS.map(({ key, axis, step }) => ({
      spec: { kind: 'key' as const, key, mods: { alt: true } },
      opts: { params: { axis, step } },
    })),
    requires: ['scene', 'selection'],
    invoker: {
      timing: 'immediate',
      run(deps, params) {
        const target = selectedTarget(deps);
        if (target === null || params?.axis !== target.axis) return;
        const { members, member } = target;
        const at = members.indexOf(member);
        const to = at + (params.step === -1 ? -1 : 1);
        if (to < 0 || to >= members.length) return;
        const order = [...members];
        order.splice(at, 1);
        order.splice(to, 0, member);
        report({ group: target.group, order });
      },
    },
    enabled: (deps) => (selectedTarget(deps) !== null ? true : ActionDisabledReason.NotApplicable),
  };
}

/** A drag on a node's body carries its member. Alt and an arrow is the step action's own default binding. */
export function reorderBindings(): GestureBinding[] {
  return [{ spec: { kind: 'drag', target: { kindOf: onBody } }, actionId: REORDER_ACTION_ID }];
}

/** Everything `DiagramView` installs for `onReorder`. */
export function reorderContribution(report: (change: ReorderChange) => void): Contribution {
  return {
    id: 'weasel-diagram-reorder',
    eligibility: { always: true },
    actions: [createReorderAction(report), createStepReorderAction(report)],
    bindings: reorderBindings(),
  };
}

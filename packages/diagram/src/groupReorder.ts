/**
 * Reordering a group or container marked `reorder`: a member dragged along that axis among
 * its siblings, which slide into the places they would take, or the selected
 * one stepped with Alt and an arrow key. Nothing is written: the host hears
 * the new order, writes it to its data, and layout keeps it.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  type Action,
  type ActionDeps,
  type Contribution,
  type RectPose,
  type Scene,
  type Vec2,
} from '@weasel-js/core';
import { worldRectOf } from './overlays';
import type { DiagramSceneData } from './fromData';
import { reorderContribution, sequenceSlots, type ReorderSlots } from './reorder';
import { carriedWith, reorderTargetOf, type ReorderTarget } from './reorderModel';

/** Alt and an arrow key: the selected member one place along. */
export const STEP_REORDER_ACTION_ID = 'diagram.stepReorder';

/** A reorderable group's or container's members in their new order. */
export interface ReorderChange {
  /** The group's or the container's id. */
  parent: string;
  order: readonly string[];
}

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

const sceneOf = (deps: ActionDeps | undefined) => deps?.scene as DiagramScene | undefined;

function targetAt(deps: ActionDeps | undefined, id: string | null | undefined): ReorderTarget | null {
  const scene = sceneOf(deps);
  if (scene === undefined || id == null) return null;
  return reorderTargetOf(scene as never, id, (m) => worldRectOf(scene, m));
}

/** The members of the reorderable group or container a press at `at` carries
 *  one of, each with everything drawn with it, or `null` off any. */
export function groupReorderSlots(deps: ActionDeps, at: Vec2): ReorderSlots | null {
  const scene = sceneOf(deps);
  const target = targetAt(deps, deps.nodeAtPoint?.(at));
  if (scene === undefined || target === null) return null;
  return sequenceSlots(target.axis, target.members.map((m) => ({
    id: m,
    bounds: worldRectOf(scene, m) ?? { x: 0, y: 0, width: 0, height: 0 },
    carries: [...carriedWith(scene as never, m)],
  })));
}

const STEPS: readonly { key: string; role: string; axis: 'x' | 'y'; step: -1 | 1 }[] = [
  { key: 'ArrowUp', role: 'up', axis: 'y', step: -1 },
  { key: 'ArrowDown', role: 'down', axis: 'y', step: 1 },
  { key: 'ArrowLeft', role: 'left', axis: 'x', step: -1 },
  { key: 'ArrowRight', role: 'right', axis: 'x', step: 1 },
];

/** Steps the selected node's member one place toward the start (`-1`) or the end (`1`). */
export function createStepReorderAction(report: (change: ReorderChange) => void): Action {
  const selectedTarget = (deps: ActionDeps | undefined) => targetAt(deps, deps?.selection?.get()[0]);
  return {
    id: STEP_REORDER_ACTION_ID,
    label: 'Move along',
    group: 'diagram',
    defaultBinding: STEPS.map(({ key, role, axis, step }) => ({
      spec: { kind: 'key' as const, key, mods: { alt: true } },
      opts: { id: `${STEP_REORDER_ACTION_ID}.${role}`, params: { axis, step } },
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
        report({ parent: target.parent, order });
      },
    },
    enabled: (deps) => (selectedTarget(deps) !== null ? true : ActionDisabledReason.NotApplicable),
  };
}

const onBody = bodyPredicate((target) => target === 'selected-body' || target === 'unselected-body');

/** Everything `DiagramView` installs for `onReorder`: the reorder drag,
 *  sliding, pressed on a node's body, and the step action. */
export function groupReorderContribution(report: (change: ReorderChange) => void): Contribution {
  const drag = reorderContribution({
    slots: groupReorderSlots,
    requires: ['nodeAtPoint'],
    show: 'slide',
    on: onBody,
    commit: (move, ctx) => {
      const parent = targetAt(ctx.deps, move.id)?.parent;
      if (parent !== undefined) report({ parent, order: move.order });
    },
  });
  return { ...drag, id: 'weasel-diagram-reorder', actions: [...(drag.actions ?? []), createStepReorderAction(report)] };
}

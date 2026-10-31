/**
 * Dragging a sequence's parts: a message or note to another row, a head to
 * another column, a message's end to another lifeline. Each drag previews the
 * parts it carries and, on release, hands one edit of the root's data to
 * `commit`, which by default replaces it in the scene as one undo entry.
 */
import type { Action, Contribution, InvocationCtx, OngoingHandle, RectPose, RenderLayer, Scene, Vec2 } from '@weasel-js/core';
import { moveParticipant, moveStep, reconnectMessage } from './edit';
import { sequenceCommitOf, type SequenceEditOptions } from './commit';
import { SELECT_SEQUENCE_PART_ACTION_ID, selectSequencePartAction } from './select';
import { SEQUENCE_AFFORDANCE_KIND, placedSequences, sequenceLayer, sequenceScratchOf, type PlacedSequence, type SequenceScratch } from './layer';
import { sequencePartOf, sequenceRootOf } from './trait';
import type { SequenceData } from './types';

/** The action that drags a sequence part. */
export const SEQUENCE_DRAG_ACTION_ID = 'diagram.sequence.drag';
/** The action that absorbs the rest of a press on a sequence part, so it reaches neither marquee nor pan. */
export const GRAB_SEQUENCE_ACTION_ID = 'diagram.sequence.grab';

type AnyScene = Scene<unknown, string, unknown>;

/** What a drag captured at its press, read-only after. */
interface Press {
  scratch: SequenceScratch;
  scene: AnyScene;
  root: PlacedSequence;
  data: SequenceData;
  start: Vec2;
  /** The ids of the parts the drag carries, and their poses at the press. */
  carried: ReadonlyMap<string, RectPose>;
}

/** Whether part `node` of the sequence belongs to what a press on `s` carries. */
function carries(s: SequenceScratch, part: NonNullable<ReturnType<typeof sequencePartOf>>): boolean {
  if (s.part === 'head') {
    if (part.target !== undefined) return 'participant' in part.target && part.target.participant === s.id;
    return part.id === s.id && ['head', 'lifeline', 'destroy', 'activation'].includes(part.part);
  }
  if (s.part === 'step') {
    return part.id === s.id || (part.target !== undefined && (('step' in part.target && part.target.step === s.id)
      || ('fragment' in part.target && part.target.fragment === s.id)));
  }
  return s.part === 'end' && part.part === 'message' && part.id === s.id;
}

function pressOf(ctx: InvocationCtx): Press | null {
  const scratch = sequenceScratchOf(ctx.drag?.affordance);
  const scene = ctx.deps.scene as AnyScene | undefined;
  const node = scratch === null ? undefined : scene?.get(scratch.root as never);
  const held = node === undefined ? null : sequenceRootOf(node);
  const root = scene === undefined || held === null ? undefined : placedSequences(scene).find((p) => p.id === scratch!.root);
  if (scratch === null || scene === undefined || held === null || root === undefined) return null;
  const carried = new Map<string, RectPose>();
  for (const id of scene.childrenOf(scratch.root as never)) {
    const child = scene.get(id)!;
    const part = sequencePartOf(child);
    if (part !== null && carries(scratch, part)) carried.set(id, child.pose as RectPose);
  }
  return { scratch, scene, root, data: held.sequence, start: ctx.drag?.start ?? { x: ctx.world.x, y: ctx.world.y }, carried };
}

/** The nearest of `xs` to `x`, by index. */
const nearest = (xs: readonly number[], x: number): number =>
  xs.reduce((best, v, i) => (Math.abs(v - x) < Math.abs(xs[best]! - x) ? i : best), 0);

/** The data the drag leaves with the pointer at `at`, and what undo calls it. */
function proposed(p: Press, at: Vec2): { data: SequenceData; label: string } {
  const { geometry, origin } = p.root;
  const local = { x: at.x - origin.x, y: at.y - origin.y };
  const { scratch } = p;
  if (scratch.part === 'box') return { data: p.data, label: '' };
  if (scratch.part === 'head') {
    const index = geometry.columns.filter((c) => c.x < local.x).length;
    return { data: moveParticipant(p.data, scratch.id, index), label: 'Move participant' };
  }
  if (scratch.part === 'end') {
    const column = geometry.columns[nearest(geometry.columns.map((c) => c.x), local.x)];
    if (column === undefined) return { data: p.data, label: '' };
    return { data: reconnectMessage(p.data, scratch.id, scratch.end!, column.id), label: 'Reconnect message' };
  }
  const slot = geometry.slots[nearest(geometry.slots.map((s) => s.y), local.y)];
  if (slot === undefined) return { data: p.data, label: '' };
  return { data: moveStep(p.data, scratch.id, slot.place), label: 'Move step' };
}

/** A carried part's pose with the pointer at `at`: along the drag's axis, or for an end, its line stretched to the pointer. */
function previewOf(p: Press, id: string, pose: RectPose, at: Vec2): RectPose {
  const dx = at.x - p.start.x;
  const dy = at.y - p.start.y;
  if (p.scratch.part === 'head') return { ...pose, x: pose.x + dx };
  if (p.scratch.part === 'step') return { ...pose, y: pose.y + dy };
  const m = p.root.geometry.messages.find((q) => q.id === p.scratch.id);
  if (m === undefined || id !== `${p.scratch.root}/msg:${p.scratch.id}` || m.loopY !== undefined) return pose;
  // The line's other end stays; the dragged one follows the pointer.
  const shift = pose.x - Math.min(m.x1, m.x2);
  const still = (p.scratch.end === 'from' ? m.x2 : m.x1) + shift;
  const moving = (p.scratch.end === 'from' ? m.x1 : m.x2) + shift + dx;
  return { ...pose, x: Math.min(still, moving), width: Math.abs(moving - still) };
}

/** The `diagram.sequence.drag` action: an ongoing drag of whatever sequence part was pressed. */
export function createSequenceDragAction(opts: SequenceEditOptions = {}): Action {
  const commit = sequenceCommitOf(opts);
  return {
    id: opts.id ?? SEQUENCE_DRAG_ACTION_ID,
    label: 'Move sequence part',
    group: 'diagram',
    requires: ['scene'],
    eligible: { mode: 'normal' },
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const p = pressOf(ctx);
        if (p === null) return {};
        // Null until the pointer moves, so a still click commits nothing.
        let at: Vec2 | null = null;
        let open = true;
        return {
          kind: 'diagram-sequence-drag',
          onMove(move: InvocationCtx): void {
            at = { x: move.world.x, y: move.world.y };
          },
          previewIds: () => (open && at !== null ? [...p.carried.keys()] : null),
          previewPose: (id) => {
            const pose = p.carried.get(id);
            return open && at !== null && pose !== undefined ? previewOf(p, id, pose, at) : null;
          },
          onEnd(end: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason !== 'commit' || at === null) return;
            const next = proposed(p, { x: end.world.x, y: end.world.y });
            if (next.data !== p.data) commit({ id: p.scratch.root, data: next.data, label: next.label }, { ...end, deps: { ...end.deps, scene: p.scene as never } });
          },
        };
      },
    },
    enabled: () => true as const,
  };
}

const grab: Action = {
  id: GRAB_SEQUENCE_ACTION_ID, label: 'Grab sequence part', group: 'diagram',
  invoker: { timing: 'immediate', run: () => {} }, enabled: () => true as const,
};

/**
 * Both halves of sequence editing: the layer to `registerLayer` — last, so a
 * sequence part wins over anything beside it — and the contribution to pass
 * as `ambient`, which carries the drag. Like `diagramPorts`, one without the
 * other fails quietly. Text is edited in place by the host's text editor,
 * through `foldSequenceText`.
 */
export function diagramSequence(opts: SequenceEditOptions & { scene: Scene<unknown, string, unknown> }): {
  layer: RenderLayer<unknown>; contribution: Contribution;
} {
  const actionId = opts.id ?? SEQUENCE_DRAG_ACTION_ID;
  const target = `affordance:${SEQUENCE_AFFORDANCE_KIND}` as const;
  return {
    layer: sequenceLayer(opts.scene),
    contribution: {
      id: 'weasel-diagram-sequence',
      eligibility: { claimed: true },
      actions: [createSequenceDragAction({ ...opts, id: actionId }), grab, selectSequencePartAction],
      bindings: [
        { spec: { kind: 'drag', target }, actionId, opts: { id: 'weasel-diagram-sequence.drag' } },
        { spec: { kind: 'pointerDown', target }, actionId: GRAB_SEQUENCE_ACTION_ID, opts: { id: 'weasel-diagram-sequence.pointerDown' } },
        { spec: { kind: 'click', target, mods: { shift: 'optional' } }, actionId: SELECT_SEQUENCE_PART_ACTION_ID, opts: { id: 'weasel-diagram-sequence.click' } },
      ],
    },
  };
}

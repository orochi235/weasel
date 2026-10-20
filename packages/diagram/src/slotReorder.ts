/**
 * Reorder: dragging one item of a drawn sequence — boxes in a row, rows in a
 * column — to another place in it. The dragged item follows the pointer along
 * the sequence's axis, an insertion bar marks the gap it would land in, and a
 * release hands the move to a commit. Nothing is written to the scene.
 */
import {
  ActionDisabledReason,
  type Action,
  type ActionDeps,
  type Contribution,
  type GestureBinding,
  type InvocationCtx,
  type OngoingHandle,
  type OngoingOverlay,
  type Vec2,
} from '@weasel-js/core';

/** The action that drags an item of a sequence to another place in it. */
export const REORDER_ACTION_ID = 'diagram.reorder';

type Box = { x: number; y: number; width: number; height: number };

/** One item of a sequence, in world units. */
export interface ReorderItem {
  /** The scene node drawn for it, carried along the axis while it drags. */
  id: string;
  bounds: Box;
  /** Where a press picks it up. Default `bounds`. */
  grip?: Box;
}

/** A place an item can land: before `items[index]`, or after the last at `items.length`. */
export interface ReorderGap {
  index: number;
  /** The insertion bar's two ends. */
  a: Vec2;
  b: Vec2;
}

/** A drawn sequence: its items in order along `axis`, and the gaps between them. */
export interface ReorderSlots {
  axis: 'x' | 'y';
  items: readonly ReorderItem[];
  gaps: readonly ReorderGap[];
}

/** The item at index `from` dropped in gap `to`. */
export interface ReorderMove {
  id: string;
  from: number;
  to: number;
}

/** Options for {@link createReorderAction}. */
export interface ReorderOptions {
  /** Default {@link REORDER_ACTION_ID}. */
  id?: string;
  /** Default 'Reorder'. */
  label?: string;
  /** The sequence as drawn now, or `null` when there is none. Asked on each press. */
  slots: (deps: ActionDeps) => ReorderSlots | null;
  /** Whether a drop may land. The bar draws refused where not. Default: every drop. */
  canDrop?: (move: ReorderMove) => boolean;
  /** Called once, on release over a gap that is not the item's own and that `canDrop` allows. */
  commit: (move: ReorderMove, ctx: InvocationCtx) => void;
}

const END_GAP = 24;

const inside = (p: Vec2, b: Box) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/**
 * The slots of items laid out in order along `axis`: a gap halfway between
 * each pair, its bar spanning both across the axis, and one beyond each end,
 * as far out as the nearest interior gap's half, or `END_GAP / 2` with none.
 */
export function sequenceSlots(axis: 'x' | 'y', items: readonly ReorderItem[]): ReorderSlots {
  const [along, across, size, depth] = axis === 'x' ? ['x', 'y', 'width', 'height'] as const : ['y', 'x', 'height', 'width'] as const;
  const lo = (b: Box) => b[along];
  const hi = (b: Box) => b[along] + b[size];
  const bar = (at: number, boxes: readonly Box[]): Pick<ReorderGap, 'a' | 'b'> => {
    const from = Math.min(...boxes.map((b) => b[across]));
    const to = Math.max(...boxes.map((b) => b[across] + b[depth]));
    const point = (c: number) => (axis === 'x' ? { x: at, y: c } : { x: c, y: at });
    return { a: point(from), b: point(to) };
  };
  const boxes = items.map((i) => i.bounds);
  const halves = boxes.slice(1).map((b, k) => (lo(b) - hi(boxes[k]!)) / 2);
  const gaps: ReorderGap[] = [];
  if (boxes.length === 0) return { axis, items, gaps };
  gaps.push({ index: 0, ...bar(lo(boxes[0]!) - (halves[0] ?? END_GAP / 2), [boxes[0]!]) });
  for (let k = 1; k < boxes.length; k++) gaps.push({ index: k, ...bar(hi(boxes[k - 1]!) + halves[k - 1]!, [boxes[k - 1]!, boxes[k]!]) });
  const last = boxes[boxes.length - 1]!;
  gaps.push({ index: boxes.length, ...bar(hi(last) + (halves[halves.length - 1] ?? END_GAP / 2), [last]) });
  return { axis, items, gaps };
}

/** What a drag holds once it has picked an item. */
interface Held {
  slots: ReorderSlots;
  from: number;
  item: ReorderItem;
  pose: Box | undefined;
  start: Vec2;
}

function pickAt(slots: ReorderSlots | null, at: Vec2): { from: number; item: ReorderItem } | null {
  const from = slots?.items.findIndex((i) => inside(at, i.grip ?? i.bounds)) ?? -1;
  return from < 0 ? null : { from, item: slots!.items[from]! };
}

/** The gap nearest `at` along the axis, or `null` for one beside the item, where a drop changes nothing. */
function gapAt(held: Held, at: Vec2): ReorderGap | null {
  const { axis, gaps } = held.slots;
  let best: ReorderGap | null = null;
  for (const g of gaps) if (best === null || Math.abs(g.a[axis] - at[axis]) < Math.abs(best.a[axis] - at[axis])) best = g;
  return best === null || best.index === held.from || best.index === held.from + 1 ? null : best;
}

/** The `diagram.reorder` action: an ongoing drag carrying one item of a sequence. */
export function createReorderAction(opts: ReorderOptions): Action {
  const { canDrop = () => true } = opts;
  return {
    id: opts.id ?? REORDER_ACTION_ID,
    label: opts.label ?? 'Reorder',
    group: 'diagram',
    requires: ['scene'],
    cursor: 'grab',
    activeCursor: 'grabbing',
    enabled: (deps, at) => (deps === undefined || at === undefined || pickAt(opts.slots(deps), at) !== null
      ? true
      : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const start = ctx.drag?.start ?? ctx.world;
        const slots = opts.slots(ctx.deps);
        const picked = pickAt(slots, start);
        if (slots === null || picked === null) return {};
        const pose = ctx.deps.scene?.get(picked.item.id as never)?.pose as Box | undefined;
        const held: Held = { slots, ...picked, pose, start: { x: start.x, y: start.y } };
        let current: Vec2 = { x: ctx.world.x, y: ctx.world.y };
        let open = true;
        const moveTo = (gap: ReorderGap): ReorderMove => ({ id: held.item.id, from: held.from, to: gap.index });
        const { axis } = slots;
        return {
          kind: 'diagram-reorder',
          onMove(moveCtx: InvocationCtx): void {
            current = { x: moveCtx.world.x, y: moveCtx.world.y };
          },
          previewIds: () => (open && held.pose !== undefined ? [held.item.id] : null),
          previewPose: (id) => (id !== held.item.id || held.pose === undefined
            ? null
            : { ...held.pose, [axis]: held.pose[axis] + current[axis] - held.start[axis] }),
          previewOpaqueIds: () => [held.item.id],
          overlay(): OngoingOverlay | null {
            const gap = open ? gapAt(held, current) : null;
            if (gap === null) return null;
            return { kind: 'polyline', points: [gap.a, gap.b], role: canDrop(moveTo(gap)) ? 'insert' : 'refused' };
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            open = false;
            if (reason === 'cancel') return;
            const gap = gapAt(held, { x: endCtx.world.x, y: endCtx.world.y });
            if (gap === null || !canDrop(moveTo(gap))) return;
            opts.commit(moveTo(gap), { ...endCtx, deps: ctx.deps });
          },
        };
      },
    },
  };
}

/** The binding that starts a reorder: any drag, which the action declines off an item's grip. */
export function reorderBinding(actionId: string = REORDER_ACTION_ID): GestureBinding {
  return { spec: { kind: 'drag' }, actionId, yields: true };
}

/** The reorder action and its binding, to pass as `ambient`. */
export function reorderContribution(opts: ReorderOptions): Contribution {
  const actionId = opts.id ?? REORDER_ACTION_ID;
  return {
    id: `weasel-diagram-reorder:${actionId}`,
    eligibility: { always: true },
    actions: [createReorderAction({ ...opts, id: actionId })],
    bindings: [reorderBinding(actionId)],
  };
}

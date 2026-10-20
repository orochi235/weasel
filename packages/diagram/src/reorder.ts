/**
 * Reorder: dragging one item of a drawn sequence — boxes in a row, rows in a
 * column, the members of a group — to another place in it. The item follows
 * the pointer along the sequence's axis and lands in the gap nearest its
 * middle. A `'bar'` drag marks that gap with an insertion bar; a `'slide'`
 * drag slides the other items into the places they would take. Either way
 * the release hands the move to a commit, and nothing is written to the scene.
 */
import {
  ActionDisabledReason,
  bodyPredicate,
  type Action,
  type ActionDeps,
  type Contribution,
  type GestureBinding,
  type InvocationCtx,
  type OngoingHandle,
  type OngoingOverlay,
  type TargetPredicate,
  type Vec2,
} from '@weasel-js/core';
import { slideOthers, type Box } from './reorderSlide';

/** The action that drags an item of a sequence to another place in it. */
export const REORDER_ACTION_ID = 'diagram.reorder';

/** One item of a sequence, in world units. */
export interface ReorderItem {
  /** The scene node drawn for it. */
  id: string;
  bounds: Box;
  /** Where a press picks it up. Default `bounds`. */
  grip?: Box;
  /** The scene nodes that move with it. Default `[id]`. */
  carries?: readonly string[];
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

/** The item at index `from` dropped in gap `to`, and every item's id in the order that leaves. */
export interface ReorderMove {
  id: string;
  from: number;
  to: number;
  order: readonly string[];
}

/** Options for {@link createReorderAction}. */
export interface ReorderOptions {
  /** Default {@link REORDER_ACTION_ID}. */
  id?: string;
  /** Default 'Reorder'. */
  label?: string;
  /** The sequence a press at `at` picks from, as drawn now, or `null` when there is none. */
  slots: (deps: ActionDeps, at: Vec2) => ReorderSlots | null;
  /** Deps `slots` reads beyond `scene`. */
  requires?: Action['requires'];
  /**
   * `'bar'` (default) carries the item alone and draws an insertion bar at its
   * gap. `'slide'` carries everything each item `carries` as pose overrides,
   * so what derives from them follows, and slides the others into place; the
   * overrides stay after a commit until the scene next changes.
   */
  show?: 'bar' | 'slide';
  /** Whether a drop may land. The bar draws refused, or nothing slides, where not. Default: every drop. */
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
}

function pickAt(slots: ReorderSlots | null, at: Vec2): { from: number; item: ReorderItem } | null {
  const from = slots?.items.findIndex((i) => inside(at, i.grip ?? i.bounds)) ?? -1;
  return from < 0 ? null : { from, item: slots!.items[from]! };
}

/** The gap nearest the carried item's middle, moved `by` along the axis, or
 *  `null` for one beside the item, where a drop changes nothing. */
function gapAt(held: Held, by: number): ReorderGap | null {
  const { axis, gaps } = held.slots;
  const size = axis === 'x' ? 'width' : 'height';
  const mid = held.item.bounds[axis] + held.item.bounds[size] / 2 + by;
  let best: ReorderGap | null = null;
  for (const g of gaps) if (best === null || Math.abs(g.a[axis] - mid) < Math.abs(best.a[axis] - mid)) best = g;
  return best === null || best.index === held.from || best.index === held.from + 1 ? null : best;
}

function moveOf(held: Held, gap: ReorderGap): ReorderMove {
  const order = held.slots.items.map((i) => i.id);
  order.splice(held.from, 1);
  order.splice(gap.index > held.from ? gap.index - 1 : gap.index, 0, held.item.id);
  return { id: held.item.id, from: held.from, to: gap.index, order };
}

/** The `diagram.reorder` action: an ongoing drag carrying one item of a sequence. */
export function createReorderAction(opts: ReorderOptions): Action {
  const { canDrop = () => true, show = 'bar' } = opts;
  return {
    id: opts.id ?? REORDER_ACTION_ID,
    label: opts.label ?? 'Reorder',
    group: 'diagram',
    requires: ['scene', ...(opts.requires ?? [])],
    cursor: 'grab',
    activeCursor: 'grabbing',
    enabled: (deps, at) => (deps === undefined || at === undefined || pickAt(opts.slots(deps, at), at) !== null
      ? true
      : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const start = { x: (ctx.drag?.start ?? ctx.world).x, y: (ctx.drag?.start ?? ctx.world).y };
        const slots = opts.slots(ctx.deps, start);
        const picked = pickAt(slots, start);
        if (slots === null || picked === null) return {};
        const held: Held = { slots, ...picked };
        const { axis } = slots;
        let by = ctx.world[axis] - start[axis];
        let open = true;
        // The overlay is read every frame; ask about each gap once a drag.
        const verdicts = new Map<number, ReorderMove | null>();
        const landing = (gap: ReorderGap | null): ReorderMove | null => {
          if (gap === null) return null;
          if (!verdicts.has(gap.index)) {
            const move = moveOf(held, gap);
            verdicts.set(gap.index, canDrop(move) ? move : null);
          }
          return verdicts.get(gap.index)!;
        };
        const finish = (endCtx: InvocationCtx, reason: 'commit' | 'cancel'): ReorderMove | null => {
          open = false;
          by = endCtx.world[axis] - start[axis];
          const move = reason === 'commit' ? landing(gapAt(held, by)) : null;
          if (move !== null) opts.commit(move, { ...endCtx, deps: ctx.deps });
          return move;
        };

        if (show === 'slide') {
          const slide = ctx.deps.scene === undefined ? null : slideOthers(ctx.deps.scene, held.slots, held.item.id);
          return {
            kind: 'diagram-reorder',
            onMove(moveCtx: InvocationCtx): void {
              by = moveCtx.world[axis] - start[axis];
              slide?.show(landing(gapAt(held, by))?.order ?? null, by);
            },
            onEnd(endCtx, reason): void {
              const move = finish(endCtx, reason);
              if (move === null) slide?.drop();
              else slide?.keep();
            },
          };
        }

        const pose = ctx.deps.scene?.get(held.item.id as never)?.pose as Box | undefined;
        return {
          kind: 'diagram-reorder',
          onMove(moveCtx: InvocationCtx): void {
            by = moveCtx.world[axis] - start[axis];
          },
          previewIds: () => (open && pose !== undefined ? [held.item.id] : null),
          previewPose: (id) => (id !== held.item.id || pose === undefined ? null : { ...pose, [axis]: pose[axis] + by }),
          previewOpaqueIds: () => [held.item.id],
          overlay(): OngoingOverlay | null {
            const gap = open ? gapAt(held, by) : null;
            if (gap === null) return null;
            return { kind: 'polyline', points: [gap.a, gap.b], role: landing(gap) !== null ? 'insert' : 'refused' };
          },
          onEnd(endCtx, reason): void {
            finish(endCtx, reason);
          },
        };
      },
    },
  };
}

// Matches every press, as a bare drag does, but ranks a step above one, so it
// is asked before an ambient pan; the action declines off an item's grip.
const ANYWHERE = bodyPredicate(() => true);

/** The binding that starts a reorder: a drag pressed on `on`, by default anywhere; the action declines off an item's grip. */
export function reorderBinding(actionId: string = REORDER_ACTION_ID, on: TargetPredicate = ANYWHERE): GestureBinding {
  return { spec: { kind: 'drag', target: { kindOf: on } }, actionId };
}

/** The reorder action and its binding, to pass as `ambient`. */
export function reorderContribution(opts: ReorderOptions & { on?: TargetPredicate }): Contribution {
  const actionId = opts.id ?? REORDER_ACTION_ID;
  return {
    id: `weasel-diagram-reorder:${actionId}`,
    eligibility: { always: true },
    actions: [createReorderAction({ ...opts, id: actionId })],
    bindings: [reorderBinding(actionId, opts.on)],
  };
}

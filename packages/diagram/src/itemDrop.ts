/**
 * An item carried in from a list outside the canvas — a palette the host
 * renders — and dropped onto a shape, a container, or the bare canvas. The
 * host makes an element a source with {@link dragItemProps}; the canvas hears
 * the carry, draws where it would land, and reports the drop. Nothing is
 * written: the host adds what the item stands for to its data.
 */
import {
  refusalOf,
  startCarry,
  useLatest,
  type Action,
  type Carry,
  type CarryCallbacks,
  type Contribution,
  type DropVerdict,
  type InvocationCtx,
  type OngoingHandle,
  type OngoingOverlay,
  type RectPose,
  type Scene,
} from '@weasel-js/core';
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { DiagramSceneData } from './fromData';
import { itemDropTargetAt, outlineOf, type ItemDropTarget } from './itemDropTarget';
import type { ParticipantSource } from './portAffordance';

export type { ItemDropTarget } from './itemDropTarget';

/** The carry type an item travels as. */
export const DIAGRAM_ITEM_CARRY = 'weasel-diagram/item';

/** The action a carried item's drop runs. */
export const ITEM_DROP_ACTION_ID = 'diagram.dropItem';

/** An item dropped on the diagram: the host's own value, and where it landed. */
export interface ItemDrop extends ItemDropTarget {
  item: unknown;
}

/** Whether `item` may land where `target` says. */
export type CanDropItem = (item: unknown, target: ItemDropTarget) => DropVerdict;

/** Carry `item` from the press `down` over the page; a diagram the pointer is
 *  released over reports it to `onDropItem`. */
export function startItemDrag(down: PointerEvent | ReactPointerEvent, item: unknown, cb?: CarryCallbacks): Carry {
  return startCarry(down.currentTarget as Element, down, { type: DIAGRAM_ITEM_CARRY, value: item }, cb);
}

/** Props that make an element a source of `item`: a press with the main
 *  button carries it. Give the element `touch-action: none` for touch. */
export function dragItemProps(item: unknown, cb?: CarryCallbacks): { onPointerDown: (e: ReactPointerEvent) => void } {
  return {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startItemDrag(e, item, cb);
    },
  };
}

/** Options for {@link createItemDropAction}. */
export interface ItemDropOptions {
  participants: ParticipantSource<RectPose>;
  /** Default: every drop lands. */
  canDrop?: CanDropItem;
  report: (drop: ItemDrop) => void;
}

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

const ANY = 'optional' as const;

/** The ongoing action a carried item runs from coming over the canvas to its release. */
export function createItemDropAction(opts: ItemDropOptions): Action {
  const { participants, report, canDrop = () => true } = opts;
  return {
    id: ITEM_DROP_ACTION_ID,
    label: 'Drop an item',
    group: 'diagram',
    requires: ['scene'],
    defaultBinding: [{
      spec: { kind: 'carry', types: [DIAGRAM_ITEM_CARRY], mods: { alt: ANY, ctrl: ANY, meta: ANY, shift: ANY } },
      opts: { id: `${ITEM_DROP_ACTION_ID}.carry` },
    }],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const scene = ctx.deps.scene as DiagramScene | undefined;
        if (scene === undefined || ctx.carry === undefined) return {};
        const item = ctx.carry.value;
        // The host is asked once per place, not every frame.
        const verdicts = new Map<string, DropVerdict>();
        const over = (c: InvocationCtx) => {
          const { gap, ...drop } = itemDropTargetAt(scene, participants, c.world);
          const key = `${drop.target}|${drop.container}|${drop.index}`;
          if (!verdicts.has(key)) verdicts.set(key, canDrop(item, drop));
          return { drop, gap, verdict: verdicts.get(key)! };
        };
        let now = over(ctx);
        let open = true;
        return {
          kind: 'diagram-item-drop',
          onMove(moveCtx) {
            now = over(moveCtx);
          },
          overlay(): readonly OngoingOverlay[] | null {
            const { drop, gap, verdict } = now;
            if (!open || drop.target === null || verdict === false) return null;
            const reason = refusalOf(verdict);
            const box = outlineOf(scene, drop.target, reason === null ? 'target' : 'refused');
            const out: OngoingOverlay[] = box === null ? [] : [box];
            if (reason !== null) out.push({ kind: 'reason', at: drop.at, text: reason });
            else if (gap !== null) out.push({ kind: 'polyline', points: [gap.a, gap.b], role: 'insert' });
            return out;
          },
          onEnd(endCtx, reason) {
            open = false;
            if (reason !== 'commit') return;
            now = over(endCtx);
            if (now.verdict === true) report({ item, ...now.drop });
          },
        };
      },
    },
  };
}

/** The item drop as a contribution, to pass as `ambient`. */
export function itemDropContribution(opts: ItemDropOptions): Contribution {
  return {
    id: 'weasel-diagram-item-drop',
    eligibility: { always: true },
    actions: [createItemDropAction(opts)],
  };
}

/** The item drop `DiagramView` installs while `onDropItem` is set, asking the latest `canDropItem`. */
export function useItemDrop(
  participants: ParticipantSource<RectPose>,
  props: { onDropItem?: ((drop: ItemDrop) => void) | undefined; canDropItem?: CanDropItem | undefined },
): Contribution | null {
  const latest = useLatest(props);
  const on = props.onDropItem !== undefined;
  return useMemo(() => (on
    ? itemDropContribution({
        participants,
        canDrop: (item, target) => latest.current.canDropItem?.(item, target) ?? true,
        report: (drop) => latest.current.onDropItem?.(drop),
      })
    : null), [on, participants, latest]);
}

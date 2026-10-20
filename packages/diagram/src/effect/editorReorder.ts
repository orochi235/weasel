/** The reorders an editor installs under a look that places stages itself:
 *  a main-line stage dragged along the line, and a lane dragged by its header. */
import type { Contribution } from '@weasel-js/core';
import { reorderContribution, sequenceSlots, type ReorderMove, type ReorderSlots } from '../reorder';
import { moveInChain } from './chainEdit';
import type { LookOrder } from './draw';
import { ensureWireIds, setLaneOrder } from './edit';
import { laneTypeOf } from './lanes';
import { mainChain } from './mainChain';
import type { EffectDoc } from './types';

/** The action that drags a lane to another place among the lanes. */
export const REORDER_LANES_ACTION_ID = 'diagram.reorderLanes';

type Box = { x: number; y: number; width: number; height: number };

/** What the reorders read, as of the press. */
export interface ReorderSource {
  doc: EffectDoc;
  order: LookOrder | undefined;
  laneOrder: LookOrder | undefined;
  /** A scene node's box as drawn. */
  boxOf: (id: string) => Box | undefined;
  onChange: (next: EffectDoc, label: string) => void;
}

function slotsOf(order: LookOrder | undefined, boxOf: ReorderSource['boxOf']): ReorderSlots | null {
  if (order === undefined) return null;
  const items = order.items.flatMap((i) => {
    const bounds = boxOf(i.id);
    return bounds === undefined ? [] : [{ id: i.id, bounds, ...(i.grip !== undefined ? { grip: i.grip } : {}) }];
  });
  return items.length < 2 ? null : sequenceSlots(order.axis, items);
}

/** The doc with the drawn stage moved as `move` says. A look may leave stages
 *  of the main chain out of its order, as rack does a skip it draws as an arc,
 *  so the drawn gap is read as "before that drawn stage". */
export function stageMove(doc: EffectDoc, order: LookOrder, move: ReorderMove): EffectDoc | null {
  const chain = mainChain(doc.pipeline);
  const before = order.items[move.to];
  return moveInChain(ensureWireIds(doc), move.id, before === undefined ? chain.length : chain.indexOf(before.id));
}

/** The doc with the lane order the drag leaves. */
export function laneMove(doc: EffectDoc, order: LookOrder, move: ReorderMove): EffectDoc {
  const types = order.items.flatMap((i) => laneTypeOf(i.id) ?? []);
  const moved = types.filter((_, k) => k !== move.from);
  moved.splice(move.to > move.from ? move.to - 1 : move.to, 0, types[move.from]!);
  return setLaneOrder(doc, moved);
}

/** Both reorders, each reading `now()` when it is pressed and released. */
export function editorReorders(now: () => ReorderSource): Contribution[] {
  return [
    reorderContribution({
      label: 'Reorder',
      slots: () => slotsOf(now().order, now().boxOf),
      canDrop: (move) => {
        const { doc, order } = now();
        return order !== undefined && stageMove(doc, order, move) !== null;
      },
      commit: (move) => {
        const { doc, order, onChange } = now();
        const next = order === undefined ? null : stageMove(doc, order, move);
        if (next !== null) onChange(next, 'Reorder');
      },
    }),
    reorderContribution({
      id: REORDER_LANES_ACTION_ID,
      label: 'Reorder lanes',
      slots: () => slotsOf(now().laneOrder, now().boxOf),
      commit: (move) => {
        const { doc, laneOrder, onChange } = now();
        if (laneOrder !== undefined) onChange(laneMove(doc, laneOrder, move), 'Reorder lanes');
      },
    }),
  ];
}

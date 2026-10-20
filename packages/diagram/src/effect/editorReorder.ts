/** The reorders an editor installs under a look that places stages itself:
 *  a main-line stage dragged along the line, a lane dragged by its header,
 *  and a group dragged along the line by its title. */
import type { Contribution } from '@weasel-js/core';
import { reorderContribution, sequenceSlots, type ReorderMove, type ReorderSlots } from '../reorder';
import { moveInChain, moveRunInChain } from './chainEdit';
import type { LookOrder } from './draw';
import { ensureWireIds, setLaneOrder } from './edit';
import { groupRuns, groupSlotsAt, unitStages } from './groupOrder';
import { laneTypeOf } from './lanes';
import { mainChain } from './mainChain';
import type { EffectDoc } from './types';

/** The action that drags a lane to another place among the lanes. */
export const REORDER_LANES_ACTION_ID = 'diagram.reorderLanes';

/** The action that drags a group by its title to another place along the main line. */
export const REORDER_GROUPS_ACTION_ID = 'diagram.reorderGroups';

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

/** `next`, or `null` where it splits a group whose stages sat together on the chain in `doc`. */
function keepsGroups(doc: EffectDoc, next: EffectDoc | null): EffectDoc | null {
  if (next === null) return null;
  const after = groupRuns(next.pipeline, mainChain(next.pipeline));
  for (const [id, run] of groupRuns(doc.pipeline, mainChain(doc.pipeline))) if (run !== null && after.get(id) === null) return null;
  return next;
}

/** The doc with the drawn stage moved as `move` says. A look may leave stages
 *  of the main chain out of its order, as rack does a skip it draws as an arc,
 *  so the drawn gap is read as "before that drawn stage". `null` also where
 *  the move would split a group whose stages sat together on the chain. */
export function stageMove(doc: EffectDoc, order: LookOrder, move: ReorderMove): EffectDoc | null {
  const chain = mainChain(doc.pipeline);
  const before = order.items[move.to];
  return keepsGroups(doc, moveInChain(ensureWireIds(doc), move.id, before === undefined ? chain.length : chain.indexOf(before.id)));
}

/**
 * The doc with `move.id`, one of the drawn `units` (groups and stages), moved
 * along the chain as one. The gap is read as "before that unit's first drawn
 * stage", as {@link stageMove} reads it, and past the end as after the last
 * unit's last drawn stage. `null` where the unit is not whole on the chain,
 * or the move would split a group.
 */
export function groupMove(doc: EffectDoc, order: LookOrder, units: readonly string[], move: ReorderMove): EffectDoc | null {
  const chain = mainChain(doc.pipeline);
  const drawn = new Set(order.items.map((i) => i.id));
  const indices = (unit: string, drawnOnly: boolean) =>
    [...unitStages(doc, unit)].flatMap((s) => (chain.includes(s) && (!drawnOnly || drawn.has(s)) ? [chain.indexOf(s)] : []));
  const run = indices(move.id, false);
  if (run.length === 0) return null;
  const [i, j] = [Math.min(...run), Math.max(...run)];
  if (j - i + 1 !== run.length) return null;
  const before = units[move.to];
  const edge = before !== undefined ? indices(before, true) : indices(units[units.length - 1] ?? move.id, true).map((k) => k + 1);
  if (edge.length === 0) return null;
  const to = before !== undefined ? Math.min(...edge) : Math.max(...edge);
  return keepsGroups(doc, moveRunInChain(ensureWireIds(doc), chain[i]!, chain[j]!, to));
}

/** The doc with the lane order the drag leaves. */
export function laneMove(doc: EffectDoc, order: LookOrder, move: ReorderMove): EffectDoc {
  const types = order.items.flatMap((i) => laneTypeOf(i.id) ?? []);
  const moved = types.filter((_, k) => k !== move.from);
  moved.splice(move.to > move.from ? move.to - 1 : move.to, 0, types[move.from]!);
  return setLaneOrder(doc, moved);
}

/** The drawn units a move was made among, as they stood before it. */
function unitsBefore(move: ReorderMove): string[] {
  const units = move.order.filter((id) => id !== move.id);
  units.splice(move.from, 0, move.id);
  return units;
}

function groupReorder(now: () => ReorderSource): Contribution {
  const moved = (move: ReorderMove) => {
    const { doc, order } = now();
    return order === undefined ? null : groupMove(doc, order, unitsBefore(move), move);
  };
  return reorderContribution({
    id: REORDER_GROUPS_ACTION_ID,
    label: 'Reorder group',
    slots: (_, at) => groupSlotsAt(now(), at),
    canDrop: (move) => moved(move) !== null,
    commit: (move) => {
      const next = moved(move);
      if (next !== null) now().onChange(next, 'Reorder group');
    },
  });
}

/** All three reorders, each reading `now()` when it is pressed and released. */
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
    groupReorder(now),
  ];
}

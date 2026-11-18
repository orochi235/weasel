/** A drag out of the structure tree: off its page onto the unplaced list, or into whatever takes it outside. */
import { useRef, useState } from 'react';
import type { TreeDragEffect } from '@weasel-js/ui';
import { holdsPages, looseTarget, mayUnplace, type SchemaNode, type SchemaRoot, type SchemaTarget } from '@weasel-js/prefs/edit';
import type { DropOutside } from './StructurePane';

type Point = { x: number; y: number };
type Place = (paths: readonly string[], target: SchemaTarget) => void;

/** What a drag out of the tree can set down, as {@link treeDropRulesFor} gives it. */
export interface DragOutRules {
  canLand(ids: readonly string[], effect: TreeDragEffect): boolean;
  landing(ids: readonly string[], effect: TreeDragEffect): SchemaNode[];
}

/**
 * The tree's `onDragOutside` and `onDropOutside`, and the unplaced list they drop onto: `unplacedArea` is its box,
 * and `unplacing` whether a drag held over it would come off its page. `place` does a drop by its effect.
 */
export function useTreeDragOut(
  schema: SchemaRoot, pageless: boolean, readOnly: boolean, rules: DragOutRules, outside: DropOutside | undefined,
  place: Record<TreeDragEffect, Place>,
) {
  const { canLand, landing } = rules;
  const unplacedArea = useRef<HTMLDivElement | null>(null);
  const [unplacing, setUnplacing] = useState(false);
  /** Whether a drag of the nodes at `ids`, held at `point`, is over the unplaced list and may be let go there. */
  const overUnplaced = (ids: readonly string[], point: Point): boolean => {
    const box = unplacedArea.current?.getBoundingClientRect();
    if (!box || point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return false;
    return !readOnly && mayUnplace(schema, ids, pageless);
  };
  // A copy or an alias is new where it lands, so the place it is dropped is asked about it with no paths, as for a palette's node.
  const onDragOutside = (ids: readonly string[], point: Point | null, effect: TreeDragEffect): boolean => {
    // Let go over the unplaced list, a node comes off its page.
    const off = point !== null && canLand(ids, effect) && overUnplaced(ids, point);
    setUnplacing(off);
    if (off || !outside) return off;
    if (point) return canLand(ids, effect) && outside.over(landing(ids, effect), effect === 'move' ? ids : [], point);
    outside.end();
    return false;
  };
  const onDropOutside = (ids: readonly string[], point: Point, effect: TreeDragEffect): void => {
    setUnplacing(false);
    if (!canLand(ids, effect)) return;
    const target = overUnplaced(ids, point) && holdsPages(schema, pageless) ? looseTarget(schema) : outside?.target(landing(ids, effect), effect === 'move' ? ids : [], point);
    if (target) place[effect](ids, target);
  };
  return { unplacedArea, unplacing, onDragOutside, onDropOutside };
}

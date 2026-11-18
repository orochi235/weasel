/** A drag from the structure pane's palette, its shelf or its unplaced list, and where it lands. */
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { isPrefLeaf } from '@weasel-js/prefs';
import type { TreeDropHandle } from '@weasel-js/ui';
import {
  addNode, joinPath, keysOf, keysTakenAt, nodeAt, pathOf, type SchemaNode, type SchemaRoot, schemaTarget,
  type SchemaTarget, uniqueKey,
} from '@weasel-js/prefs/edit';
import type { PaletteDrag } from './Palette';
import type { DropOutside } from './StructurePane';

/** Every path above `path`, nearest last. */
const ancestorsOf = (path: string): string[] =>
  keysOf(path).slice(0, -1).map((_, i, keys) => pathOf(keys.slice(0, i + 1))!);

/** What a drop does to the schema and the tree: write the schema, move what it holds, open rows and select one. */
export interface PaletteLanding {
  onChange(next: SchemaRoot): void;
  move(paths: readonly string[], target: SchemaTarget): void;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  onSelect(paths: readonly string[]): void;
}

/**
 * Over the tree a palette drag lands where the tree marks, and elsewhere wherever `outside` takes it. A node the
 * schema holds is moved; a new one is added under a key of its own, with the rows above it opened and it selected.
 */
export function usePaletteDrop(schema: SchemaRoot, pageless: boolean, outside: DropOutside | undefined, landing: PaletteLanding) {
  const [drag, setDrag] = useState<PaletteDrag | null>(null);
  // The same, as of the event in hand: the tree asks `canDrop` at a drop no render has caught up with.
  const carrying = useRef<PaletteDrag | null>(null);
  const treeDrop = useRef<TreeDropHandle>(null);
  /** The nodes a palette drag would set down: the ones the schema holds at its paths, else the one it makes. */
  const carried = (d: PaletteDrag): SchemaNode[] => (d.from ? d.from.map((id) => nodeAt(schema, id)!) : [d.node]);
  const onDrag = (d: PaletteDrag | null) => {
    carrying.current = d;
    setDrag(d);
    if (d) outside?.over(carried(d), [], d);
    else outside?.end();
  };
  const onDrop = (d: PaletteDrag) => {
    carrying.current = d;
    const at = treeDrop.current?.targetAt(d) ?? null;
    const target = at ? schemaTarget(schema, at.parentId, at.index, pageless) : outside?.target(carried(d), [], d) ?? null;
    if (!target) return;
    if (d.from !== undefined) {
      landing.move(d.from, target);
      return;
    }
    const key = uniqueKey(keysTakenAt(schema, target.parentPath, isPrefLeaf(d.node)), d.item.key);
    landing.onChange(addNode(schema, target.parentPath, key, d.node, target.index));
    const path = joinPath(target.parentPath, key);
    landing.onExpandedChange((e) => new Set([...e, ...ancestorsOf(path), path]));
    landing.onSelect([path]);
  };
  return { drag, carrying, treeDrop, onDrag, onDrop };
}

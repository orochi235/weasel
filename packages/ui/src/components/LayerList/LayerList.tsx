import { type KeyboardEvent, useState } from 'react';
import { dlog } from '../../dlog';
import type { TreeDropTarget } from '../../dropTarget';
import { Tree } from '../Tree';
import s from './LayerList.module.css';
import type { LayerListItem, LayerListProps, LayerMove } from './layerListProps';
import { layerNodes } from './layerNodes';
import { branchIds, collectCollapsed, crossesWall, findLayer, moveOf } from './layerTree';
import { canRename } from './RowParts';
export type { LayerListItem, LayerListProps, LayerMove };
export { moveLayers } from './layerTree';

/**
 * An ordered, drag-reorderable tree of layers — a document's objects, a lab's
 * canvases. A `Tree` whose rows carry a layer's toggles: selection,
 * visibility, locking, renaming, removal and an add palette are each on when
 * their handler is given, and with any toggle the tree is a treegrid, its
 * toggles reached from a row with Right (see `Tree`).
 */
export function LayerList(props: LayerListProps) {
  const { items, collapsedIds, onCollapsedChange, title, addKinds, onAdd, empty, className } = props;
  // Only the user's own toggles are state; everything else reads the layer's
  // `defaultCollapsed`, so a layer added later starts the way it asks to.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [renaming, setRenaming] = useState<string | null>(null);
  const collapsed = collapsedIds
    ? new Set(collapsedIds)
    : collectCollapsed(items, (item) => toggled.get(item.id) ?? item.defaultCollapsed === true);
  const branches = branchIds(items);
  const onExpandedChange = (open: Set<string>) => {
    const next = new Set(collapsed);
    const changed = new Map<string, boolean>();
    for (const id of branches) {
      const shut = !open.has(id);
      if (shut === collapsed.has(id)) continue;
      if (shut) next.add(id);
      else next.delete(id);
      changed.set(id, shut);
    }
    if (!collapsedIds) setToggled((prev) => new Map([...prev, ...changed]));
    onCollapsedChange?.([...next]);
  };

  const canDrop = (ids: readonly string[], target: TreeDropTarget) => {
    if (target.parentId !== null && findLayer(items, target.parentId)?.locked) return false;
    if (crossesWall(items, ids, target)) return false;
    return props.canMove?.(moveOf(items, ids, target)) ?? true;
  };
  const onMove = (ids: string[], target: TreeDropTarget) => {
    const move = moveOf(items, ids, target);
    dlog('layer-list', 'onReorder', move);
    props.onReorder?.(move);
  };
  const onRowKeyDown = (id: string, e: KeyboardEvent<HTMLElement>) => {
    const item = findLayer(items, id);
    if (e.key !== 'F2' || !item || !canRename(props, item)) return;
    e.preventDefault();
    setRenaming(id);
  };

  const palette = onAdd ? (addKinds ?? []) : [];
  const { onSelectionChange, onRowContextMenu } = props;
  return (
    <div className={className ? `${s.root} ${className}` : s.root}>
      {(title !== undefined || palette.length > 0) && (
        <div className={s.head}>
          {title !== undefined && <h2 className={s.title}>{title}</h2>}
          <div className={s.palette}>
            {palette.map((kind) => (
              <button
                key={kind}
                type="button"
                className={s.add}
                aria-label={`Add ${kind}`}
                onClick={() => {
                  dlog('layer-list', 'onAdd', { kind });
                  onAdd?.(kind);
                }}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      )}
      <Tree
        nodes={layerNodes(items, props, { id: renaming, set: setRenaming })}
        aria-label={props.label ?? title ?? 'Layers'}
        empty={empty ?? (palette.length > 0 ? 'No layers — add one above.' : 'No layers.')}
        expandedIds={branches.filter((id) => !collapsed.has(id))}
        onExpandedChange={onExpandedChange}
        pressFolds={false}
        selectionMode={onSelectionChange ? 'multiple' : 'none'}
        selectedIds={props.selectedIds ?? []}
        onSelectionChange={(ids) => onSelectionChange?.([...ids])}
        onRowKeyDown={onRowKeyDown}
        onRowContextMenu={onRowContextMenu}
        {...(props.onReorder ? { onMove, canDrop } : {})}
      />
    </div>
  );
}

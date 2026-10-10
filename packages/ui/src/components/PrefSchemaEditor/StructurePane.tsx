import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { isPrefLeaf, isPrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { Input } from '../Input';
import { filterTree, Tree, treeBranchIds, type TreeNode } from '../Tree';
import { Badge } from '../Badge';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import { ResizeHandle } from '../ResizeHandle';
import { looseEntryName } from '../Prefs/schema';
import { GENERAL, generalAllows, generalKeys, schemaTarget } from './generalBranch';
import { Icon } from '../../icons';
import { GROUP_ICON, Palette, type PaletteDrag } from './Palette';
import { treeTakesNew } from './previewDrop';
import { StoredList } from './StoredList';
import { blankGroup, blankLeaf, blankSection } from './kindSchemas';
import {
  addNode, branchUnder, childrenOf, fitsUnder, holdsFixed, isFixed, joinPath, keyOf, keysOf, kindOfValue, nodeAt, parentPath, pathOf,
  undescribedValues, uniqueKey, type SchemaNode, type SchemaRoot, type SchemaTarget, type UndescribedValue,
} from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** How many leaves `nodes` come to, counting those under each at any depth. */
function leafCount(nodes: readonly SchemaNode[]): number {
  return nodes.reduce((n, node) => n + (isPrefLeaf(node) ? 1 : leafCount(Object.values(childrenOf(node) ?? {}))), 0);
}

const countBadge = (n: number) => <Badge size="xs" status="muted" variant="subtle" className={s.treeCount}>{n}</Badge>;

function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    const { name } = child;
    return {
      id: p,
      label: name ? <>{name} <span className={s.treeKey}>({key})</span></> : key,
      textValue: name ? `${name} ${key}` : key,
      // Unset, a group is drawn by its depth: a page under the root, a section below that.
      ...(isPrefLeaf(child) ? {} : { leading: <Icon size={16} name={GROUP_ICON[child.as ?? (path === null && !isPrefSection(child) ? 'page' : 'section')]} /> }),
      trailing: isPrefLeaf(child)
        ? <PrefKindBadge kind={child.kind} />
        : <>{countBadge(leafCount([child]))}<PrefKindBadge kind={child.as ?? (isPrefSection(child) ? 'section' : 'group')} /></>,
      className: changed.has(p) ? s.changed : undefined,
      ...(kids ? { children: toTreeNodes(child, p, changed) } : {}),
    };
  });
}

export interface StructurePaneProps {
  schema: SchemaRoot;
  onChange(next: SchemaRoot): void;
  selected: string | null;
  onSelect(path: string | null): void;
  changed: ReadonlySet<string>;
  kinds: readonly string[];
  expanded: ReadonlySet<string>;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  /** Where in the editor's bar the pane draws the tools that add and remove nodes; `null` until the bar is up. */
  toolSlot: HTMLElement | null;
  /** The values the app stores under the schema; those no leaf describes are listed under the tree. */
  stored?: unknown;
  /** Somewhere else a drag from this pane may end: the live preview. */
  outside?: DropOutside;
  /** `outside` is drawing what is dragged where it would land, so the palette draws no ghost of it. */
  outsideDraws?: boolean;
  /** Remove the selected node. */
  onRemove(): void;
  /** Move the nodes at `paths` to `target`, keeping them open and selected. */
  onMove(paths: readonly string[], target: SchemaTarget): void;
}

/** A place outside the structure pane that takes drops of schema nodes. */
export interface DropOutside {
  /** Whether it would take `nodes` (already at `paths`, or new with none) at this client point; it marks where. */
  over(nodes: readonly SchemaNode[], paths: readonly string[], point: { x: number; y: number }): boolean;
  /** Where a drop at the point lands in the schema, if it takes one. */
  target(nodes: readonly SchemaNode[], paths: readonly string[], point: { x: number; y: number }): SchemaTarget | null;
  /** The drag left or ended. */
  end(): void;
}

/** Every path above `path`, nearest last. */
const ancestorsOf = (path: string): string[] =>
  keysOf(path).slice(0, -1).map((_, i, keys) => pathOf(keys.slice(0, i + 1))!);

/** `'gridVisible'` as `'Grid visible'`. */
const nameOfKey = (key: string): string => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds, expanded, onExpandedChange, toolSlot, stored, outside, outsideDraws = false, onMove: move, onRemove }: StructurePaneProps) {
  const nodes = useMemo(() => {
    const all = toTreeNodes(schema, null, changed);
    const loose = new Set(generalKeys(schema));
    if (loose.size === 0) return all;
    // A preferences form files the root's own leaves under one rail entry; the tree shows them the same way.
    const general: TreeNode = {
      id: GENERAL,
      label: looseEntryName(schema.name),
      textValue: looseEntryName(schema.name),
      trailing: countBadge(leafCount([...loose].map((key) => nodeAt(schema, key)!))),
      children: all.filter((n) => loose.has(n.id)),
    };
    return [general, ...all.filter((n) => !loose.has(n.id))];
  }, [schema, changed]);
  const [query, setQuery] = useState('');
  const sought = query.trim().toLowerCase();
  const shown = useMemo(
    () => (sought === '' ? nodes : filterTree(nodes, (n) => (n.textValue ?? '').toLowerCase().includes(sought))),
    [nodes, sought],
  );
  const hasGeneral = nodes[0]?.id === GENERAL;
  const [generalOpen, setGeneralOpen] = useState(true);
  const [adding, setAdding] = useState<'pref' | 'branch' | null>(null);
  const [fromStored, setFromStored] = useState<UndescribedValue | null>(null);
  const [storedHeight, setStoredHeight] = useState(180);
  const treeArea = useRef<HTMLDivElement | null>(null);
  // A selection made in the preview may sit outside the tree's scrolled view. Optional-called for jsdom.
  useEffect(() => {
    treeArea.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  const undescribed = useMemo(() => (stored === undefined ? [] : undescribedValues(schema, stored)), [schema, stored]);
  // Where a stored value's leaf goes: under a group root its value path names a group per step; under a section
  // root the whole path is the leaf's key.
  const storedKeys = fromStored ? (isPrefSection(schema) ? [fromStored.path] : fromStored.path.split('.')) : [];
  const storedParent = pathOf(storedKeys.slice(0, -1));

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    const node = selected === null ? undefined : nodeAt(schema, selected);
    if (selected === null || !node) return { parent: null };
    if (childrenOf(node) && !holdsFixed(node)) return { parent: selected };
    // A list's item has no siblings to join: the add lands after the list.
    let at = selected;
    while (isFixed(schema, at)) at = parentPath(at)!;
    const parent = parentPath(at);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(at)) + 1 };
  };
  /** What a new node joins: the stored value's parent when it has one yet, else where an add lands. */
  const host = fromStored ? nodeAt(schema, storedParent) : nodeAt(schema, addTarget().parent) ?? schema;
  const branch = branchUnder(host ?? schema);
  // A union's children are its variants, each an object leaf.
  const variants = !!host && isPrefLeaf(host) && host.kind === 'union';
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...blankLeaf(kind), name } : { ...(branch === 'section' ? blankSection() : blankGroup()), name };
    setAdding(null);
    if (fromStored) {
      // A stored value's leaf goes where the value lives, making any group its path passes through.
      setFromStored(null);
      let root = schema;
      let at: string | null = null;
      for (const segment of storedKeys.slice(0, -1)) {
        const next = joinPath(at, segment);
        if (!nodeAt(root, next)) root = addNode(root, at, segment, { ...blankGroup(), name: nameOfKey(segment) });
        at = next;
      }
      onChange(addNode(root, at, key, { ...node, default: fromStored.value } as SchemaNode));
      onExpandedChange((e) => new Set([...e, ...ancestorsOf(joinPath(at, key))]));
      onSelect(joinPath(at, key));
      return;
    }
    const { parent, index } = addTarget();
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  const nodesAt = (ids: readonly string[]): SchemaNode[] => ids.map((id) => nodeAt(schema, id)!);

  // A drag from the palette: over the tree it lands where the tree marks, and elsewhere wherever `outside` takes it.
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const treeTarget = useRef<{ parentId: string | null; index: number } | null>(null);
  const onPaletteDrag = (drag: PaletteDrag | null) => {
    setPaletteDrag(drag);
    if (drag) outside?.over([drag.node], [], drag);
    else outside?.end();
  };
  const onPaletteDrop = (drag: PaletteDrag) => {
    const at = treeTarget.current;
    const target = at ? schemaTarget(schema, at.parentId, at.index) : outside?.target([drag.node], [], drag) ?? null;
    if (!target) return;
    const kids = childrenOf(nodeAt(schema, target.parentPath)!) ?? {};
    const key = uniqueKey(kids, drag.item.key);
    onChange(addNode(schema, target.parentPath, key, drag.node, target.index));
    const path = joinPath(target.parentPath, key);
    onExpandedChange((e) => new Set([...e, ...ancestorsOf(path), path]));
    onSelect(path);
  };

  return (
    <section className={`${s.pane} ${s.structurePane}`} aria-label="Structure">
      <PaneHeader title="Structure" />
      <div className={s.treeFilter}>
        <Input value={query} onChange={setQuery} aria-label="Filter structure" placeholder="Filter" />
      </div>
      {toolSlot && createPortal(
        <>
          <Palette sections={isPrefSection(schema)} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
          <Button size="sm" onClick={() => setAdding('pref')}>Add pref</Button>
          <Button size="sm" disabled={variants} onClick={() => setAdding('branch')}>Add {branch}</Button>
          <Button size="sm" disabled={selected === null || isFixed(schema, selected)} onClick={onRemove}>Remove</Button>
        </>,
        toolSlot,
      )}
      <AddNodeDialog what={adding === 'branch' ? branch : adding} kinds={variants && !fromStored ? ['object'] : kinds} onAdd={add}
        siblings={(host && childrenOf(host)) ?? {}} dottedKey={adding === 'pref' && branch === 'section'}
        initial={fromStored ? {
          key: storedKeys.at(-1)!,
          name: nameOfKey(storedKeys.at(-1)!),
          ...(kindOfValue(fromStored.value) ? { kind: kindOfValue(fromStored.value)! } : {}),
        } : undefined}
        onClose={() => { setAdding(null); setFromStored(null); }} />
      <div className={s.treeArea} ref={treeArea}>
      <Tree
        aria-label="Schema structure"
        nodes={shown}
        empty={sought === '' ? undefined : 'Nothing matches.'}
        // Filtered, every match shows, and what is folded stays as it was for when the filter goes.
        expandedIds={sought !== '' ? treeBranchIds(shown) : generalOpen ? new Set([...expanded, GENERAL]) : expanded}
        onExpandedChange={(next) => {
          if (sought !== '') return;
          setGeneralOpen(next.has(GENERAL));
          onExpandedChange(new Set([...next].filter((id) => id !== GENERAL)));
        }}
        selectionMode="single"
        // General is the root's row: with nothing selected the attributes pane shows the root's.
        selectedIds={selected === null ? (hasGeneral ? [GENERAL] : []) : [selected]}
        onSelectionChange={(ids) => {
          const id = [...ids][0] ?? null;
          onSelect(id === GENERAL ? null : id);
        }}
        externalDrag={paletteDrag}
        onExternalTarget={(t) => { treeTarget.current = t; }}
        onDragOutside={outside && ((ids, point) => {
          if (point) return outside.over(nodesAt(ids), ids, point);
          outside.end();
          return false;
        })}
        onDropOutside={outside && ((ids, point) => {
          const target = outside.target(nodesAt(ids), ids, point);
          if (target) move(ids, target);
        })}
        canDrop={(ids, t) => {
          // A place among the rows shown is not that place among all of them.
          if (sought !== '') return false;
          if (ids.length === 0) return paletteDrag !== null && treeTakesNew(schema, paletteDrag.node, t.parentId);
          if ([...ids].some((id) => isFixed(schema, id))) return false;
          const general = generalAllows(schema, [...ids], t.parentId);
          if (general !== undefined) return general;
          const parent = nodeAt(schema, t.parentId)!;
          return !!childrenOf(parent) && [...ids].every((id) => fitsUnder(parent, nodeAt(schema, id)!));
        }}
        onMove={(ids, t) => move(ids, schemaTarget(schema, t.parentId, t.index))}
      />
      </div>
      {stored !== undefined && (
        <>
          <ResizeHandle orientation="horizontal" invert value={storedHeight} min={60} max={600}
            onInput={setStoredHeight} ariaLabel="Resize stored values" />
          <div className={s.storedArea} style={{ '--stored-h': `${storedHeight}px` } as CSSProperties}>
            <PaneHeader title="Unplaced" />
            <StoredList entries={undescribed} onPick={(entry) => { setFromStored(entry); setAdding('pref'); }} />
          </div>
        </>
      )}
    </section>
  );
}

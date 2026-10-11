import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { isPrefLeaf, isPrefSection, prefHoldsValue, type PrefGroup } from '@weasel-js/prefs';
import { Input } from '../Input';
import { filterTree, Tree, treeBranchIds, type TreeDragEffect, type TreeNode } from '../Tree';
import { Badge } from '../Badge';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { ToolButton } from '../ToolButton';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import { ResizeHandle } from '../ResizeHandle';
import { isLoose, looseKeys, looseTarget, schemaTarget, topLevelAllows } from './loose';
import { Icon } from '../../icons';
import { GROUP_ICON, Palette, type PaletteDrag } from './Palette';
import { treeTakesNew } from './previewDrop';
import { UnplacedTree } from './UnplacedTree';
import { stillUnplaced } from './unplaced';
import { blankGroup, blankSection, leafOf } from './kindSchemas';
import { kindChoices, type PrefTypes } from './types';
import {
  addNode, aliasOf, branchUnder, childrenOf, fitsUnder, joinPath, keyOf, keysOf, nodeAt, parentPath, pathOf,
  uniqueKey, withinDepth, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** How many leaves `nodes` come to, counting those under each at any depth. */
function leafCount(nodes: readonly SchemaNode[]): number {
  return nodes.reduce((n, node) => n + (isPrefLeaf(node) ? 1 : leafCount(Object.values(childrenOf(node) ?? {}))), 0);
}

const countBadge = (n: number) => <Badge size="xs" status="muted" variant="subtle" className={s.treeCount}>{n}</Badge>;

function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>, mark?: (path: string) => ReactNode): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    const { name } = child;
    const label = name ? <>{name} <span className={s.treeKey}>({key})</span></> : key;
    return {
      id: p,
      label: changed.has(p) ? <span className={s.changed}>{label}</span> : label,
      textValue: name ? `${name} ${key}` : key,
      ...(child.description ? { tooltip: child.description } : {}),
      // Unset, a group is drawn by its depth: a page under the root, a section below that.
      ...(isPrefLeaf(child) ? {} : { leading: <Icon size={16} name={GROUP_ICON[child.as ?? (path === null && !isPrefSection(child) ? 'page' : 'section')]} /> }),
      trailing: isPrefLeaf(child)
        ? <>{mark?.(p)}<PrefKindBadge kind={child.type ?? child.kind} /></>
        // Its glyph says how a group is drawn, so it carries no badge to say it again.
        : <>{mark?.(p)}{countBadge(leafCount([child]))}</>,
      ...(kids ? { children: toTreeNodes(child, p, changed, mark) } : {}),
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
  /** The types a new pref may be made from, offered beside the kinds. */
  types: PrefTypes;
  expanded: ReadonlySet<string>;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  /** Where in the editor's bar the pane draws the tools that add and remove nodes; `null` until the bar is up. */
  toolSlot: HTMLElement | null;
  /** Nodes the schema does not hold yet, listed under the tree with what it holds on no page, to be dragged into it. */
  unplaced?: PrefGroup;
  /** Somewhere else a drag from this pane may end: the live preview. */
  outside?: DropOutside;
  /** `outside` is drawing what is dragged where it would land, so the palette draws no ghost of it. */
  outsideDraws?: boolean;
  /** The most levels of groups the schema may nest. */
  maxDepth?: number;
  /** What a host draws on a node's row before its kind, by the node's path in this tree. */
  rowMark?: (path: string) => ReactNode;
  /** Remove the selected node. */
  onRemove(): void;
  /** Move the nodes at `paths` to `target`, keeping them open and selected. */
  onMove(paths: readonly string[], target: SchemaTarget): void;
  /** Set copies of the nodes at `paths` at `target`, leaving the nodes where they are. */
  onCopy(paths: readonly string[], target: SchemaTarget): void;
  /** Set an alias of each leaf at `paths` at `target`. */
  onAlias(paths: readonly string[], target: SchemaTarget): void;
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

export function StructurePane({ schema, onChange, selected, onSelect, changed, kinds, types, expanded, onExpandedChange, toolSlot, unplaced, outside, outsideDraws = false, onMove: move, onCopy: copy, onAlias: alias, onRemove, maxDepth, rowMark }: StructurePaneProps) {
  // What a group root holds on no page waits with the unplaced, and the tree lists the pages.
  const [nodes, looseNodes] = useMemo(() => {
    const all = toTreeNodes(schema, null, changed, rowMark);
    const loose = new Set(looseKeys(schema));
    return [all.filter((n) => !loose.has(n.id)), all.filter((n) => loose.has(n.id))];
  }, [schema, changed, rowMark]);
  const [query, setQuery] = useState('');
  const sought = query.trim().toLowerCase();
  const shown = useMemo(
    () => (sought === '' ? nodes : filterTree(nodes, (n) => (n.textValue ?? '').toLowerCase().includes(sought))),
    [nodes, sought],
  );
  const [adding, setAdding] = useState<'pref' | 'branch' | null>(null);
  const [storedHeight, setStoredHeight] = useState(180);
  const treeArea = useRef<HTMLDivElement | null>(null);
  const unplacedArea = useRef<HTMLDivElement | null>(null);
  const [unplacing, setUnplacing] = useState(false);
  // A selection made in the preview may sit outside the tree's scrolled view. Optional-called for jsdom.
  useEffect(() => {
    treeArea.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selected]);
  /** Whether a drag of the nodes at `ids`, held at `point`, is over the unplaced list and may be let go there. */
  const overUnplaced = (ids: readonly string[], point: { x: number; y: number }): boolean => {
    const box = unplacedArea.current?.getBoundingClientRect();
    if (!box || point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return false;
    return ids.every((id) => isLoose(nodeAt(schema, id)!));
  };
  const waiting = useMemo(() => (unplaced ? stillUnplaced(unplaced, schema) : null), [unplaced, schema]);

  /** Where an add lands: inside the selection if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    const node = selected === null ? undefined : nodeAt(schema, selected);
    if (selected === null || !node) return { parent: null };
    if (childrenOf(node)) return { parent: selected };
    const parent = parentPath(selected);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  };
  /** What a new node joins. */
  const host = nodeAt(schema, addTarget().parent) ?? schema;
  const branch = branchUnder(host ?? schema);
  const choices = useMemo(() => kindChoices(kinds, types), [kinds, types]);
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...leafOf(kind, types), name } : { ...(branch === 'section' ? blankSection() : blankGroup()), name };
    setAdding(null);
    const { parent, index } = addTarget();
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect(joinPath(parent, key));
  };

  const nodesAt = (ids: readonly string[]): SchemaNode[] => ids.map((id) => nodeAt(schema, id)!);
  // Only a leaf that holds a value has one to show a second time.
  const canLand = (ids: readonly string[], effect: TreeDragEffect): boolean =>
    effect !== 'link' || nodesAt(ids).every((node) => isPrefLeaf(node) && (prefHoldsValue(node) || node.kind === 'alias'));
  /** What a drag would set down: the nodes themselves, or aliases of them. */
  const landing = (ids: readonly string[], effect: TreeDragEffect): SchemaNode[] =>
    effect === 'link' ? ids.map((id) => aliasOf(schema, id)) : nodesAt(ids);
  /** Where the bar's alias of the selected pref goes: after the pref, to be dragged where it belongs. Null when there is none to make. */
  const aliasAt = ((): SchemaTarget | null => {
    if (selected === null || !nodeAt(schema, selected) || !canLand([selected], 'link')) return null;
    const parent = parentPath(selected);
    if (!treeTakesNew(schema, aliasOf(schema, selected), parent, maxDepth) && !(parent === null && !isPrefSection(schema))) return null;
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent) ?? schema) ?? {});
    return { parentPath: parent, index: sibs.indexOf(keyOf(selected)) + 1 };
  })();

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
    if (drag.from !== undefined) {
      move([drag.from], target);
      return;
    }
    const kids = childrenOf(nodeAt(schema, target.parentPath)!) ?? {};
    const key = uniqueKey(kids, drag.item.key);
    onChange(addNode(schema, target.parentPath, key, drag.node, target.index));
    const path = joinPath(target.parentPath, key);
    onExpandedChange((e) => new Set([...e, ...ancestorsOf(path), path]));
    onSelect(path);
  };

  /** Whether the nodes at `ids`, which the schema holds, may be dropped under tree row `parentId`. */
  const takes = (ids: readonly string[], parentId: string | null): boolean => {
    if (!withinDepth(parentId, nodesAt(ids), maxDepth)) return false;
    const top = topLevelAllows(schema, ids, parentId);
    if (top !== undefined) return top;
    const parent = nodeAt(schema, parentId)!;
    return !!childrenOf(parent) && ids.every((id) => fitsUnder(parent, nodeAt(schema, id)!));
  };

  return (
    <section className={`${s.pane} ${s.structurePane}`} aria-label="Structure">
      <PaneHeader title="Structure" />
      <div className={s.treeFilter}>
        <Input value={query} onChange={setQuery} aria-label="Filter structure" placeholder="Filter" />
      </div>
      {toolSlot && createPortal(
        <Palette sections={isPrefSection(schema)} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop}>
          <ToolButton icon={<Icon name="tune" mark="markAdd" />} label="Add pref" onClick={() => setAdding('pref')} />
          <ToolButton icon={<Icon name={GROUP_ICON.section} mark="markAdd" />} label={`Add ${branch}`} disabled={branch === 'group' && !withinDepth(addTarget().parent, [blankGroup()], maxDepth)} onClick={() => setAdding('branch')} />
          <ToolButton icon={<Icon name="link" mark="markAdd" />} label="Add alias" title="Show the selected pref in a second place"
            disabled={aliasAt === null} onClick={() => { if (aliasAt) alias([selected!], aliasAt); }} />
          <ToolButton icon={<Icon name="delete" />} label="Remove" disabled={selected === null} onClick={onRemove} />
        </Palette>,
        toolSlot,
      )}
      <AddNodeDialog what={adding === 'branch' ? branch : adding} kinds={choices} onAdd={add}
        siblings={(host && childrenOf(host)) ?? {}} dottedKey={adding === 'pref' && branch === 'section'}
        onClose={() => setAdding(null)} />
      <div className={s.treeArea} ref={treeArea}>
      <Tree
        aria-label="Schema structure"
        foldBy="leading"
        guides
        nodes={shown}
        empty={sought === '' ? undefined : 'Nothing matches.'}
        // Filtered, every match shows, and what is folded stays as it was for when the filter goes.
        expandedIds={sought !== '' ? treeBranchIds(shown) : expanded}
        onExpandedChange={(next) => {
          if (sought === '') onExpandedChange(next);
        }}
        selectionMode="single"
        selectedIds={selected === null ? [] : [selected]}
        onSelectionChange={(ids) => onSelect([...ids][0] ?? null)}
        externalDrag={paletteDrag}
        onExternalTarget={(t) => { treeTarget.current = t; }}
        // A copy or an alias is new where it lands, so the place it is dropped is asked about it with no paths, as for a palette's node.
        onDragOutside={(ids, point, effect) => {
          // Let go over the unplaced list, a node comes off its page.
          const off = point !== null && canLand(ids, effect) && overUnplaced(ids, point);
          setUnplacing(off);
          if (off || !outside) return off;
          if (point) return canLand(ids, effect) && outside.over(landing(ids, effect), effect === 'move' ? ids : [], point);
          outside.end();
          return false;
        }}
        onDropOutside={(ids, point, effect) => {
          setUnplacing(false);
          if (!canLand(ids, effect)) return;
          const target = overUnplaced(ids, point) ? looseTarget(schema) : outside?.target(landing(ids, effect), effect === 'move' ? ids : [], point);
          if (target) ({ move, copy, link: alias })[effect](ids, target);
        }}
        canDrop={(ids, t, effect) => {
          // A place among the rows shown is not that place among all of them.
          if (sought !== '') return false;
          if (ids.length === 0) {
            if (paletteDrag === null) return false;
            return paletteDrag.from === undefined ? treeTakesNew(schema, paletteDrag.node, t.parentId, maxDepth) : takes([paletteDrag.from], t.parentId);
          }
          if (effect === 'link') return canLand(ids, effect) && landing(ids, effect).every((node) => treeTakesNew(schema, node, t.parentId, maxDepth));
          return takes(ids, t.parentId);
        }}
        onMove={(ids, t) => move(ids, schemaTarget(schema, t.parentId, t.index))}
        onCopy={(ids, t) => copy(ids, schemaTarget(schema, t.parentId, t.index))}
        onLink={(ids, t) => alias(ids, schemaTarget(schema, t.parentId, t.index))}
      />
      </div>
      {(unplaced !== undefined || !isPrefSection(schema)) && (
        <>
          <ResizeHandle orientation="horizontal" invert value={storedHeight} min={60} max={600}
            onInput={setStoredHeight} ariaLabel="Resize unplaced" />
          <div className={s.storedArea} ref={unplacedArea} data-drop={unplacing || undefined} style={{ '--stored-h': `${storedHeight}px` } as CSSProperties}>
            <PaneHeader title="Unplaced" />
            <UnplacedTree loose={looseNodes} looseAt={(path) => nodeAt(schema, path)} waiting={waiting} sought={sought}
              selected={selected} onSelect={onSelect} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
          </div>
        </>
      )}
    </section>
  );
}

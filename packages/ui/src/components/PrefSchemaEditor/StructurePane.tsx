import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { isPrefLeaf, isPrefSection, type PrefGroup } from '@weasel-js/prefs';
import { Input } from '../Input';
import { filterTree, Tree, treeBranchIds, type TreeDragEffect, type TreeNode } from '../Tree';
import { Badge } from '../Badge';
import type { PrefRenderer } from '../Prefs';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { Button } from '../Button';
import { ToolButton } from '../ToolButton';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import { ResizeHandle } from '../ResizeHandle';
import { ActionList } from './ActionList';
import { useEditorSize } from './editorPrefs';
import type { EditorAction } from './editorActions';
import { holdsPages, looseKeys, looseTarget, mayUnplace, schemaTarget, topLevelAllows } from './loose';
import { Icon } from '../../icons';
import { DraggedNodes, GHOST_WIDTH, ghostIsPage } from './NodeGhost';
import { GROUP_ICON, Palette, type PaletteDrag } from './Palette';
import { treeTakesNew } from './previewDrop';
import { UnplacedTree } from './UnplacedTree';
import { stillUnplaced } from './unplaced';
import { blankGroup, blankSection, leafOf, type CustomKinds } from './kindSchemas';
import { kindChoices, type PrefTypes } from './types';
import {
  addNode, aliasOf, branchUnder, canAlias, childrenOf, fitsUnder, joinPath, keyOf, keysOf, nodeAt, parentPath, pathOf,
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
  /** The selected paths; empty is the root. */
  selected: readonly string[];
  /** The path that stands for the selection: where an add lands and which row is brought into view. */
  lead: string | null;
  /** The tree's rows now selected. */
  onPick(ids: Iterable<string>): void;
  /** Select exactly these: after an add, or a pick among the unplaced. */
  onSelect(paths: readonly string[]): void;
  changed: ReadonlySet<string>;
  kinds: readonly string[];
  /** The custom kinds' attributes, which say what a new leaf of one starts with. */
  custom?: CustomKinds;
  /** Renderers for custom kinds, which a dragged node's ghost is drawn with. */
  renderers?: Record<string, PrefRenderer>;
  /** The types a new pref may be made from, offered beside the kinds. */
  types: PrefTypes;
  expanded: ReadonlySet<string>;
  onExpandedChange: Dispatch<SetStateAction<Set<string>>>;
  /** Where in the editor's bar the pane draws the tools that add and remove nodes; `null` until the bar is up. */
  toolSlot: HTMLElement | null;
  /** Nodes the schema does not hold yet, listed under the tree with what it holds on no page, to be dragged into it. */
  unplaced?: PrefGroup;
  /** The actions the host has, listed under the tree to be dragged into it as prefs that fire them. */
  actions?: readonly EditorAction[];
  /** Somewhere else a drag from this pane may end: the live preview. */
  outside?: DropOutside;
  /** `outside` is drawing what is dragged where it would land, so the palette and the trees draw no ghost of it. */
  outsideDraws?: boolean;
  /** The most levels of groups the schema may nest. */
  maxDepth?: number;
  /** What a host draws on a node's row before its kind, by the node's path in this tree. */
  rowMark?: (path: string) => ReactNode;
  /** Remove the selected nodes. */
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

export function StructurePane({ schema, onChange, selected, lead, onPick, onSelect, changed, kinds, custom, renderers, types, expanded, onExpandedChange, toolSlot, unplaced, actions, outside, outsideDraws = false, onMove: move, onCopy: copy, onAlias: alias, onRemove, maxDepth, rowMark }: StructurePaneProps) {
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
  const unplacedSize = useEditorSize('unplacedHeight');
  const actionsSize = useEditorSize('actionsHeight');
  const treeArea = useRef<HTMLDivElement | null>(null);
  const unplacedArea = useRef<HTMLDivElement | null>(null);
  const [unplacing, setUnplacing] = useState(false);
  // A selection made in the preview may sit outside the tree's scrolled view. Optional-called for jsdom.
  useEffect(() => {
    if (lead === null) return;
    const rows = treeArea.current?.querySelectorAll('[data-tree-id]') ?? [];
    [...rows].find((r) => r.getAttribute('data-tree-id') === lead)?.scrollIntoView?.({ block: 'nearest' });
  }, [lead]);
  /** Whether a drag of the nodes at `ids`, held at `point`, is over the unplaced list and may be let go there. */
  const overUnplaced = (ids: readonly string[], point: { x: number; y: number }): boolean => {
    const box = unplacedArea.current?.getBoundingClientRect();
    if (!box || point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom) return false;
    return mayUnplace(schema, ids);
  };
  const waiting = useMemo(() => (unplaced ? stillUnplaced(unplaced, schema) : null), [unplaced, schema]);

  /** Where an add lands: inside the lead if it holds children, else after it. */
  const addTarget = (): { parent: string | null; index?: number } => {
    const node = lead === null ? undefined : nodeAt(schema, lead);
    if (lead === null || !node) return { parent: null };
    if (childrenOf(node)) return { parent: lead };
    const parent = parentPath(lead);
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
    return { parent, index: sibs.indexOf(keyOf(lead)) + 1 };
  };
  /** What a new node joins. */
  const host = nodeAt(schema, addTarget().parent) ?? schema;
  const branch = branchUnder(host ?? schema);
  const choices = useMemo(() => kindChoices(kinds, types), [kinds, types]);
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...leafOf(kind, types, custom), name } : { ...(branch === 'section' ? blankSection() : blankGroup()), name };
    setAdding(null);
    const { parent, index } = addTarget();
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect([joinPath(parent, key)]);
  };

  const nodesAt = (ids: readonly string[]): SchemaNode[] => ids.map((id) => nodeAt(schema, id)!);
  const canLand = (ids: readonly string[], effect: TreeDragEffect): boolean =>
    effect !== 'link' || ids.every((id) => canAlias(schema, id));
  /** What a drag would set down: the nodes themselves, or aliases of them. */
  const landing = (ids: readonly string[], effect: TreeDragEffect): SchemaNode[] =>
    effect === 'link' ? ids.map((id) => aliasOf(schema, id)) : nodesAt(ids);
  /** Where the bar's aliases of the selected prefs go: together after the one that leads, to be dragged where they
   *  belong. Null when one of what is selected has no alias to make, or they do not fit there. */
  const aliasAt = ((): SchemaTarget | null => {
    if (lead === null || !selected.every((p) => nodeAt(schema, p)) || !canLand(selected, 'link')) return null;
    const parent = parentPath(lead);
    const fits = landing(selected, 'link').every((made) => treeTakesNew(schema, made, parent, maxDepth));
    if (!fits && !(parent === null && !isPrefSection(schema))) return null;
    const sibs = Object.keys(childrenOf(nodeAt(schema, parent) ?? schema) ?? {});
    return { parentPath: parent, index: sibs.indexOf(keyOf(lead)) + 1 };
  })();

  // A drag from the palette: over the tree it lands where the tree marks, and elsewhere wherever `outside` takes it.
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  const treeTarget = useRef<{ parentId: string | null; index: number } | null>(null);
  /** The nodes a palette drag would set down: the ones the schema holds at its paths, else the one it makes. */
  const carried = (drag: PaletteDrag): SchemaNode[] => (drag.from ? nodesAt(drag.from) : [drag.node]);
  const onPaletteDrag = (drag: PaletteDrag | null) => {
    setPaletteDrag(drag);
    if (drag) outside?.over(carried(drag), [], drag);
    else outside?.end();
  };
  const onPaletteDrop = (drag: PaletteDrag) => {
    // The tree answers a drag from an effect, a render after the pointer moved; a drop is asked about where it was let go.
    flushSync(() => setPaletteDrag(drag));
    const at = treeTarget.current;
    const target = at ? schemaTarget(schema, at.parentId, at.index) : outside?.target(carried(drag), [], drag) ?? null;
    if (!target) return;
    if (drag.from !== undefined) {
      move(drag.from, target);
      return;
    }
    const kids = childrenOf(nodeAt(schema, target.parentPath)!) ?? {};
    const key = uniqueKey(kids, drag.item.key);
    onChange(addNode(schema, target.parentPath, key, drag.node, target.index));
    const path = joinPath(target.parentPath, key);
    onExpandedChange((e) => new Set([...e, ...ancestorsOf(path), path]));
    onSelect([path]);
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
      <PaneHeader title="Structure">
        {/* A filter opens every branch it shows, so there is nothing to fold while one is set. */}
        <Button iconOnly variant="ghost" size="sm" ariaLabel="Expand all" tooltip="Expand all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set(treeBranchIds(nodes)))}><Icon name="expand" size={16} /></Button>
        <Button iconOnly variant="ghost" size="sm" ariaLabel="Collapse all" tooltip="Collapse all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set())}><Icon name="collapse" size={16} /></Button>
      </PaneHeader>
      <div className={s.treeFilter}>
        <Input value={query} onChange={setQuery} aria-label="Filter structure" placeholder="Filter" />
      </div>
      {toolSlot && createPortal(
        <Palette sections={isPrefSection(schema)} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop}>
          <ToolButton icon={<Icon name="tune" mark="markAdd" />} label="Add pref" onClick={() => setAdding('pref')} />
          <ToolButton icon={<Icon name={GROUP_ICON.section} mark="markAdd" />} label={`Add ${branch}`} disabled={branch === 'group' && !withinDepth(addTarget().parent, [blankGroup()], maxDepth)} onClick={() => setAdding('branch')} />
          <ToolButton icon={<Icon name="link" mark="markAdd" />} label="Add alias" title="Show each selected pref in a second place"
            disabled={aliasAt === null} onClick={() => { if (aliasAt) alias(selected, aliasAt); }} />
          <ToolButton icon={<Icon name="delete" />} label="Remove" disabled={selected.length === 0} onClick={onRemove} />
        </Palette>,
        toolSlot,
      )}
      <AddNodeDialog what={adding === 'branch' ? branch : adding} kinds={choices} onAdd={add}
        siblings={(host && childrenOf(host)) ?? {}} dottedKey={adding === 'pref' && branch === 'section'}
        onClose={() => setAdding(null)} />
      <div className={s.treeArea} ref={treeArea}>
      <Tree
        aria-label="Schema structure"
        ghost={!outsideDraws}
        // Out of the tree a drag is headed for the form, so it shows the node as the form draws it.
        renderGhost={(ids, { outside: left }) => {
          const node = left ? nodeAt(schema, ids[0]!) : undefined;
          if (!node) return null;
          const topLevel = parentPath(ids[0]!) === null;
          return {
            content: <DraggedNodes node={node} topLevel={topLevel} count={ids.length} renderers={renderers} />,
            width: GHOST_WIDTH[ghostIsPage(node, topLevel) ? 'page' : 'node'],
          };
        }}
        foldBy="leading"
        guides
        nodes={shown}
        empty={sought === '' ? undefined : 'Nothing matches.'}
        // Filtered, every match shows, and what is folded stays as it was for when the filter goes.
        expandedIds={sought !== '' ? treeBranchIds(shown) : expanded}
        onExpandedChange={(next) => {
          if (sought === '') onExpandedChange(next);
        }}
        selectionMode="multiple"
        selectedIds={selected}
        onSelectionChange={onPick}
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
          const target = overUnplaced(ids, point) && holdsPages(schema) ? looseTarget(schema) : outside?.target(landing(ids, effect), effect === 'move' ? ids : [], point);
          if (target) ({ move, copy, link: alias })[effect](ids, target);
        }}
        canDrop={(ids, t, effect) => {
          // A place among the rows shown is not that place among all of them.
          if (sought !== '') return false;
          if (ids.length === 0) {
            if (paletteDrag === null) return false;
            return paletteDrag.from === undefined ? treeTakesNew(schema, paletteDrag.node, t.parentId, maxDepth) : takes(paletteDrag.from, t.parentId);
          }
          if (effect === 'link') return canLand(ids, effect) && landing(ids, effect).every((node) => treeTakesNew(schema, node, t.parentId, maxDepth));
          return takes(ids, t.parentId);
        }}
        onMove={(ids, t) => move(ids, schemaTarget(schema, t.parentId, t.index))}
        onCopy={(ids, t) => copy(ids, schemaTarget(schema, t.parentId, t.index))}
        onLink={(ids, t) => alias(ids, schemaTarget(schema, t.parentId, t.index))}
      />
      </div>
      {(unplaced !== undefined || holdsPages(schema)) && (
        <>
          <ResizeHandle orientation="horizontal" invert {...unplacedSize} min={60} max={600}
            ariaLabel="Resize unplaced" />
          <div className={s.storedArea} ref={unplacedArea} data-drop={unplacing || undefined} style={{ '--stored-h': `${unplacedSize.value}px` } as CSSProperties}>
            <PaneHeader title="Unplaced" />
            <UnplacedTree loose={looseNodes} looseAt={(path) => nodeAt(schema, path)} waiting={waiting} sought={sought}
              selected={selected} onPick={onPick} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
          </div>
        </>
      )}
      {actions !== undefined && actions.length > 0 && (
        <>
          <ResizeHandle orientation="horizontal" invert {...actionsSize} min={60} max={600}
            ariaLabel="Resize actions" />
          <div className={s.storedArea} style={{ '--stored-h': `${actionsSize.value}px` } as CSSProperties}>
            <PaneHeader title="Actions" />
            <ActionList actions={actions} sought={sought} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
          </div>
        </>
      )}
    </section>
  );
}

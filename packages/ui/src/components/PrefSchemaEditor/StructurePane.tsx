import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { isPrefLeaf, isPrefSection, type PrefGroup } from '@weasel-js/prefs';
import { Input } from '../Input';
import { Tree, treeBranchIds, type TreeDragEffect, type TreeDropHandle } from '../Tree';
import { seekRows } from './rowSearch';
import type { PrefRenderer } from '../Prefs';
import { Button } from '../Button';
import { ToolButton } from '../ToolButton';
import { AddNodeDialog, type NewNode } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import type { ActionCatalog } from './useActionCatalog';
import { holdsPages, looseKeys, looseTarget, mayUnplace, schemaTarget, topLevelAllows } from './loose';
import { Icon } from '../../icons';
import { DraggedNodes, GHOST_WIDTH, ghostIsPage } from './NodeGhost';
import { GROUP_ICON, Palette, type PaletteDrag, type PaletteItem } from './Palette';
import type { PartsCatalog } from './PartsList';
import { treeTakesNew } from './previewDrop';
import { ShelfLists } from './Shelf';
import { StoredArea } from './StoredArea';
import { UnplacedTree } from './UnplacedTree';
import { toTreeNodes } from './structureRows';
import { stillUnplaced } from './unplaced';
import { blankGroup, blankSection, leafOf, type CustomKinds } from './kindSchemas';
import { kindChoices, type PrefTypes } from './types';
import {
  addNode, branchUnder, childrenOf, fitsUnder, joinPath, keyOf, keysOf, keysTakenAt, nodeAt, parentPath, pathOf,
  uniqueKey, VALUE_LINKS, withinDepth, type LinkRule, type SchemaNode, type SchemaRoot, type SchemaTarget,
} from './schemaEdit';
import s from './PrefSchemaEditor.module.css';
import { icon } from '../../icons.gen';

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
  /** Where in the editor's shelf the pane draws the lists dragged from into the tree; `null` until the shelf is up. */
  shelfSlot: HTMLElement | null;
  /** Nodes the schema does not hold yet, listed under the tree with what it holds on no page, to be dragged into it. */
  unplaced?: PrefGroup;
  /** The actions the host has, listed in the shelf to be dragged into the tree as prefs that fire them. */
  actions?: ActionCatalog;
  /** Somewhere else a drag from this pane may end: the live preview. */
  outside?: DropOutside;
  /** `outside` is drawing what is dragged where it would land, so the palette and the trees draw no ghost of it. */
  outsideDraws?: boolean;
  /** The most levels of groups the schema may nest. */
  maxDepth?: number;
  /** The schema takes no edit: no tool adds or removes, and nothing is dropped here. Its rows can still be dragged out. */
  readOnly?: boolean;
  /** The dialog a layout's pointers name settings in. Given, the schema is a layout: what sits directly under its
   *  root is a row of it and not unplaced, a pointer's row is named as its setting, and nothing adds a pref or a page.
   *  Its settings are listed in the shelf, to be dragged into the tree as pointers. */
  over?: SchemaRoot;
  /** What sits directly under the root is a row of it and not unplaced, and nothing adds a pref or a page. Default:
   *  whether `over` is given. */
  pageless?: boolean;
  /** What the bar's palette makes, in place of the groups a form is laid out with. */
  palette?: readonly PaletteItem[];
  /** What a link drag, and the bar's tool for one, sets down. Default: an alias of a leaf that holds a value. */
  links?: LinkRule;
  /** Leaves listed in the shelf, to be dragged into the tree as copies. */
  parts?: PartsCatalog;
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

/** Where an add lands: inside the lead if it holds children, else after it. */
function addTargetOf(schema: SchemaRoot, lead: string | null): { parent: string | null; index?: number } {
  const node = lead === null ? undefined : nodeAt(schema, lead);
  if (lead === null || !node) return { parent: null };
  if (childrenOf(node)) return { parent: lead };
  const parent = parentPath(lead);
  const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
  return { parent, index: sibs.indexOf(keyOf(lead)) + 1 };
}

/** Where the bar's aliases of the selected prefs go: together after the one that leads, to be dragged where they
 *  belong. Null when one of what is selected has no alias to make, or they do not fit there. */
function aliasTargetOf(schema: SchemaRoot, selected: readonly string[], lead: string | null, maxDepth: number | undefined, pageless: boolean, links: LinkRule): SchemaTarget | null {
  if (lead === null || !selected.every((p) => nodeAt(schema, p)) || !selected.every((p) => links.can(schema, p))) return null;
  const parent = parentPath(lead);
  const fits = selected.every((p) => treeTakesNew(schema, links.of(schema, p), parent, maxDepth, pageless));
  if (!fits && !(parent === null && !isPrefSection(schema))) return null;
  const sibs = Object.keys(childrenOf(nodeAt(schema, parent) ?? schema) ?? {});
  return { parentPath: parent, index: sibs.indexOf(keyOf(lead)) + 1 };
}

export function StructurePane({ schema, onChange, selected, lead, onPick, onSelect, changed, kinds, custom, renderers, types, expanded, onExpandedChange, toolSlot, shelfSlot, unplaced, actions, outside, outsideDraws = false, onMove: move, onCopy: copy, onAlias: alias, onRemove, maxDepth, rowMark, readOnly = false, over, pageless = over !== undefined, palette, links = VALUE_LINKS, parts }: StructurePaneProps) {
  // What a group root holds on no page waits with the unplaced, and the tree lists the pages.
  const [nodes, looseNodes] = useMemo(() => {
    const all = toTreeNodes(schema, null, changed, rowMark, over, actions?.actions);
    const loose = new Set(looseKeys(schema, pageless));
    return [all.filter((n) => !loose.has(n.id)), all.filter((n) => loose.has(n.id))];
  }, [schema, changed, rowMark, over, pageless, actions?.actions]);
  const [query, setQuery] = useState('');
  const sought = query.trim().toLowerCase();
  const shown = useMemo(
    () => seekRows(nodes, sought),
    [nodes, sought],
  );
  const [adding, setAdding] = useState<'pref' | 'branch' | null>(null);
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
    return !readOnly && mayUnplace(schema, ids, pageless);
  };
  const waiting = useMemo(() => (unplaced ? stillUnplaced(unplaced, schema) : null), [unplaced, schema]);

  const addTarget = () => addTargetOf(schema, lead);
  /** What a new node joins. */
  const host = nodeAt(schema, addTarget().parent) ?? schema;
  const branch = branchUnder(host ?? schema);
  const choices = useMemo(() => kindChoices(kinds, types), [kinds, types]);
  // Unset, a group under the root is drawn as a page, which a layout has none of.
  const heading = pageless && addTarget().parent === null;
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...leafOf(kind, types, custom), name } : { ...(branch === 'section' ? blankSection() : blankGroup()), ...(heading ? { as: 'section' as const } : {}), name };
    setAdding(null);
    const { parent, index } = addTarget();
    onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) onExpandedChange((e) => new Set(e).add(parent));
    onSelect([joinPath(parent, key)]);
  };

  const nodesAt = (ids: readonly string[]): SchemaNode[] => ids.map((id) => nodeAt(schema, id)!);
  const canLand = (ids: readonly string[], effect: TreeDragEffect): boolean =>
    effect !== 'link' || ids.every((id) => links.can(schema, id));
  /** What a drag would set down: the nodes themselves, or aliases of them. */
  const landing = (ids: readonly string[], effect: TreeDragEffect): SchemaNode[] =>
    effect === 'link' ? ids.map((id) => links.of(schema, id)) : nodesAt(ids);
  const aliasAt = readOnly ? null : aliasTargetOf(schema, selected, lead, maxDepth, pageless, links);

  // A drag from the palette: over the tree it lands where the tree marks, and elsewhere wherever `outside` takes it.
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);
  // The same, as of the event in hand: the tree asks `canDrop` at a drop no render has caught up with.
  const carrying = useRef<PaletteDrag | null>(null);
  const treeDrop = useRef<TreeDropHandle>(null);
  /** The nodes a palette drag would set down: the ones the schema holds at its paths, else the one it makes. */
  const carried = (drag: PaletteDrag): SchemaNode[] => (drag.from ? nodesAt(drag.from) : [drag.node]);
  const onPaletteDrag = (drag: PaletteDrag | null) => {
    carrying.current = drag;
    setPaletteDrag(drag);
    if (drag) outside?.over(carried(drag), [], drag);
    else outside?.end();
  };
  const onPaletteDrop = (drag: PaletteDrag) => {
    carrying.current = drag;
    const at = treeDrop.current?.targetAt(drag) ?? null;
    const target = at ? schemaTarget(schema, at.parentId, at.index, pageless) : outside?.target(carried(drag), [], drag) ?? null;
    if (!target) return;
    if (drag.from !== undefined) {
      move(drag.from, target);
      return;
    }
    const key = uniqueKey(keysTakenAt(schema, target.parentPath, isPrefLeaf(drag.node)), drag.item.key);
    onChange(addNode(schema, target.parentPath, key, drag.node, target.index));
    const path = joinPath(target.parentPath, key);
    onExpandedChange((e) => new Set([...e, ...ancestorsOf(path), path]));
    onSelect([path]);
  };

  /** Whether the nodes at `ids`, which the schema holds, may be dropped under tree row `parentId`. */
  const takes = (ids: readonly string[], parentId: string | null): boolean => {
    if (!withinDepth(parentId, nodesAt(ids), maxDepth)) return false;
    const top = topLevelAllows(schema, ids, parentId, pageless);
    if (top !== undefined) return top;
    const parent = nodeAt(schema, parentId)!;
    return !!childrenOf(parent) && ids.every((id) => fitsUnder(parent, nodeAt(schema, id)!));
  };

  return (
    <section className={`${s.pane} ${s.structurePane}`} aria-label="Structure">
      <PaneHeader title="Structure">
        {/* A filter opens every branch it shows, so there is nothing to fold while one is set. */}
        <Button iconOnly variant="ghost" size="sm" ariaLabel="Expand all" tooltip="Expand all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set(treeBranchIds(nodes)))}><Icon name={icon('expand')} size={16} /></Button>
        <Button iconOnly variant="ghost" size="sm" ariaLabel="Collapse all" tooltip="Collapse all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set())}><Icon name={icon('collapse')} size={16} /></Button>
      </PaneHeader>
      <div className={s.treeFilter}>
        <Input value={query} onChange={setQuery} aria-label="Filter structure" placeholder="Filter" />
      </div>
      {toolSlot && createPortal(
        <Palette items={palette} sections={isPrefSection(schema)} ghost={!outsideDraws} disabled={readOnly} pages={!pageless} onDrag={onPaletteDrag} onDrop={onPaletteDrop}>
          <ToolButton icon={<Icon name={icon('core:tune')} mark={icon('markAdd')} />} label="Add pref" disabled={readOnly || pageless} onClick={() => setAdding('pref')} />
          <ToolButton icon={<Icon name={GROUP_ICON.section} mark={icon('markAdd')} />} label={`Add ${branch}`} disabled={readOnly || (branch === 'group' && !withinDepth(addTarget().parent, [blankGroup()], maxDepth))} onClick={() => setAdding('branch')} />
          <ToolButton icon={<Icon name={icon('link')} mark={icon('markAdd')} />} label={links.label} title={links.title}
            disabled={aliasAt === null} onClick={() => { if (aliasAt) alias(selected, aliasAt); }} />
          <ToolButton icon={<Icon name={icon('core:delete')} />} label="Remove" disabled={readOnly || selected.length === 0} onClick={onRemove} />
        </Palette>,
        toolSlot,
      )}
      <AddNodeDialog what={adding === 'branch' ? branch : adding} kinds={choices} onAdd={add}
        taken={keysTakenAt(schema, addTarget().parent, adding === 'pref')} dottedKey={adding === 'pref' && branch === 'section'}
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
            content: <DraggedNodes node={node} topLevel={topLevel} count={ids.length} renderers={renderers} over={over} />,
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
        selectionMode="multiple" selectionFollowsFocus
        selectedIds={selected}
        onSelectionChange={onPick}
        externalDrag={paletteDrag}
        dropRef={treeDrop}
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
          const target = overUnplaced(ids, point) && holdsPages(schema, pageless) ? looseTarget(schema) : outside?.target(landing(ids, effect), effect === 'move' ? ids : [], point);
          if (target) ({ move, copy, link: alias })[effect](ids, target);
        }}
        canDrop={(ids, t, effect) => {
          // A place among the rows shown is not that place among all of them.
          if (readOnly || sought !== '') return false;
          if (ids.length === 0) {
            const held = carrying.current;
            if (held === null) return false;
            return held.from === undefined ? treeTakesNew(schema, held.node, t.parentId, maxDepth, pageless) : takes(held.from, t.parentId);
          }
          if (effect === 'link') return canLand(ids, effect) && landing(ids, effect).every((node) => treeTakesNew(schema, node, t.parentId, maxDepth, pageless));
          return takes(ids, t.parentId);
        }}
        onMove={(ids, t) => move(ids, schemaTarget(schema, t.parentId, t.index, pageless))}
        onCopy={(ids, t) => copy(ids, schemaTarget(schema, t.parentId, t.index, pageless))}
        onLink={(ids, t) => alias(ids, schemaTarget(schema, t.parentId, t.index, pageless))}
      />
      </div>
      {(unplaced !== undefined || holdsPages(schema, pageless)) && (
        <StoredArea title="Unplaced" size="unplacedHeight" areaRef={unplacedArea} dropping={unplacing}>
          <UnplacedTree loose={looseNodes} looseAt={(path) => nodeAt(schema, path)} waiting={waiting} sought={sought}
            selected={selected} onPick={onPick} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
        </StoredArea>
      )}
      <ShelfLists slot={shelfSlot} over={readOnly ? undefined : over} layout={schema} actions={actions} parts={readOnly ? undefined : parts} sought={sought} ghost={!outsideDraws} onDrag={onPaletteDrag} onDrop={onPaletteDrop} />
    </section>
  );
}

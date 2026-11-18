import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { isPrefSection, type PrefGroup } from '@weasel-js/prefs';
import { Button, Icon, Input, type LeafRenderer, Tree, treeBranchIds } from '@weasel-js/ui';
import { seekRows } from './rowSearch';
import { AddNodeDialog } from './AddNodeDialog';
import { PaneHeader } from './PaneHeader';
import type { ActionCatalog } from './useActionCatalog';
import {
  blankGroup, childrenOf, type CustomKinds, holdsPages, keyOf, type LinkRule, looseKeys,
  nodeAt, parentPath, type PrefTypes, type SchemaNode, type SchemaRoot, schemaTarget, type SchemaTarget,
  stillUnplaced, VALUE_LINKS, withinDepth,
} from '@weasel-js/prefs/edit';
import { DraggedNodes, GHOST_WIDTH, nodeIsPage } from './NodeGhost';
import type { PaletteItem } from './Palette';
import type { PartsCatalog } from './PartsList';
import { treeTakesNew } from './previewDrop';
import { ShelfLists } from './Shelf';
import { StoredArea } from './StoredArea';
import { StructureTools } from './StructureTools';
import { treeDropRulesFor } from './treeDropRules';
import { UnplacedTree } from './UnplacedTree';
import { useNodeAdder } from './useNodeAdder';
import { usePaletteDrop } from './usePaletteDrop';
import { useTreeDragOut } from './useTreeDragOut';
import { toTreeNodes } from './structureRows';
import s from './PrefSchemaEditor.module.css';
import { icon } from '../icons.gen';

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
  renderers?: Record<string, LeafRenderer>;
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
  const treeArea = useRef<HTMLDivElement | null>(null);
  // A selection made in the preview may sit outside the tree's scrolled view. Optional-called for jsdom.
  useEffect(() => {
    if (lead === null) return;
    const rows = treeArea.current?.querySelectorAll('[data-tree-id]') ?? [];
    [...rows].find((r) => r.getAttribute('data-tree-id') === lead)?.scrollIntoView?.({ block: 'nearest' });
  }, [lead]);
  const waiting = useMemo(() => (unplaced ? stillUnplaced(unplaced, schema) : null), [unplaced, schema]);

  const adder = useNodeAdder(schema, lead, pageless, { kinds, types, custom }, { onChange, onExpandedChange, onSelect });
  const { branch } = adder;

  const rules = treeDropRulesFor(schema, links, maxDepth, pageless);
  const { unplacedArea, unplacing, onDragOutside, onDropOutside } = useTreeDragOut(schema, pageless, readOnly, rules, outside, { move, copy, link: alias });
  const aliasAt = readOnly ? null : aliasTargetOf(schema, selected, lead, maxDepth, pageless, links);
  const palettes = usePaletteDrop(schema, pageless, outside, { onChange, move, onExpandedChange, onSelect });
  const { onDrag: onPaletteDrag, onDrop: onPaletteDrop } = palettes;

  return (
    <section className={`${s.pane} ${s.structurePane}`} aria-label="Structure">
      <PaneHeader title="Structure">
        {/* A filter opens every branch it shows, so there is nothing to fold while one is set. */}
        <Button iconOnly variant="ghost" size="sm" aria-label="Expand all" tooltip="Expand all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set(treeBranchIds(nodes)))}><Icon name={icon('ui:expand')} size={16} /></Button>
        <Button iconOnly variant="ghost" size="sm" aria-label="Collapse all" tooltip="Collapse all" disabled={sought !== ''}
          onClick={() => onExpandedChange(new Set())}><Icon name={icon('ui:collapse')} size={16} /></Button>
      </PaneHeader>
      <div className={s.treeFilter}>
        <Input value={query} onChange={setQuery} aria-label="Filter structure" placeholder="Filter" />
      </div>
      {toolSlot && createPortal(
        <StructureTools items={palette} sections={isPrefSection(schema)} ghost={!outsideDraws} disabled={readOnly} pages={!pageless} onDrag={onPaletteDrag} onDrop={onPaletteDrop}
          branch={branch} links={links}
          onAddPref={readOnly || pageless ? null : () => adder.open('pref')}
          onAddBranch={readOnly || (branch === 'group' && !withinDepth(adder.parent, [blankGroup()], maxDepth)) ? null : () => adder.open('branch')}
          onLink={aliasAt === null ? null : () => alias(selected, aliasAt)}
          onRemove={readOnly || selected.length === 0 ? null : onRemove} />,
        toolSlot,
      )}
      <AddNodeDialog {...adder.dialog} />
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
            width: GHOST_WIDTH[nodeIsPage(node, topLevel) ? 'page' : 'node'],
          };
        }}
        foldBy="leading" pressFolds={false}
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
        externalDrag={palettes.drag}
        dropRef={palettes.treeDrop}
        onDragOutside={onDragOutside}
        onDropOutside={onDropOutside}
        canDrop={(ids, t, effect) => {
          // A place among the rows shown is not that place among all of them.
          if (readOnly || sought !== '') return false;
          return rules.takesDrag(ids, t.parentId, effect, palettes.carrying.current);
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

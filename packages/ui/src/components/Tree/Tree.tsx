import {
  forwardRef,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { isInControlWithin } from '@weasel-js/core';
import { intentOf, rangeOf, select as selectFrom, type SelectPolicy } from '@weasel-js/select';
import { LIST_KEYS, modsOf, selectModifiers, type PressModifiers } from '../../useReorderDragList';
import { useRowNavigation } from '../../useRowNavigation';
import { useControlHold } from '../Disabled/controlHold';
import { TreeDragGhost } from './TreeGhost';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './Tree.module.css';
import { controlCellKey, enterControls, useUntabbedControls } from './treeGridKeys';
import { handleMoveKey } from './treeKeyboardMove';
import { TreeRow } from './TreeRow';
import type { TreeNode, TreeProps } from './treeTypes';
import { nodeById } from './treeMoves';
import { hasControls, idsWhere, textOf, useControlledSet, visibleRows } from './treeUtils';
import { useRowTip } from './useRowTip';
import { useTreeDrag } from './useTreeDrag';
export type { TreeNode, TreeProps, TreeSelectionMode } from './treeTypes';

const NO_MODS: PressModifiers = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

/**
 * A hierarchy of rows that expand and collapse: a file tree, a registry
 * browser, an outline.
 *
 * **Semantics.** WAI-ARIA `tree`. A treeitem may not contain interactive
 * content, so `leading` and `trailing` are decoration — an icon, a count —
 * and the twisty is a drawn `DisclosureMark`, not a button. A node with
 * `controls` makes the tree a `treegrid` instead: each row a `row` with the
 * same states, its leading, label and trailing in one `gridcell` and its
 * controls in a second. The controls leave the tab order; Right on a leaf or
 * an open branch steps from the row into them, Left and Right walk them, Left
 * past the first or Escape steps back to the row, and Up and Down from one
 * move between rows. Right on an open branch with no controls steps into it.
 *
 * **Keyboard.** One treeitem is in the tab order: the one last focused, else
 * the first selected, else the first. Up/Down move between visible rows,
 * Home/End go to the first and last. Right opens a closed branch, then moves
 * into it; Left closes an open branch, else moves to the parent. Each of these
 * moves focus alone, or the selection with it under `selectionFollowsFocus`.
 * Enter and Space activate, as a click does. Under `selectionMode="multiple"`,
 * Shift with Up/Down/Home/End extends the selection to the row it reaches, and
 * Cmd/Ctrl+A selects every visible row. Typing moves to the next row whose text
 * starts with what was typed. With `onMove`, Alt+Up/Down move the focused node
 * (or the selection holding it) among its siblings, and Alt+Left/Right outdent
 * it and indent it under the sibling above; each goes through `canDrop`.
 *
 * **Activating** a row — click, Enter, Space — toggles it if it is a branch
 * (unless `pressFolds` is false), selects it under `selectionMode`, and calls `onAction`. Clicking the twisty
 * only toggles. A row with an `href` is a link as well: Cmd, Ctrl and Alt
 * clicks on it, and middle clicks, are the browser's, not activations.
 *
 * **Sizing.** `--wzl-tree-row-h` sets every row's height, `--wzl-control-h`
 * when unset; `--wzl-tree-font-size` sets its text.
 *
 * **Held.** Disabled, by `disabled` or a `Disabled` scope, nothing activates, folds, selects or moves: focus alone
 * moves between rows, and with no reason anywhere the tree leaves the tab order. Read-only, rows still fold, select
 * and activate, since choosing a row only looks at it; nothing moves, by drag or by key. Either way the rows'
 * `controls` are held with it.
 *
 * **Filtering** is the consumer's: narrow `nodes` with `filterTree`, and pass
 * `treeBranchIds` of the result as `expandedIds` so every match shows.
 */
export const Tree = forwardRef(function Tree(
  {
    nodes, empty, className,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    expandedIds, defaultExpandedIds, onExpandedChange, foldBy = 'twisty', pressFolds = true, hang = false, guides = false,
    selectionMode = 'none', selectionFollowsFocus = false, selectedIds, defaultSelectedIds, onSelectionChange,
    onAction, onRowKeyDown, onRowContextMenu,
    onMove: move, onCopy, onLink, canDrop, onDragOutside, onDropOutside, ghost = true, renderGhost, externalDrag, dropRef,
    disabled: off, disabledReason, readOnly, readOnlyReason,
  }: TreeProps,
  ref: Ref<HTMLUListElement>,
) {
  const [expanded, setExpanded] = useControlledSet(expandedIds, defaultExpandedIds, onExpandedChange);
  const [selected, setSelected] = useControlledSet(selectedIds, defaultSelectedIds, onSelectionChange);
  const selectable = selectionMode !== 'none';
  const rowTip = useRowTip();
  const baseId = useId();
  const grid = useMemo(() => hasControls(nodes), [nodes]);
  const hold = useControlHold({ disabled: off, disabledReason, readOnly, readOnlyReason }, { readonlyRole: false });
  const onMove = hold.refuses ? undefined : move;
  const alone = useMemo(() => idsWhere(nodes, (n) => !!n.selectsAlone), [nodes]);

  const visible = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
  const indexOf = useMemo(() => new Map(visible.map((v, i) => [v.node.id, i])), [visible]);

  const nodeAt = (id: string) => visible[indexOf.get(id) ?? -1]?.node;
  const toggle = (node: TreeNode): boolean => {
    if (!node.children || node.disabled || hold.disabled) return false;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    setExpanded(next);
    return true;
  };

  const order = () => visible.map((v) => v.node.id);
  const disabled = (id: string) => hold.disabled || !!nodeAt(id)?.disabled;
  // Neither joins a selection of more than one row.
  const single = (id: string) => disabled(id) || alone.has(id);
  const commitSelection = (ids: readonly string[]) => {
    const next = new Set(ids);
    if (next.size !== selected.size || [...next].some((x) => !selected.has(x))) setSelected(next);
  };

  const select = (id: string, mods: PressModifiers) => {
    const policy: SelectPolicy = { mode: selectionMode === 'multiple' ? 'multi' : 'single', ...LIST_KEYS };
    const result = selectFrom({ ids: [...selected], anchor: anchor.current }, id, intentOf(selectModifiers(mods), policy), {
      order: order(), forceSingle: single,
    });
    anchor.current = result.anchor;
    commitSelection(result.ids);
  };

  const activate = (node: TreeNode, mods: PressModifiers) => {
    if (node.disabled || hold.disabled) return;
    if (pressFolds) toggle(node);
    if (selectable) select(node.id, mods);
    onAction?.(node.id, mods);
  };

  const nav = useRowNavigation<HTMLElement>({
    rows: useMemo(() => visible.map((v) => ({ id: v.node.id, parentId: v.parentId })), [visible]),
    isSelected: (id) => selectable && selected.has(id),
    // Selection with focus, and Shift's range, pass over disabled rows: focus alone moves there.
    onReach: (id) => {
      if (selectable && selectionFollowsFocus && !disabled(id)) select(id, NO_MODS);
    },
    ...(selectionMode === 'multiple' ? {
      onExtend: (id: string) => { if (!single(id)) select(id, { ...NO_MODS, shiftKey: true }); },
      onSelectAll: () => {
        if (hold.disabled) return;
        const ids = order();
        commitSelection(rangeOf(ids, ids[0]!, ids[ids.length - 1]!, single));
      },
    } : {}),
    onActivate: (id, mods) => { const node = nodeAt(id); if (node) activate(node, mods); },
    tree: {
      isBranch: (id) => !!nodeAt(id)?.children,
      isOpen: (id) => !!nodeAt(id)?.children && expanded.has(id),
      toggle: (id) => { const node = nodeAt(id); return node ? toggle(node) : false; },
    },
    textOf: (id) => { const node = nodeAt(id); return node ? textOf(node) : ''; },
  });
  const items = nav.els;
  const anchor = nav.anchor;

  const treeEl = useRef<HTMLUListElement | null>(null);
  const isEmpty = nodes.length === 0;
  // The element behind the ref changes when the tree swaps with the empty state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => treeEl.current as HTMLUListElement, [isEmpty]);
  useUntabbedControls(grid, treeEl);
  // A treegrid's focused element is the row box; a tree's is the `li` around it.
  const rowBox = (id: string) => (grid ? items.current.get(id) : items.current.get(id)?.firstElementChild) as HTMLElement | undefined;
  const drag = useTreeDrag({
    enabled: !!onMove,
    onDragOutside, onDropOutside, externalDrag, dropRef,
    nodes, visible, expanded, selected,
    container: () => treeEl.current,
    rowEl: rowBox,
    canDrop, onMove, onCopy, onLink,
    onPress: (id, mods) => { const v = visible[indexOf.get(id) ?? -1]; if (v) activate(v.node, mods); },
    expand: (id) => { if (!expanded.has(id)) setExpanded(new Set(expanded).add(id)); },
  });

  if (nodes.length === 0) {
    return <div className={[s.empty, className].filter(Boolean).join(' ')} data-held={hold.held}>{empty ?? '—'}</div>;
  }

  const onKeyDown = (node: TreeNode) => (e: KeyboardEvent<HTMLElement>) => {
    if (grid && controlCellKey(e, (delta, extend) => nav.go(node.id, (indexOf.get(node.id) ?? 0) + delta, extend))) return;
    if (e.target !== e.currentTarget) return;
    onRowKeyDown?.(node.id, e);
    if (e.defaultPrevented) return;
    if (onMove && handleMoveKey(e, node.id, { nodes, selected, expanded, setExpanded, canDrop, onMove, focusAfterMove: nav.focusLater })) return;
    if (grid && enterControls(e, !!node.children && !expanded.has(node.id))) return;
    nav.onKeyDown(node.id, e);
  };

  const tipNode = rowTip.tip && !drag.state.dragging ? visible[indexOf.get(rowTip.tip.id) ?? -1]?.node : undefined;

  let seq = 0;
  const renderLevel = (list: readonly TreeNode[], level: number): ReactNode =>
    list.map((node, pos) => {
      const open = !!node.children && expanded.has(node.id);
      return (
        <TreeRow
          key={node.id}
          node={node} grid={grid} level={level} setSize={list.length} posInSet={pos + 1} open={open}
          selected={selectable ? selected.has(node.id) : undefined}
          tabStop={node.id === nav.tabStop && hold.access.reachable}
          hold={hold.focus}
          labelId={`${baseId}-${seq++}`}
          foldBy={foldBy}
          drop={drag.state.mark?.id === node.id ? drag.state.mark.where : undefined}
          dragging={drag.state.effect === 'move' && !!drag.state.dragging?.includes(node.id)}
          drags={!!onMove}
          rowRef={nav.rowRef(node.id)}
          onKeyDown={onKeyDown(node)}
          onFocus={(e) => {
            if (e.target !== e.currentTarget) return;
            nav.onFocus(node.id);
            // A press focuses the item too, and the pointer's own rest is what opens the tooltip then.
            if (node.tooltip != null && e.currentTarget.matches(':focus-visible')) rowTip.rest(node.id, rowBox(node.id)!);
          }}
          onBlur={(e) => { if (e.target === e.currentTarget) rowTip.clear(); }}
          onPress={(e) => { if (!isInControlWithin(e.target, e.currentTarget)) activate(node, modsOf(e)); }}
          onToggle={() => toggle(node)}
          onPointerEnter={node.tooltip != null ? (e) => rowTip.rest(node.id, e.currentTarget) : undefined}
          onPointerLeave={node.tooltip != null ? rowTip.clear : undefined}
          onPointerDown={(e) => {
            rowTip.clear();
            if (onMove) drag.onPointerDown(node.id, e);
          }}
          onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(node.id, e) : undefined}
        >
          {open && node.children!.length > 0 && (
            <ul role={grid ? 'none' : 'group'} className={guides ? `${s.group} ${s.guide}` : s.group}>
              {renderLevel(node.children!, level + 1)}
            </ul>
          )}
        </TreeRow>
      );
    });

  return (
    <>
      {hold.wrap(hold.scope(<ul
        ref={treeEl}
        role={grid ? 'treegrid' : 'tree'}
        className={[s.tree, className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-multiselectable={selectionMode === 'multiple' || undefined}
        data-drag-effect={drag.state.effect === 'move' ? undefined : drag.state.effect}
        data-fold={foldBy}
        data-hang={hang ? '' : undefined}
        data-guides={guides ? '' : undefined}
        data-held={hold.held}
        aria-readonly={(grid && hold.access.state === 'readOnly') || undefined}
      >
        {renderLevel(nodes, 1)}
      </ul>))}
      {tipNode?.tooltip != null && (
        // The trigger is the row, handed over by ref: the tooltip only reads its open state from the wrapper.
        <TooltipTrigger isOpen>
          <Tooltip triggerRef={{ current: rowTip.tip!.el }} placement="right">{tipNode.tooltip}</Tooltip>
        </TooltipTrigger>
      )}
      {ghost && treeEl.current && (
        // Not the shown rows: a drag also carries selected rows folded away in a closed branch.
        <TreeDragGhost state={drag.state} from={treeEl.current} labelOf={(id) => nodeById(nodes, id)?.label ?? id} render={renderGhost} />
      )}
    </>
  );
});

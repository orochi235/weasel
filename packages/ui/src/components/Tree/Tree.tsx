import {
  forwardRef,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { useControlHold } from '../Disabled/controlHold';
import { TreeDragGhost } from './TreeGhost';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './Tree.module.css';
import { useUntabbedControls } from './treeGridKeys';
import { rowKeyDown, type TreeRowKeysHost } from './treeRowKeys';
import { TreeRow } from './TreeRow';
import type { TreeNode, TreeProps } from './treeTypes';
import { nodeById } from './treeMoves';
import { hasControls, useTreeFold, visibleRows } from './treeUtils';
import { useTreeNav } from './useTreeNav';
import { useRowTip } from './useRowTip';
import { useTreeDrag, type TreeDragState } from './useTreeDrag';
import { useTreeSelection } from './useTreeSelection';
import { bindRowPointer, type TreeRowPointerHost } from './treeRowPointer';
export type { TreeNode, TreeProps, TreeSelectionMode } from './treeTypes';


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
  const hold = useControlHold({ disabled: off, disabledReason, readOnly, readOnlyReason }, { readonlyRole: false });
  const { expanded, setExpanded, toggle, expand } = useTreeFold(expandedIds, defaultExpandedIds, onExpandedChange, hold.disabled);
  const rowTip = useRowTip();
  const baseId = useId();
  const grid = useMemo(() => hasControls(nodes), [nodes]);
  const onMove = hold.refuses ? undefined : move;

  const visible = useMemo(() => visibleRows(nodes, expanded), [nodes, expanded]);
  const indexOf = useMemo(() => new Map(visible.map((v, i) => [v.node.id, i])), [visible]);
  const nodeAt = (id: string) => visible[indexOf.get(id) ?? -1]?.node;
  const selection = useTreeSelection({
    nodes, visible, nodeAt, selectionMode, selectedIds, defaultSelectedIds, onSelectionChange, held: hold.disabled,
  });
  const { selected, selectable } = selection;

  const { nav, activate, rowBox } = useTreeNav({
    visible, nodeAt, expanded, selection, selectionMode, selectionFollowsFocus, toggle, pressFolds, onAction, held: hold.disabled, grid,
  });

  const treeEl = useRef<HTMLUListElement | null>(null);
  const isEmpty = nodes.length === 0;
  // The element behind the ref changes when the tree swaps with the empty state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => treeEl.current as HTMLUListElement, [isEmpty]);
  useUntabbedControls(grid, treeEl);
  const drag = useTreeDrag({
    enabled: !!onMove,
    onDragOutside, onDropOutside, externalDrag, dropRef,
    nodes, visible, expanded, selected,
    container: () => treeEl.current,
    rowEl: rowBox,
    canDrop, onMove, onCopy, onLink,
    onPress: (id, mods) => { const node = nodeAt(id); if (node) activate(node, mods); },
    expand,
  });

  if (nodes.length === 0) {
    return <div className={[s.empty, className].filter(Boolean).join(' ')} data-held={hold.held}>{empty ?? '—'}</div>;
  }

  const keysHost: TreeRowKeysHost = {
    grid, expanded, onRowKeyDown,
    moves: onMove && { nodes, selected, expanded, setExpanded, canDrop, onMove, focusAfterMove: nav.focusLater },
    step: (id, delta, extend) => nav.go(id, (indexOf.get(id) ?? 0) + delta, extend),
    navKey: nav.onKeyDown,
  };

  const tipNode = rowTip.tip && !drag.state.dragging ? nodeAt(rowTip.tip.id) : undefined;

  const pointerHost: TreeRowPointerHost = {
    rowTip, rowBox, focused: nav.onFocus, activate, toggle, onRowContextMenu,
    drag: onMove ? drag.onPointerDown : undefined,
  };
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
          onKeyDown={(e) => rowKeyDown(node, e, keysHost)}
          {...bindRowPointer(node, pointerHost)}
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
      <TreeOverlays
        tip={tipNode?.tooltip != null ? { el: rowTip.tip!.el, content: tipNode.tooltip } : null}
        ghost={ghost ? treeEl.current : null} nodes={nodes} drag={drag.state} renderGhost={renderGhost}
      />
    </>
  );
});

/**
 * What a tree draws outside its list: the open tooltip beside its row, and the ghost of a drag drawn from the tree
 * `ghost` names. The tooltip's trigger is the row, handed over by ref: it only reads its open state from the wrapper.
 */
function TreeOverlays({ tip, ghost, nodes, drag, renderGhost }: {
  tip: { el: HTMLElement; content: ReactNode } | null;
  ghost: HTMLElement | null;
  nodes: readonly TreeNode[];
  drag: TreeDragState;
  renderGhost: TreeProps['renderGhost'];
}) {
  return (
    <>
      {tip && (
        <TooltipTrigger open>
          <Tooltip triggerRef={{ current: tip.el }} placement="right">{tip.content}</Tooltip>
        </TooltipTrigger>
      )}
      {ghost && (
        // Not the shown rows: a drag also carries selected rows folded away in a closed branch.
        <TreeDragGhost state={drag} from={ghost} labelOf={(id) => nodeById(nodes, id)?.label ?? id} render={renderGhost} />
      )}
    </>
  );
}

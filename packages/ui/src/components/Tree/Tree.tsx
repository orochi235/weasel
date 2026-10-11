import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { intentOf, select as selectFrom, type SelectPolicy } from '@weasel-js/select';
import type { TreeDropTarget } from '../../dropTarget';
import { selectModifiers, type PressModifiers } from '../../useReorderDragList';
import { DisclosureMark } from '../Disclosure';
import { DragGhost } from '../DragGhost';
import { Icon } from '../../icons';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './Tree.module.css';
import { handleMoveKey } from './treeKeyboardMove';
import { modsOf, textOf, useControlledSet } from './treeUtils';
import { useRowTip } from './useRowTip';
import { useTreeDrag, type TreeDragEffect } from './useTreeDrag';

/** One node. A node with `children` is a branch, even when the array is empty. */
export interface TreeNode {
  /** Unique across the whole tree. */
  id: string;
  label: ReactNode;
  /** What type-ahead matches against. Defaults to `label` when that is a string. */
  textValue?: string;
  /** Decoration before the label — an icon. Not a control. */
  leading?: ReactNode;
  /** Decoration after the label — a count badge. Not a control. Read as part
   *  of the row's accessible name. */
  trailing?: ReactNode;
  /** Shown beside the row once the pointer, or keyboard focus, has rested on it. A string is also the row's
   *  accessible description. */
  tooltip?: ReactNode;
  children?: readonly TreeNode[];
  /** Present but not in effect. */
  muted?: boolean;
  /** Focusable and announced, but cannot be activated, expanded or selected. */
  disabled?: boolean;
  className?: string;
}

/** Whether and how rows are selectable. */
export type TreeSelectionMode = 'none' | 'single' | 'multiple';

/** Props for {@link Tree}. */
export interface TreeProps {
  nodes: readonly TreeNode[];
  /** Shown in place of the tree when `nodes` is empty. */
  empty?: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;

  /** Open branches, controlled. */
  expandedIds?: Iterable<string>;
  /** Open branches on first render, when uncontrolled. */
  defaultExpandedIds?: Iterable<string>;
  /** The whole set a toggle would produce. Called whether or not controlled. */
  onExpandedChange?(ids: Set<string>): void;

  /** What folds a branch on a click of its own. Default `'twisty'`, the mark in the row's gutter. `'leading'`
   *  draws no mark and gives the job to the branch's `leading`, which carries `data-open` while it is open. */
  foldBy?: 'twisty' | 'leading';

  /** Default `'none'`. `'multiple'` adds to the selection with Cmd/Ctrl and
   *  extends it over visible rows with Shift. */
  selectionMode?: TreeSelectionMode;
  /** Selected rows, controlled. */
  selectedIds?: Iterable<string>;
  /** Selected rows on first render, when uncontrolled. */
  defaultSelectedIds?: Iterable<string>;
  /** The whole set an activation would produce, when it differs. */
  onSelectionChange?(ids: Set<string>): void;

  /** A row was activated — click, Enter or Space — with the modifiers held. */
  onAction?(id: string, mods: PressModifiers): void;

  /** Drag-to-reorder and keyboard moves. Off unless given. Called with the
   *  dragged ids in tree order and where they land; `Tree` never reorders
   *  `nodes` itself. */
  onMove?(ids: string[], target: TreeDropTarget): void;
  /** A drag with Alt held copies: the rows stay put, and this is called with them and where the copies land.
   *  `Tree` makes no copy itself. Without it Alt changes nothing, and the drag moves. Needs `onMove`. */
  onCopy?(ids: string[], target: TreeDropTarget): void;
  /** A drag with Alt and Cmd or Ctrl held links: the rows stay put, and this is called with them and where
   *  something that stands for them should land. What that is, is the caller's to say. Needs `onMove`. */
  onLink?(ids: string[], target: TreeDropTarget): void;
  /** Refuse a drop. A drop into a dragged node or beneath one is refused
   *  regardless. Default: allow. */
  canDrop?(ids: readonly string[], target: TreeDropTarget, effect: TreeDragEffect): boolean;
  /**
   * Asked while a drag begun in this tree is outside it: whether what is under
   * the client point would take the drop. While it answers true the tree marks
   * nothing, and a release there calls `onDropOutside` and not `onMove`.
   * Called with `null` when the drag comes back inside or ends.
   */
  onDragOutside?(ids: readonly string[], point: { x: number; y: number } | null, effect: TreeDragEffect): boolean;
  onDropOutside?(ids: string[], point: { x: number; y: number }, effect: TreeDragEffect): void;
  /**
   * A drag begun outside the tree, at this client point. The tree marks where
   * it would land — asking `canDrop` with no ids — and reports the target
   * through `onExternalTarget`, `null` while the point is off its rows.
   */
  externalDrag?: { x: number; y: number } | null;
  onExternalTarget?(target: TreeDropTarget | null): void;
}

interface Visible {
  node: TreeNode;
  parentId: string | null;
  level: number;
  index: number;
}

const TYPEAHEAD_MS = 500;
/** A list's convention: Cmd/Ctrl toggles a row, shift ranges from the anchor. */
const LIST_KEYS = { toggle: ['meta', 'ctrl'], range: 'shift' } as const;

/**
 * A hierarchy of rows that expand and collapse: a file tree, a registry
 * browser, an outline.
 *
 * **Semantics.** WAI-ARIA `tree`: each node is a `treeitem` carrying
 * `aria-level`, `aria-setsize` and `aria-posinset`; a branch carries
 * `aria-expanded` and nests its children in a `group`, which is rendered only
 * while the branch is open. `aria-selected` appears only when `selectionMode`
 * is set. A treeitem may not contain interactive content, so `leading` and
 * `trailing` are decoration — an icon, a count — and the twisty is a drawn
 * `DisclosureMark`, not a button.
 *
 * **Keyboard.** One treeitem is in the tab order: the one last focused, else
 * the first selected, else the first. Up/Down move between visible rows,
 * Home/End go to the first and last. Right opens a closed branch, then moves
 * into it; Left closes an open branch, else moves to the parent. Enter and
 * Space activate, as a click does. Typing moves to the next row whose text
 * starts with what was typed. With `onMove`, Alt+Up/Down move the focused node
 * (or the selection holding it) among its siblings, and Alt+Left/Right outdent
 * it and indent it under the sibling above; each goes through `canDrop`.
 *
 * **Activating** a row — click, Enter, Space — toggles it if it is a branch,
 * selects it under `selectionMode`, and calls `onAction`. Clicking the twisty
 * only toggles.
 *
 * **Filtering** is the consumer's: narrow `nodes` with `filterTree`, and pass
 * `treeBranchIds` of the result as `expandedIds` so every match shows.
 */
export const Tree = forwardRef(function Tree(
  {
    nodes, empty, className,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
    expandedIds, defaultExpandedIds, onExpandedChange, foldBy = 'twisty',
    selectionMode = 'none', selectedIds, defaultSelectedIds, onSelectionChange,
    onAction, onMove, onCopy, onLink, canDrop, onDragOutside, onDropOutside, externalDrag, onExternalTarget,
  }: TreeProps,
  ref: Ref<HTMLUListElement>,
) {
  const [expanded, setExpanded] = useControlledSet(expandedIds, defaultExpandedIds, onExpandedChange);
  const [selected, setSelected] = useControlledSet(selectedIds, defaultSelectedIds, onSelectionChange);
  const selectable = selectionMode !== 'none';
  const rowTip = useRowTip();
  const baseId = useId();

  const visible = useMemo(() => {
    const out: Visible[] = [];
    const walk = (list: readonly TreeNode[], parentId: string | null, level: number) => {
      list.forEach((node, index) => {
        out.push({ node, parentId, level, index });
        if (node.children && expanded.has(node.id)) walk(node.children, node.id, level + 1);
      });
    };
    walk(nodes, null, 1);
    return out;
  }, [nodes, expanded]);
  const indexOf = useMemo(() => new Map(visible.map((v, i) => [v.node.id, i])), [visible]);

  const items = useRef(new Map<string, HTMLLIElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const typed = useRef({ text: '', at: 0 });
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    if (id == null) return;
    pendingFocus.current = null;
    items.current.get(id)?.focus();
  });

  const stopId = focusId != null && indexOf.has(focusId)
    ? focusId
    : (visible.find((v) => selectable && selected.has(v.node.id)) ?? visible[0])?.node.id;

  const focus = (id: string | undefined) => { if (id != null) items.current.get(id)?.focus(); };

  const toggle = (node: TreeNode) => {
    if (!node.children || node.disabled) return;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else next.add(node.id);
    setExpanded(next);
  };

  const select = (id: string, mods: PressModifiers) => {
    const policy: SelectPolicy = { mode: selectionMode === 'multiple' ? 'multi' : 'single', ...LIST_KEYS };
    const result = selectFrom({ ids: [...selected], anchor: anchor.current }, id, intentOf(selectModifiers(mods), policy), {
      order: visible.map((v) => v.node.id),
      eligible: (x) => !visible[indexOf.get(x) ?? -1]?.node.disabled,
    });
    anchor.current = result.anchor;
    const next = new Set(result.ids);
    if (next.size !== selected.size || [...next].some((x) => !selected.has(x))) setSelected(next);
  };

  const activate = (node: TreeNode, mods: PressModifiers) => {
    if (node.disabled) return;
    toggle(node);
    if (selectable) select(node.id, mods);
    onAction?.(node.id, mods);
  };

  const treeEl = useRef<HTMLUListElement | null>(null);
  const isEmpty = nodes.length === 0;
  // The element behind the ref changes when the tree swaps with the empty state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => treeEl.current as HTMLUListElement, [isEmpty]);
  const drag = useTreeDrag({
    enabled: !!onMove,
    onDragOutside, onDropOutside, externalDrag, onExternalTarget,
    nodes, visible, expanded, selected,
    container: () => treeEl.current,
    rowEl: (id) => items.current.get(id)?.firstElementChild as HTMLElement | undefined,
    canDrop, onMove, onCopy, onLink,
    onPress: (id, mods) => { const v = visible[indexOf.get(id) ?? -1]; if (v) activate(v.node, mods); },
    expand: (id) => { if (!expanded.has(id)) setExpanded(new Set(expanded).add(id)); },
  });

  if (nodes.length === 0) {
    return <div className={[s.empty, className].filter(Boolean).join(' ')}>{empty ?? '—'}</div>;
  }

  const onKeyDown = (v: Visible) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.target !== e.currentTarget) return;
    const i = indexOf.get(v.node.id)!;
    const { node } = v;
    const open = !!node.children && expanded.has(node.id);
    if (onMove && handleMoveKey(e, node.id, {
      nodes, selected, expanded, setExpanded, canDrop, onMove,
      focusAfterMove: (id) => { pendingFocus.current = id; },
    })) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focus(visible[Math.min(i + 1, visible.length - 1)].node.id);
        return;
      case 'ArrowUp':
        e.preventDefault();
        focus(visible[Math.max(i - 1, 0)].node.id);
        return;
      case 'Home':
        e.preventDefault();
        focus(visible[0].node.id);
        return;
      case 'End':
        e.preventDefault();
        focus(visible[visible.length - 1].node.id);
        return;
      case 'ArrowRight':
        if (!node.children) return;
        e.preventDefault();
        if (!open) toggle(node);
        else focus(node.children[0]?.id);
        return;
      case 'ArrowLeft':
        e.preventDefault();
        if (open) toggle(node);
        else focus(v.parentId ?? undefined);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(node, modsOf(e));
        return;
      default:
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        typeAhead(e, i);
    }
  };

  const typeAhead = (e: KeyboardEvent, from: number) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > TYPEAHEAD_MS ? e.key : t.text + e.key;
    t.at = now;
    const want = t.text.toLowerCase();
    // A fresh first letter looks past the current row; a longer prefix may still match it.
    const start = t.text.length === 1 ? from + 1 : from;
    for (let k = 0; k < visible.length; k++) {
      const v = visible[(start + k) % visible.length];
      if (textOf(v.node).toLowerCase().startsWith(want)) {
        e.preventDefault();
        focus(v.node.id);
        return;
      }
    }
  };

  const tipNode = rowTip.tip && !drag.state.dragging ? visible[indexOf.get(rowTip.tip.id) ?? -1]?.node : undefined;

  const onRowClick = (node: TreeNode) => (e: MouseEvent<HTMLDivElement>) => activate(node, modsOf(e));

  const onTwistyClick = (node: TreeNode) => (e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    toggle(node);
  };

  const itemRef = (id: string) => (el: HTMLLIElement | null) => {
    if (el) items.current.set(id, el);
    else items.current.delete(id);
  };

  let seq = 0;
  const renderLevel = (list: readonly TreeNode[], parentId: string | null, level: number): ReactNode =>
    list.map((node, pos) => {
      const n = seq++;
      const branch = !!node.children;
      const open = branch && expanded.has(node.id);
      const labelId = `${baseId}-${n}`;
      const trailingId = node.trailing != null ? `${baseId}-${n}-t` : undefined;
      return (
        <li
          key={node.id}
          ref={itemRef(node.id)}
          role="treeitem"
          className={[s.item, node.className].filter(Boolean).join(' ')}
          aria-level={level}
          aria-setsize={list.length}
          aria-posinset={pos + 1}
          aria-expanded={branch ? open : undefined}
          aria-selected={selectable ? selected.has(node.id) : undefined}
          aria-disabled={node.disabled || undefined}
          aria-labelledby={trailingId ? `${labelId} ${trailingId}` : labelId}
          aria-description={typeof node.tooltip === 'string' ? node.tooltip : undefined}
          data-muted={node.muted ? 'true' : undefined}
          data-drop={drag.state.mark?.id === node.id ? drag.state.mark.where : undefined}
          data-dragging={drag.state.effect === 'move' && drag.state.dragging?.includes(node.id) ? 'true' : undefined}
          tabIndex={node.id === stopId ? 0 : -1}
          onKeyDown={onKeyDown({ node, parentId, level, index: pos })}
          onFocus={(e) => {
            if (e.target !== e.currentTarget) return;
            setFocusId(node.id);
            // A press focuses the item too, and the pointer's own rest is what opens the tooltip then.
            if (node.tooltip != null && e.currentTarget.matches(':focus-visible')) rowTip.rest(node.id, e.currentTarget.firstElementChild as HTMLElement);
          }}
          onBlur={(e) => { if (e.target === e.currentTarget) rowTip.clear(); }}
        >
          <div
            className={s.row}
            onClick={onRowClick(node)}
            onPointerEnter={node.tooltip != null ? (e) => rowTip.rest(node.id, e.currentTarget) : undefined}
            onPointerLeave={node.tooltip != null ? rowTip.clear : undefined}
            onPointerDown={(e) => {
              rowTip.clear();
              if (onMove) drag.onPointerDown(node.id, e);
            }}
          >
            {foldBy === 'twisty' && (
              <span className={s.twisty} aria-hidden="true" data-tree-twisty="" onClick={branch ? onTwistyClick(node) : undefined}>
                {branch && <DisclosureMark open={open} />}
              </span>
            )}
            {node.leading != null && (foldBy === 'leading' && branch
              ? <span className={s.leading} data-tree-twisty="" data-open={open ? '' : undefined} onClick={onTwistyClick(node)}>{node.leading}</span>
              : <span className={s.leading}>{node.leading}</span>)}
            <span id={labelId} className={s.label}>{node.label}</span>
            {trailingId && <span id={trailingId} className={s.trailing}>{node.trailing}</span>}
          </div>
          {open && node.children!.length > 0 && (
            <ul role="group" className={s.group}>
              {renderLevel(node.children!, node.id, level + 1)}
            </ul>
          )}
        </li>
      );
    });

  return (
    <>
      <ul
        ref={treeEl}
        role="tree"
        className={[s.tree, className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-multiselectable={selectionMode === 'multiple' || undefined}
        data-drag-effect={drag.state.effect === 'move' ? undefined : drag.state.effect}
        data-fold={foldBy}
      >
        {renderLevel(nodes, null, 1)}
      </ul>
      {tipNode?.tooltip != null && (
        // The trigger is the row, handed over by ref: the tooltip only reads its open state from the wrapper.
        <TooltipTrigger isOpen>
          <Tooltip triggerRef={{ current: rowTip.tip!.el }} placement="right">{tipNode.tooltip}</Tooltip>
        </TooltipTrigger>
      )}
      {drag.state.ghost && treeEl.current && (
        <DragGhost at={drag.state.ghost} from={treeEl.current}>
          {drag.state.ghost.ids.map((id) => {
            const v = visible[indexOf.get(id) ?? -1];
            return (
              <div key={id} className={s.ghostRow}>
                {drag.state.effect !== 'move' && <Icon name={drag.state.effect === 'link' ? 'link' : 'add'} size={14} className={s.ghostEffect} />}
                {v?.node.label ?? id}
              </div>
            );
          })}
        </DragGhost>
      )}
    </>
  );
});

/**
 * `nodes` narrowed to those `match` accepts, plus their ancestors. A matching
 * node keeps its whole subtree; a branch with no match inside it is dropped.
 * Returns `nodes` itself when nothing is dropped.
 */
export function filterTree(
  nodes: readonly TreeNode[],
  match: (node: TreeNode) => boolean,
): readonly TreeNode[] {
  let changed = false;
  const out: TreeNode[] = [];
  for (const node of nodes) {
    if (match(node)) {
      out.push(node);
      continue;
    }
    const kids = node.children ? filterTree(node.children, match) : [];
    if (kids.length === 0) {
      changed = true;
      continue;
    }
    if (kids !== node.children) changed = true;
    out.push(kids === node.children ? node : { ...node, children: kids });
  }
  return changed ? out : nodes;
}

/** Every branch id in `nodes`, depth first — `expandedIds` for a tree with everything open. */
export function treeBranchIds(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      if (!node.children) continue;
      out.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

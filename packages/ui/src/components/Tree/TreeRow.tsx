import type { AriaRole, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import type { DropMark } from '../../dropTarget';
import s from './Tree.module.css';
import { TreeRowBox, TreeRowLead } from './TreeRowLead';
import type { TreeNode } from './treeTypes';

/** One row as `Tree` has worked it out: its place, its state, and its handlers. */
export interface TreeRowProps {
  node: TreeNode;
  /** The tree is a treegrid: the row's box is the row, and the `li` around it is no part of the structure. */
  grid: boolean;
  level: number;
  setSize: number;
  posInSet: number;
  open: boolean;
  /** Unset in a tree that does not select. */
  selected: boolean | undefined;
  tabStop: boolean;
  labelId: string;
  foldBy: 'twisty' | 'leading';
  drop: DropMark['where'] | undefined;
  dragging: boolean;
  /** The tree drags its rows, so a row is no native drag source. */
  drags: boolean;
  rowRef(el: HTMLElement | null): void;
  onKeyDown(e: KeyboardEvent<HTMLElement>): void;
  onFocus(e: FocusEvent<HTMLElement>): void;
  onBlur(e: FocusEvent<HTMLElement>): void;
  onPress(e: MouseEvent<HTMLElement>): void;
  onToggle(): void;
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerEnter?(e: PointerEvent<HTMLElement>): void;
  onPointerLeave?(): void;
  onContextMenu?(e: MouseEvent<HTMLElement>): void;
  /** The open branch's rows. */
  children?: ReactNode;
}

/** The attribute a row's control cell carries, for the tree to find it from a key on the row. */
export const CONTROLS_ATTR = 'data-tree-controls';

/** One node's `li`, its row, and under it the rows of its open branch. */
export function TreeRow(p: TreeRowProps) {
  const { node, grid } = p;
  const branch = !!node.children;
  const trailingId = node.trailing != null ? `${p.labelId}-t` : undefined;
  const row = {
    ref: p.rowRef,
    role: (grid ? 'row' : 'treeitem') as AriaRole,
    'aria-level': p.level,
    'aria-setsize': p.setSize,
    'aria-posinset': p.posInSet,
    'aria-expanded': branch ? p.open : undefined,
    'aria-selected': p.selected,
    'aria-disabled': node.disabled || undefined,
    'aria-current': node.current ? ('true' as const) : undefined,
    'aria-labelledby': trailingId ? `${p.labelId} ${trailingId}` : p.labelId,
    'aria-description': typeof node.tooltip === 'string' ? node.tooltip : undefined,
    tabIndex: p.tabStop ? 0 : -1,
    onKeyDown: p.onKeyDown,
    onFocus: p.onFocus,
    onBlur: p.onBlur,
  };
  const lead = (
    <>
      <TreeRowLead foldBy={p.foldBy} branch={branch} open={p.open} leading={node.leading} onToggle={p.onToggle} />
      <span id={p.labelId} className={s.label}>{node.label}</span>
      {trailingId && <span id={trailingId} className={s.trailing}>{node.trailing}</span>}
    </>
  );
  return (
    <li
      {...(grid ? { role: 'none' } : row)}
      className={[s.item, node.className].filter(Boolean).join(' ')}
      data-tree-id={node.id}
      data-branch={branch ? '' : undefined}
      data-muted={node.muted ? 'true' : undefined}
      data-drop={p.drop}
      data-dragging={p.dragging ? 'true' : undefined}
    >
      <TreeRowBox
        {...(grid ? row : {})}
        className={s.row} href={node.href} draggable={p.drags ? false : undefined}
        onPress={p.onPress}
        onPointerEnter={p.onPointerEnter}
        onPointerLeave={p.onPointerLeave}
        onPointerDown={p.onPointerDown}
        onContextMenu={p.onContextMenu}
      >
        {grid ? (
          <>
            <div role="gridcell" className={s.cell}>{lead}</div>
            <div role="gridcell" className={s.controls} {...{ [CONTROLS_ATTR]: '' }}>{node.controls}</div>
          </>
        ) : lead}
      </TreeRowBox>
      {p.children}
    </li>
  );
}

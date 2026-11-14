import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { TreeDropTarget } from '../../dropTarget';
import type { PressModifiers } from '../../useReorderDragList';
import type { TreeGhost, TreeGhostWhere } from './TreeGhost';
import type { TreeDropHandle } from './useOutsideDrop';
import type { TreeDragEffect } from './useTreeDrag';

/** One node. A node with `children` is a branch, even when the array is empty. */
export interface TreeNode {
  /** Unique across the whole tree. */
  id: string;
  label: ReactNode;
  /** What type-ahead matches against. Defaults to `label` when that is a string. */
  textValue?: string;
  /** Decoration before the label — an icon, not a control. `--wzl-tree-leading-size` sets each in a square of that side. */
  leading?: ReactNode;
  /** Decoration after the label — a count badge. Not a control: those go in `controls`. Read as part of the
   *  row's accessible name. */
  trailing?: ReactNode;
  /** Buttons and toggles at the row's end — visibility, lock, remove. They keep their own clicks and keys, and a
   *  node with any makes the whole tree a treegrid (see `Tree`'s Semantics). A control that edits with the arrow
   *  keys does not belong here. */
  controls?: ReactNode;
  /** Shown beside the row once the pointer, or keyboard focus, has rested on it. A string is also the row's
   *  accessible description. */
  tooltip?: ReactNode;
  children?: readonly TreeNode[];
  /** Present but not in effect. */
  muted?: boolean;
  /** Focusable and announced, but cannot be activated, expanded or selected. */
  disabled?: boolean;
  /** Stays where it is: a drag cannot start on it, and a drag or a keyboard move of a selection holding it leaves
   *  it behind. It can still be selected, and still takes drops. */
  immovable?: boolean;
  /** Selected only on its own: a press on it, with any modifier, selects it alone, a press elsewhere drops it from
   *  the selection, and a Shift range or Cmd/Ctrl+A passes over it. */
  selectsAlone?: boolean;
  /** Draws the row as a link to this address. A plain or Shift click activates the row as any click does; a
   *  click with Cmd, Ctrl or Alt, and a middle click, are left to the browser, which opens a tab, a window or a
   *  download. The link stays out of the tab order: the treeitem holds focus. */
  href?: string;
  /** The row stands for what is showing now elsewhere — the open page, the running document. Sets
   *  `aria-current`, and colors the row with `--wzl-tree-current`. */
  current?: boolean;
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
  /** Whether activating a branch — a click on its row, Enter, Space — folds it as well. Default true. False suits a
   *  tree whose selection drives something drawn beside it, where picking a branch to look at should not hide what
   *  it holds; the twisty (or `leading`) and the arrow keys still fold it. */
  pressFolds?: boolean;
  /** Hangs a leaf's `leading` in the gutter, where a branch has its mark, so a leaf's label starts at the same x
   *  with a glyph or without. For a list where only some leaves have one. No effect under `guides`. */
  hang?: boolean;
  /** Draw a bracket down the side of each open branch's rows, from under the start of its label to its last row, to show
   *  what a branch holds. `--wzl-tree-guide` is its color. */
  guides?: boolean;

  /** Default `'none'`. `'multiple'` adds to the selection with Cmd/Ctrl,
   *  extends it over visible rows with Shift, and takes them all with Cmd/Ctrl+A. */
  selectionMode?: TreeSelectionMode;
  /** The arrow keys, Home and End select the row they reach, rather than only focusing it: for a tree whose selection
   *  drives something drawn beside it, such as an inspector. Default false. */
  selectionFollowsFocus?: boolean;
  /** Selected rows, controlled. */
  selectedIds?: Iterable<string>;
  /** Selected rows on first render, when uncontrolled. */
  defaultSelectedIds?: Iterable<string>;
  /** The whole set an activation would produce, when it differs. */
  onSelectionChange?(ids: Set<string>): void;

  /** A row was activated — click, Enter or Space — with the modifiers held. */
  onAction?(id: string, mods: PressModifiers): void;
  /** A key pressed on a row itself, ahead of the tree's own keys: `preventDefault()` keeps the tree out. Keys on a
   *  row's controls do not reach it. */
  onRowKeyDown?(id: string, e: KeyboardEvent<HTMLElement>): void;
  /** A right-click on a row. The handler decides whether the browser's menu is blocked. */
  onRowContextMenu?(id: string, e: MouseEvent<HTMLElement>): void;

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
  /** Draw the dragged rows beside the pointer. Turn off while something outside the
   *  tree draws them where they would land. Default true. */
  ghost?: boolean;
  /**
   * A stand-in to draw beside the pointer in place of the dragged rows, asked on every move of a drag begun in
   * this tree: something that draws the rows as they will look where they are headed, say. `null` draws the rows.
   */
  renderGhost?(ids: readonly string[], where: TreeGhostWhere): TreeGhost | null;
  /**
   * A drag begun outside the tree, at this client point. The tree marks where
   * it would land, asking `canDrop` with no ids. The mark follows the pointer
   * a render behind it: ask `dropRef` where a point lands.
   */
  externalDrag?: { x: number; y: number } | null;
  /** Filled with the tree's answer to where a drop from outside lands at a point, for the moment of the drop. */
  dropRef?: Ref<TreeDropHandle>;
}

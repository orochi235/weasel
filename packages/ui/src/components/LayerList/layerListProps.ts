import type { MouseEvent, ReactNode } from 'react';

/** One layer: a row of the list, which can hold child layers. */
export interface LayerListItem {
  id: string;
  /** The layer's name. Also what its controls are labeled by, and what type-ahead matches. */
  label: string;
  /** Shown in the row in place of `label`. */
  title?: ReactNode;
  /** Fixed-size content before the label: a color swatch, a kind icon. */
  leading?: ReactNode;
  /** Cannot be dragged, hidden, locked, renamed or removed, is a wall no drop
   *  crosses, and selects alone rather than joining a multi-selection: a page's background. */
  fixed?: boolean;
  /** The layer's content is locked: shown pressed by the lock toggle when the
   *  list has `onLockChange`. A locked layer can still be hidden and unlocked,
   *  but not dragged, renamed, removed or dropped into. Default false. */
  locked?: boolean;
  /** Shown or not, when the list has `onVisibilityChange`. Default true. */
  visible?: boolean;
  children?: LayerListItem[];
  /** Not printed: an annotation — a measurement, a note — rather than
   *  content. Drawn dimmed, with a marker. */
  nonPrinting?: boolean;
  /** Whether the row offers a visibility checkbox, when the list has
   *  `onVisibilityChange`. Default true. */
  hideable?: boolean;
  /** Whether the row can be renamed, when the list has `onRename`. Default true. */
  renamable?: boolean;
  /** Whether the row offers a remove button, when the list has `onRemove`.
   *  Default true. */
  removable?: boolean;
  /** Folds the children away until the user opens them. `collapsedIds` overrides it. */
  defaultCollapsed?: boolean;
}

/**
 * A move: `ids`, in list order, now sit as one block under `parentId` (`null` at the top level), starting at `index`
 * of its children counted without them. A drag or a keyboard move can take layers to another parent.
 */
export interface LayerMove {
  ids: string[];
  parentId: string | null;
  index: number;
}

/** Props for `<LayerList>`. */
export interface LayerListProps {
  items: LayerListItem[];
  /** Omit for a list the user cannot reorder. */
  onReorder?: (move: LayerMove) => void;
  /** Refuse a move, by drag or by keyboard. A move across a fixed row, into a
   *  locked one, or into its own rows is refused regardless. */
  canMove?: (move: LayerMove) => boolean;
  /** Giving both makes rows selectable: a click selects one, Cmd/Ctrl-click adds
   *  or removes one, shift-click selects every row from the last click to this
   *  one, and dragging a selected row drags the whole selection. */
  selectedIds?: readonly string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Adds a visibility checkbox to every layer that is not fixed. */
  onVisibilityChange?: (id: string, visible: boolean) => void;
  /** Adds a lock toggle to every layer that is not fixed. */
  onLockChange?: (id: string, locked: boolean) => void;
  /** Lets a row be renamed: a double-click on its label, or F2 on the focused
   *  row, opens a field; Enter or leaving it reports the new name, Escape drops it. */
  onRename?: (id: string, label: string) => void;
  /** Adds a remove button to every layer that is neither fixed nor locked. */
  onRemove?: (id: string) => void;
  /** A right-click on a row. Select the row here if it should be; the
   *  handler decides whether the browser menu is blocked. */
  onRowContextMenu?: (id: string, e: MouseEvent) => void;
  /** Ids whose children are folded away. Giving it makes folding
   *  controlled; `onCollapsedChange` fires either way. */
  collapsedIds?: readonly string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** Heading above the list. */
  title?: string;
  /** Names the list for assistive tech when it has no `title`. */
  label?: string;
  /** Kinds the user can add, as buttons beside the title. Shown only with `onAdd`. */
  addKinds?: string[];
  onAdd?: (kind: string) => void;
  /** Shown in place of the list when `items` is empty. */
  empty?: ReactNode;
  /** Appended to the root's class list — the module's own names are hashed. */
  className?: string;
}

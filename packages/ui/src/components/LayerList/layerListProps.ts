import type { MouseEvent, ReactNode } from 'react';
import type { StanceProps } from '../stance';

/** One layer. With a body (see `renderBody`) it draws as a card that folds its
 *  body away; without one, as a one-line row. Either can hold child layers. */
export interface LayerListItem {
  id: string;
  /** The layer's name. Also what its controls are labeled by. */
  label: string;
  /** Shown in the header in place of `label` — a select that switches the
   *  layer's kind, say. */
  title?: ReactNode;
  /** Fixed-size content before the label: a color swatch, a kind icon. */
  leading?: ReactNode;
  /** Drawn in the drag handle in place of the grip — an ordinal. */
  badge?: ReactNode;
  /** Which of its list this layer is: an index into the theme's tone list, or
   *  a color. A card draws its edge and handle in it and recolors its controls. */
  tone?: StanceProps['tone'];
  /** Cannot be dragged, hidden or removed, walls off drops on either side, and
   *  selects alone rather than joining a multi-selection. */
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
  /** Whether the row offers a remove button, when the list has `onRemove`.
   *  Default true. */
  removable?: boolean;
  /** Folds the body and children away until the user opens them.
   *  `collapsedIds` overrides it. */
  defaultCollapsed?: boolean;
}

/**
 * A reorder: `ids`, siblings under `parentId` (`null` at the top level), now
 * sit as one block in list order starting at `index` of the parent's children.
 * A drag never moves a layer to another parent.
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
  /** Giving both makes rows selectable: a click selects one, Cmd/Ctrl-click adds
   *  or removes one, shift-click selects every row from the last click to this
   *  one, and dragging a selected row drags its selected siblings. */
  selectedIds?: readonly string[];
  onSelect?: (ids: string[]) => void;
  /** Adds a visibility checkbox to every unlocked layer. */
  onVisibilityChange?: (id: string, visible: boolean) => void;
  /** Adds a remove button to every unlocked layer. */
  onRemove?: (id: string) => void;
  /** A right-click on a row. Select the row here if it should be; the
   *  handler decides whether the browser menu is blocked. */
  onRowContextMenu?: (id: string, e: MouseEvent) => void;
  /** A layer's controls. Returning `null` leaves that layer a one-line row. */
  renderBody?: (item: LayerListItem) => ReactNode;
  /** Ids whose body and children are folded away. Giving it makes folding
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

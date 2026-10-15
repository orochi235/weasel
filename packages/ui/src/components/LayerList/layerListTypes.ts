import type { ReactNode } from 'react';
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

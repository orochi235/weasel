import type { ReactNode } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import type { LiveControl } from './commitPolicy';
import type { EntryAt } from './entry';
import type { PrefFieldChoice } from './schema';

/** What a {@link PrefRenderer} is given for the leaf it is rendering. */
export interface PrefRenderContext {
  /** Dotted path of the leaf within the schema root. */
  path: string;
  /** The schema node. App renderers narrow this to their own kind shape. */
  pref: PrefLeaf;
  /** Current value: `values` at `path` as `prefLeafValue` shows it. */
  value: unknown;
  /** Everything the surface edits, from its root: a form's `values`, a control panel's `config`. What a row
   *  reads of another setting. */
  values?: unknown;
  /** The surface marks this leaf's row as changed: a renderer drawing its whole row passes it to `PropertyRow`. */
  changed?: boolean;
  /** The leaf stands for several values that disagree; `value` is undefined. */
  mixed?: boolean;
  setValue: (value: unknown) => void;
  /**
   * Writes a value an edit is passing through, a drag's every move, where the surface keeps drafts apart: the
   * surface records the drafts and the `setValue` that settles them as one step, however long the edit pauses.
   * Absent, the surface keeps none, and a renderer sends each value through `setValue`.
   */
  draftValue?: (value: unknown) => void;
  /** Whether a path at or under this leaf's is in the form's `mixed`; with `below`, whether it or any path under it is. */
  mixedAt?: (path: string, below?: boolean) => boolean;
  /** Writes at a path under this leaf's, where `setValue` writes the leaf whole. */
  setValueAt?: (path: string, value: unknown) => void;
  /** Whether this leaf is currently auto — not pinned, computed by the owner. */
  auto: boolean;
  /** Toggle this leaf's auto state. */
  setAuto: (next: boolean) => void;
  /** The form's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
  /** The leaf takes no input: its `enableIf`, or that of a group above it, does not hold. A renderer draws its
   *  control disabled. */
  disabled?: boolean;
  /** Whether the field at a path under this leaf's is disabled by a condition of its own. */
  disabledAt?: (path: string) => boolean;
  /** An `action` leaf's `activeIf` holds: its button is drawn pressed. */
  active?: boolean;
  /** Whether the action at a path under this leaf's is drawn pressed. */
  activeAt?: (path: string) => boolean;
  /** The leaf is one a `showIf` hides, drawn because the form was given `markHidden`. */
  hidden?: boolean;
  /** Whether the field at a path under this leaf's is one a `showIf` hides, in a form given `markHidden`. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map under this leaf, as the conditions that read the entry leave it. */
  entryAt?: EntryAt;
  /** Which live controls write only the value an edit settles on, as the form's kit settings have it. Absent, the
   *  form's defaults. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** How long live text waits for the next keystroke before it is written, in ms, as the form's kit settings have
   *  it. Absent, every keystroke. */
  textWaitMs?: number;
  /** What is wrong with the value, where the surface has a message for this leaf. A renderer drawing its own
   *  `<PropertyRow>` hands it to the row's `error`. */
  error?: ReactNode;
}

/**
 * Renders the control cell for one preference leaf. Returning `null`
 * collapses the row.
 */
export type PrefRenderer = ((ctx: PrefRenderContext) => ReactNode) & {
  /** The control is several, or one a `<label>` may not wrap: its row is a group, and each control carries its own name.
   *  A function answers per leaf, for a renderer whose control follows the leaf's `control`. */
  group?: boolean | ((ctx: PrefRenderContext) => boolean);
  /** The control wants the row's whole width, its label above it, as a `map`'s or a `union`'s gets: for one too
   *  wide for the control column. In a field of an object leaf as in a row of the form. */
  wide?: boolean;
};

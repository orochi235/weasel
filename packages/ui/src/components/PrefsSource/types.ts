import type { ReactNode } from 'react';
import type { Paint } from '@weasel-js/core';
import type { LeafReading, PrefLeaf } from '@weasel-js/prefs';
import type { LiveControl } from '../Prefs/commitPolicy';
import type { EntryAt } from '../Prefs/entry';
import type { PrefFieldChoice } from '../Prefs/schema';
import type { PrefsSource } from './PrefsSource';

/** What the conditions over a path leave it: an `enableIf` that fails, a `showIf` that fails, an `activeIf` that holds. */
export interface LeafState {
  disabled: boolean;
  hidden: boolean;
  active: boolean;
}

/** How a write lands. `draft` is a value an edit passes through on its way to the one it settles on, as a
 *  slider's drag does: written, and kept out of undo, where the surface has a place for drafts. */
export interface WriteOptions {
  draft?: boolean;
}

/** What a fill or stroke would take from its container, and which of the selected nodes take it now. */
export interface PanelInherit {
  /** What inheriting paints: `null` for none, `undefined` where the nodes' containers paint differently. */
  paint: Paint | null | undefined;
  /** Per selected node, in selection order: whether its value is `'inherit'`. */
  each: readonly boolean[];
  /** Make every selected node's whole fill or stroke `'inherit'`. */
  set: () => void;
}

/** What a {@link LeafRenderer} is given for the leaf it draws, on any params surface. */
export interface LeafContext<T = unknown> extends LeafReading<T> {
  /** Dotted path of the leaf from the surface's root (`pose.x`, `view.grid`). */
  path: string;
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: PrefLeaf;
  /** Where the leaf is read from and written to: what a control reads of another setting goes through it. */
  source: PrefsSource;
  /** The leaf takes no input: its `enableIf`, or that of a group above it, does not hold. */
  disabled?: boolean;
  /** The leaf is one a `showIf` hides, drawn because the surface marks hidden leaves. */
  hidden?: boolean;
  /** An `action` leaf's `activeIf` holds: its button is drawn pressed. */
  active?: boolean;
  /** Write the leaf whole into every target. */
  setValue: (value: unknown) => void;
  /** Write at a path under this leaf's, where `setValue` writes the leaf whole. */
  setValueAt?: (path: string, value: unknown) => void;
  /** Write into every target a value derived from what it holds: see {@link PrefsSource.update}. */
  update: (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown) => void;
  /** `setValue` and `update` for the values an edit passes through, as a slider's drag does: kept out of undo,
   *  and the `setValue` or `update` that ends the edit records one step. Absent where the surface has no drafts. */
  drafts?: Pick<LeafContext, 'setValue' | 'update'>;
  /** Unpin the leaf or pin it; a no-op for one that cannot be auto here. */
  setAuto: (next: boolean) => void;
  /** Put the leaf back as its schema starts it. Absent while it already is. */
  reset?: () => void;
  /** Everything the surface edits, from its root: a form's `values`, a lab's `config`. Absent over a selection. */
  values?: unknown;
  /** True where the targets agree and what they agree on is nothing. A control must not show its default here:
   *  the next edit would write that invention back. */
  unset?: boolean;
  /** The fields of the object this leaf is a field of, where every target holds one and they agree. */
  siblings?: Record<string, unknown>;
  /** For a field of an object leaf, each target's own object, parallel to `each`. */
  eachSiblings?: readonly (Record<string, unknown> | undefined)[];
  /** Whether a path at or under this leaf's is mixed; with `below`, whether it or any path under it is. */
  mixedAt?: (path: string, below?: boolean) => boolean;
  /** Whether the field at a path under this leaf's is disabled by a condition of its own. */
  disabledAt?: (path: string) => boolean;
  /** Whether the action at a path under this leaf's is drawn pressed. */
  activeAt?: (path: string) => boolean;
  /** Whether the field at a path under this leaf's is one a `showIf` hides, on a surface that marks them. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map under this leaf, as the conditions that read the entry leave it. */
  entryAt?: EntryAt;
  /** The surface's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
  /** Which live controls write only the value an edit settles on. Absent, the surface's defaults. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** How long live text waits for the next keystroke before it is written, in ms. Absent, every keystroke. */
  textWaitMs?: number;
  /** The surface marks this leaf's row as changed: a renderer drawing its whole row passes it to `PropertyRow`. */
  changed?: boolean;
  /** What is wrong with the value: a renderer drawing its own `<PropertyRow>` hands it to the row's `error`. */
  error?: ReactNode;
  /** The ids of the nodes the values were read from, joined: a control holding scratch for one selection keys on
   *  it. Absent where the values come from no selection. */
  selectionKey?: string;
  /** For a node's fill or stroke, and the paint inside it, which can take its container's instead. */
  inherit?: PanelInherit;
}

/**
 * Draws one leaf on any params surface: its control, or for a row renderer the whole row. Returning `null`
 * collapses it.
 */
export type LeafRenderer = ((ctx: LeafContext) => ReactNode) & {
  /** The control is several, or one a `<label>` may not wrap: its row is a group, and each control carries its own
   *  name. A function answers per leaf. */
  group?: boolean | ((ctx: LeafContext) => boolean);
  /** The control wants the row's whole width, its label above it. */
  wide?: boolean;
};

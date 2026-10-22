import type { ReactNode } from 'react';
import type { Paint } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import type { LiveControl } from '../Prefs/commitPolicy';
import type { EntryAt } from '../Prefs/entry';
import type { PrefFieldChoice } from '../Prefs/schema';

/** What a {@link PropertyRenderer} is given for the property it is rendering. */
export interface PropertyRenderContext {
  /** Dotted node path of the leaf (`pose.x`, `data.fill`). */
  path: string;
  /** The panel's fields, which a `field` leaf names one of. */
  fields?: readonly PrefFieldChoice[];
  /** The schema leaf. App renderers narrow it to their own kind shape. */
  pref: PrefLeaf;
  /** Aggregated value across the selection; `undefined` when mixed or unset. */
  value: unknown;
  /** True when selected nodes disagree at this path. */
  mixed: boolean;
  /**
   * True when the nodes agree and what they agree on is nothing — the field
   * is absent, and whatever paints comes from a fallback further down.
   *
   * Distinct from `mixed`, and both leave `value` undefined. A control must
   * not substitute its schema default here: doing so shows a value the node
   * does not hold, and the next edit writes that invention back.
   */
  unset: boolean;
  /**
   * The fields of the object this leaf is a field of — `undefined` for a
   * top-level leaf, and for a field of an object the node does not hold.
   *
   * What a control needs when its own field doesn't carry the whole answer:
   * a stroke's dash lengths are multiples of the stroke's width, so reading
   * the array as a style takes both.
   */
  siblings?: Record<string, unknown>;
  /** The value each selected node holds at this path, in selection order —
   *  what `value` aggregates, and what a mixed selection still has. */
  each: readonly unknown[];
  /**
   * For a field of an object leaf, each node's own object (parallel to
   * `each`), which is still there when the nodes' objects differ and
   * `siblings` is not.
   */
  eachSiblings?: readonly (Record<string, unknown> | undefined)[];
  /** Commit a value — fans out to every selected node in one undo step. */
  setValue: (value: unknown) => void;
  /**
   * Commit a value derived from what each node holds at this path, in one undo
   * step. What `setValue` cannot do across a selection whose nodes differ: a
   * field of an object leaf has to land in each node's own object, not in one
   * object written over all of them. `siblings` is that node's object, for a
   * field of an object leaf.
   */
  update: (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown) => void;
  /**
   * `setValue` and `update` for the values a control passes through on the way
   * to the one its edit settles on, as a slider's drag does: each is written to
   * the nodes and kept out of undo, and the `setValue` or `update` that ends
   * the edit records one step from where the nodes were before the first.
   * Absent where the surface has no such write.
   */
  drafts?: Pick<PropertyRenderContext, 'setValue' | 'update'>;
  /**
   * The aggregated value at another node path — what `value` and `mixed` are
   * for this leaf's own path, for any path.
   *
   * A control whose subject spans more than one field needs it: a font picker
   * reporting which variant will actually paint has to read the node's weight
   * and style. Reading it off `value` is impossible — a leaf is handed one
   * field.
   */
  valueAt: (path: string) => { value: unknown; mixed: boolean };
  /**
   * The ids of the nodes the values were read from, joined. It changes exactly
   * when the selection does, so a control holding scratch that belongs to one
   * selection can key on it and be remounted rather than carry it to the next.
   * Absent where the values come from no selection, as in a tool options bar.
   */
  selectionKey?: string;
  /** The leaf takes no input: its `enableIf`, or that of a section above it, does not hold. A renderer draws its
   *  control disabled. */
  disabled?: boolean;
  /** Whether the field at a path under this leaf's is disabled by a condition of its own. */
  disabledAt?: (path: string) => boolean;
  /** The leaf is one a `showIf` hides, drawn because the panel was given `markHidden`. */
  hidden?: boolean;
  /** Whether the field at a path under this leaf's is one a `showIf` hides, in a panel given `markHidden`. */
  hiddenAt?: (path: string) => boolean;
  /** An entry of a list or a map under this leaf, as the conditions that read the entry leave it. */
  entryAt?: EntryAt;
  /** Which live controls write only the value an edit settles on, as the panel's kit settings have it. Absent, the
   *  panel's defaults. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** For a node's fill or stroke, and the paint inside it, which can take the
   *  enclosing container's instead: see {@link PanelInherit}. Absent for any
   *  other leaf, and for a selection holding a node with no container. */
  inherit?: PanelInherit;
}

/** What a fill or stroke would take from its container, and which of the
 *  selected nodes take it now. */
export interface PanelInherit {
  /** What inheriting paints: `null` for none, `undefined` where the nodes'
   *  containers paint differently. */
  paint: Paint | null | undefined;
  /** Per selected node, in selection order: whether its value is `'inherit'`. */
  each: readonly boolean[];
  /** Make every selected node's whole fill or stroke `'inherit'`. */
  set: () => void;
}

/**
 * Renders the control for one property across the whole selection.
 * Returning `null` collapses the leaf.
 */
export type PropertyRenderer = (ctx: PropertyRenderContext) => ReactNode;

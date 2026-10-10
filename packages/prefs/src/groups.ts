// The two branch nodes of a schema. They differ in whether a key is part of
// the path a leaf's value lives at, and each holds its members under its own
// property, so a schema of one kind is neither assignable to nor walkable as
// the other.

import type { PrefLeaf } from './schema';

/**
 * How a {@link PrefGroup} is drawn: `page` gets an entry in a form's rail and
 * a pane of its own; `tab` shares a tab strip with the `tab` groups beside it;
 * `panel` is a bordered, titled box; `section` is a heading over its rows.
 */
export type PrefGroupAs = 'page' | 'tab' | 'panel' | 'section';

/** How a {@link PrefSection} is drawn. */
export type PrefSectionAs = Exclude<PrefGroupAs, 'page'>;

/**
 * A group whose key is a path segment: `view` > `gridDensity` is the leaf at
 * `view.gridDensity`, and its value nests the same way. The shape of a
 * preferences schema — what `openPrefs` stores, `PrefsForm` renders, and a
 * tool declares its options as. A key holds no `.`.
 */
export interface PrefGroup {
  /** Heading for the group's rows. **Empty means no heading** — for a group
   *  that exists to organize, not to name: one whose children are themselves
   *  groups carrying the labels a reader needs. Give it a name whenever the
   *  name is the referent (a `Border` group over `Top` / `Right` / `Bottom`
   *  reads as nothing without it). */
  name: string;
  description?: string;
  /** How the group is drawn. Unset, its depth decides: a top-level group is a
   *  `page`, and one inside another is a `section`. */
  as?: PrefGroupAs;
  children: Record<string, PrefLeaf | PrefGroup>;
}

/**
 * A heading over leaves that adds nothing to their paths: each member is
 * addressed by its own key alone, and the section's key only identifies the
 * section. The shape of a node's property schema, where a leaf's key is the
 * whole dotted node path (`pose.x`, `data.fill`), and of the headings inside
 * a {@link PrefObject}, where a key is relative to the object.
 */
export interface PrefSection {
  /** Heading for the section's rows. Empty means no heading, as for a
   *  {@link PrefGroup}. */
  name: string;
  description?: string;
  /** How the section is drawn, as a {@link PrefGroup}'s `as` — without
   *  `page`, since nothing that draws sections has a rail. Unset: a heading
   *  over its rows. */
  as?: PrefSectionAs;
  members: Record<string, PrefLeaf | PrefSection>;
}

/** Whether a top-level group gets a page of its own, and not a place on the page of the root's own leaves. */
export function prefGroupIsPage(group: PrefGroup): boolean {
  return group.as === undefined || group.as === 'page';
}

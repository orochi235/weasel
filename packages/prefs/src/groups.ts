// The two branch nodes of a schema. They differ in whether a key is part of
// the path a leaf's value lives at, and each holds its members under its own
// property, so a schema of one kind is neither assignable to nor walkable as
// the other.

import type { PrefLeaf } from './schema';

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
  members: Record<string, PrefLeaf | PrefSection>;
}

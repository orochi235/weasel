// The two branch nodes of a schema. They differ in whether a key is part of
// the path a leaf's value lives at, and each holds its members under its own
// property, so a schema of one kind is neither assignable to nor walkable as
// the other.

import type { PrefCondition } from './condition';
import type { PrefLeaf } from './schema';

/**
 * How a {@link PrefGroup} is drawn: `page` gets an entry in a form's rail and
 * a pane of its own; `tab` shares a tab strip with the `tab` groups beside it;
 * `panel` is a bordered, titled box; `section` is a heading over its rows;
 * `fragment` draws nothing of its own, so its rows sit among its neighbors'
 * as though they were written there. A fragment exists to hold things
 * together: one key for their values to nest under, one node to move.
 * `bar` puts its prefs on one line in their bar forms. `menu` is drawn as
 * a menu wherever a menu fits: on a bar, a button opening its contents as a
 * menu; in a menu, a submenu; in a panel, a titled box as `panel` is.
 */
export type PrefGroupAs = 'page' | 'tab' | 'panel' | 'section' | 'fragment' | 'bar' | 'menu';

/**
 * What a group or a section drawn `as: 'bar'` does with cells its line has no
 * room for: `scroll` keeps them all on it, and `menu` opens the ones past its
 * end from a button there. A bar set to `menu` takes all the room its host
 * has along the line, which is why it is asked for and not the default.
 */
export type PrefBarOverflow = 'scroll' | 'menu';

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
  /** Tags every leaf under the group carries besides its own. A settings
   *  search matching one keeps the whole group, as matching its name does. */
  tags?: readonly string[];
  /** How the group is drawn. Unset, its depth decides: a top-level group is a
   *  `page`, and one inside another is a `section`. */
  as?: PrefGroupAs;
  /** Drawn `as: 'bar'`: what happens to the cells its line has no room for.
   *  Unset: `scroll`. A surface that takes drops keeps every cell on the line
   *  whatever this says, so each is there to drop beside. */
  overflow?: PrefBarOverflow;
  /** Drawn, with everything under it, only while this holds. */
  showIf?: PrefCondition;
  /** Everything under it is disabled while this does not hold. */
  enableIf?: PrefCondition;
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
  /** As a {@link PrefGroup}'s. */
  tags?: readonly string[];
  /** How the section is drawn, as a {@link PrefGroup}'s `as` — without
   *  `page`, since nothing that draws sections has a rail. Unset: a heading
   *  over its rows. */
  as?: PrefSectionAs;
  /** As a {@link PrefGroup}'s. */
  overflow?: PrefBarOverflow;
  /** As a {@link PrefGroup}'s. */
  showIf?: PrefCondition;
  /** As a {@link PrefGroup}'s. */
  enableIf?: PrefCondition;
  members: Record<string, PrefLeaf | PrefSection>;
}

/** Whether a panel draws a group or a section drawn `as` this in a bordered, titled box: a `panel`, and a `menu`,
 *  which a panel has no menu to open as. */
export function prefAsBox(as: PrefGroupAs | undefined): boolean {
  return as === 'panel' || as === 'menu';
}

/** Whether a top-level group gets a page of its own, and not a place on the page of the root's own leaves. */
export function prefGroupIsPage(group: PrefGroup): boolean {
  return group.as === undefined || group.as === 'page';
}

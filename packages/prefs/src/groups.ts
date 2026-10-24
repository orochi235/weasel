// The two branch nodes of a schema. They differ in whether a key is part of
// the path a leaf's value lives at, and each holds its members under its own
// property, so a schema of one kind is neither assignable to nor walkable as
// the other.

import type { IconRef } from '@weasel-js/icons';
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
 * end from a button there. A bar set to `menu` asks for its natural length,
 * its lead and every cell, sits at that length where its row is sized to its
 * content, opens the menu only once squeezed shorter, and takes cells back as
 * room returns.
 */
export type PrefBarOverflow = 'scroll' | 'menu';

/** What a bar's line starts with, ahead of its cells: `label` puts the bar's name there, and `icon` its `icon`. */
export type PrefBarLead = 'label' | 'icon';

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
  /** Drawn `as: 'bar'`: what its line starts with. Unset: its first cell. */
  lead?: PrefBarLead;
  /** Glyph naming the group, as a leaf's `icon` names the leaf. A bar drawn
   *  with `lead: 'icon'` starts its line with it; the button a bar opens the
   *  group from and its submenu row in a menu carry it beside its name. */
  icon?: IconRef;
  /** The letter that picks this in a menu, and with the menu bar's chord opens a top-level menu. One character; supported, never required. */
  access?: string;
  /** Drawn, with everything under it, only while this holds. */
  showIf?: PrefCondition;
  /** Everything under it is disabled while this does not hold, except a leaf directly in it that this reads: that
   *  leaf is the group's switch, often the one marked `heading`, and stays live so the group can be turned back on. */
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
  lead?: PrefBarLead;
  /** As a {@link PrefGroup}'s. */
  icon?: IconRef;
  /** As a {@link PrefGroup}'s. */
  access?: string;
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

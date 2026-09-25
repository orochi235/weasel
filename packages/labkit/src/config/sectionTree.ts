import { isPrefLeaf, type PrefGroup } from '@weasel-js/ui';
import { valueAtPath } from './path';
import type { ResolvedConfig } from './types';
import { isLeafVisible } from './visible';

/**
 * A resolved schema rearranged so its sections are groups.
 *
 * `PrefsForm`'s rail navigates the schema tree — top-level groups are its
 * items, their group children indent under them. A resolved schema keeps its
 * sections beside the tree instead, so a flat schema's rail comes out as one
 * unnamed item however many headings the panel draws. This puts the sections
 * where the rail looks for them.
 */
export interface SectionTree {
  /** The rail's schema. Top-level children are the schema's root sections,
   *  followed by any root node no section claimed. */
  group: PrefGroup;
  /** `config` renested to mirror `group` — the value tree `PrefsForm` takes. */
  values: Record<string, unknown>;
  /** The config path a path within `group` stands for. */
  pathAt: (railPath: string) => string;
}

/** A section label as an object key: no dots, since a dotted path is how every
 *  caller addresses a node, and a label is free to hold one. */
function slugOf(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A subtree with everything `showIf` or `hidden` rules out cut away, or null
 *  when that is all of it. A group whose children all went is not a rail item
 *  the reader can open onto nothing. */
function prune(
  resolved: ResolvedConfig,
  group: PrefGroup,
  at: string,
  config: Record<string, unknown>,
  showHidden: boolean,
): PrefGroup | null {
  const children: PrefGroup['children'] = {};
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    if (!isLeafVisible(resolved, path, config, showHidden)) continue;
    if (isPrefLeaf(child)) {
      children[key] = child;
      continue;
    }
    const kept = prune(resolved, child, path, config, showHidden);
    if (kept) children[key] = kept;
  }
  return Object.keys(children).length === 0 ? null : { ...group, children };
}

/**
 * Turn a resolved schema's root sections into the top level of a `PrefGroup`,
 * for `PrefsForm`'s rail layout.
 *
 * A section naming a group brings that group in whole, so it lands as an
 * indented rail item; a section naming a leaf drops it loose into the
 * section's own pane. Sections nested under a group are left alone — they
 * bucket rows inside a pane, which is the panel's job and not the rail's.
 */
export function sectionTree(
  resolved: ResolvedConfig,
  config: Record<string, unknown>,
  showHidden = false,
): SectionTree {
  const children: PrefGroup['children'] = {};
  const values: Record<string, unknown> = {};
  const slugs = new Set<string>();
  const claimed = new Set<string>();

  for (const section of resolved.sections) {
    if (section.at !== '') continue;
    const kept: PrefGroup['children'] = {};
    const held: Record<string, unknown> = {};
    for (const path of section.paths) {
      claimed.add(path);
      const child = resolved.group.children[path];
      if (!child || !isLeafVisible(resolved, path, config, showHidden)) continue;
      if (isPrefLeaf(child)) {
        kept[path] = child;
      } else {
        const subtree = prune(resolved, child, path, config, showHidden);
        if (!subtree) continue;
        kept[path] = subtree;
      }
      held[path] = valueAtPath(config, path);
    }
    if (Object.keys(kept).length === 0) continue;
    const slug = slugOf(section.label, slugs);
    slugs.add(slug);
    children[slug] = { name: section.label, children: kept };
    values[slug] = held;
  }

  // Whatever no section claimed stays at the top level, where `prefRailItems`
  // gathers loose leaves into one item named for the root.
  for (const [key, child] of Object.entries(resolved.group.children)) {
    if (claimed.has(key) || !isLeafVisible(resolved, key, config, showHidden)) continue;
    if (isPrefLeaf(child)) {
      children[key] = child;
    } else {
      const subtree = prune(resolved, child, key, config, showHidden);
      if (!subtree) continue;
      children[key] = subtree;
    }
    values[key] = valueAtPath(config, key);
  }

  return {
    group: { name: resolved.group.name, children },
    values,
    pathAt: (railPath) => {
      const cut = railPath.indexOf('.');
      const head = cut === -1 ? railPath : railPath.slice(0, cut);
      if (!slugs.has(head)) return railPath;
      return cut === -1 ? '' : railPath.slice(cut + 1);
    },
  };
}

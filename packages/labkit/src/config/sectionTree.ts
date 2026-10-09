import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
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

/** Structural rather than `isPrefLeaf`, so the config entry stays free of a
 *  runtime import from ui. */
function isLeaf(node: PrefLeaf | PrefGroup): node is PrefLeaf {
  return 'kind' in node;
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
 *  when that is all of it, with `config` renested to match. A group whose
 *  children all went is not a rail item the reader can open onto nothing.
 *
 *  A section declared inside the group becomes a group of its own there,
 *  which a pane draws as a headed subsection; its slug goes in `nested` under
 *  the group's config path, so `pathAt` can skip it. */
function prune(
  resolved: ResolvedConfig,
  group: PrefGroup,
  at: string,
  config: Record<string, unknown>,
  showHidden: boolean,
  nested: Set<string>,
): { group: PrefGroup; values: Record<string, unknown> } | null {
  const children: PrefGroup['children'] = {};
  const values: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    if (!isLeafVisible(resolved, path, config, showHidden)) continue;
    if (isLeaf(child)) {
      children[key] = child;
      values[key] = valueAtPath(config, path);
      continue;
    }
    const kept = prune(resolved, child, path, config, showHidden, nested);
    if (!kept) continue;
    children[key] = kept.group;
    values[key] = kept.values;
  }
  const taken = new Set(Object.keys(children));
  for (const section of resolved.sections) {
    if (section.at !== at || at === '') continue;
    const keys = section.paths.map((p) => p.slice(at.length + 1)).filter((k) => k in children);
    if (keys.length === 0) continue;
    const slug = slugOf(section.label, taken);
    taken.add(slug);
    nested.add(`${at}|${slug}`);
    // In place of its first member, so the subsection keeps the schema's order.
    const sectionChildren: PrefGroup['children'] = {};
    const sectionValues: Record<string, unknown> = {};
    for (const k of keys) {
      sectionChildren[k] = children[k] as PrefGroup['children'][string];
      sectionValues[k] = values[k];
    }
    const reordered: PrefGroup['children'] = {};
    const revalued: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(children)) {
      if (k === keys[0]) {
        reordered[slug] = { name: section.label, children: sectionChildren };
        revalued[slug] = sectionValues;
      }
      if (keys.includes(k)) continue;
      reordered[k] = child;
      revalued[k] = values[k];
    }
    replace(children, reordered);
    replace(values, revalued);
  }
  return Object.keys(children).length === 0 ? null : { group: { ...group, children }, values };
}

function replace<V>(target: Record<string, V>, from: Record<string, V>): void {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, from);
}

/**
 * Turn a resolved schema's root sections into the top level of a `PrefGroup`,
 * for `PrefsForm`'s rail layout.
 *
 * A section naming a group brings that group in whole, so it lands as an
 * indented rail item; a section naming a leaf drops it loose into the
 * section's own pane. A section declared inside a group becomes a group
 * inside it, which the pane draws as a headed subsection.
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
  const nested = new Set<string>();

  for (const section of resolved.sections) {
    if (section.at !== '') continue;
    const kept: PrefGroup['children'] = {};
    const held: Record<string, unknown> = {};
    for (const path of section.paths) {
      claimed.add(path);
      const child = resolved.group.children[path];
      if (!child || !isLeafVisible(resolved, path, config, showHidden)) continue;
      if (isLeaf(child)) {
        kept[path] = child;
        held[path] = valueAtPath(config, path);
      } else {
        const subtree = prune(resolved, child, path, config, showHidden, nested);
        if (!subtree) continue;
        kept[path] = subtree.group;
        held[path] = subtree.values;
      }
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
    if (isLeaf(child)) {
      children[key] = child;
      values[key] = valueAtPath(config, key);
    } else {
      const subtree = prune(resolved, child, key, config, showHidden, nested);
      if (!subtree) continue;
      children[key] = subtree.group;
      values[key] = subtree.values;
    }
  }

  return {
    group: { name: resolved.group.name, children },
    values,
    pathAt: (railPath) => {
      const segs = railPath.split('.');
      const out: string[] = [];
      for (const [i, seg] of segs.entries()) {
        if (i === 0 && slugs.has(seg)) continue;
        if (nested.has(`${out.join('.')}|${seg}`)) continue;
        out.push(seg);
      }
      return out.join('.');
    },
  };
}

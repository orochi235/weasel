import {
  isPrefLeaf,
  type PrefGroup,
  type PrefLeaf,
  type PrefObject,
  type PrefSection,
} from '@weasel-js/prefs';
import type { ResolvedConfig, SectionSpec } from './types';

/** What a section keeps that a `PrefSection` has no field for. */
const SECTION_EXTRAS = ['collapsed', 'layout', 'pack', 'className'] as const;

/** A section label as a member key no sibling holds. A section's key is no part of any path. */
function slugOf(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  taken.add(key);
  return key;
}

function sectionOf(spec: SectionSpec): PrefSection {
  const extras: Record<string, unknown> = {};
  for (const k of SECTION_EXTRAS) if (spec[k] !== undefined) extras[k] = spec[k];
  if (spec.motif !== undefined) extras.frame = spec.motif;
  return { name: spec.label, ...extras, members: {} } as PrefSection;
}

/** `out` with `extra`'s defined entries set on it. */
function withExtras<T extends object>(out: T, extra: Record<string, unknown>): T {
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

function leafOf(resolved: ResolvedConfig, leaf: PrefLeaf, path: string): PrefLeaf {
  return withExtras(
    { ...leaf },
    {
      render: resolved.renderers[path],
      dialog: resolved.dialogs[path],
      showWhen: resolved.showIf.get(path),
      enableWhen: resolved.enableIf?.get(path),
    },
  );
}

/** Every value under `members` as a record, which is the `default` an `object` leaf holds. */
function defaultsOf(members: PrefSection['members']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(members)) {
    if (isPrefLeaf(child)) out[key] = child.default;
    else Object.assign(out, defaultsOf(child.members));
  }
  return out;
}

function groupOf(resolved: ResolvedConfig, group: PrefGroup, path: string): PrefLeaf {
  const { children: _children, name, description, showIf, enableIf, as, overflow } = group;
  const children = membersOf(resolved, group, path);
  const leaf = withExtras(
    { kind: 'object', name, description: description ?? '', default: defaultsOf(children), children },
    { showIf, enableIf, showWhen: resolved.showIf.get(path), enableWhen: resolved.enableIf?.get(path) },
  );
  const look = withExtras(
    {},
    { as, overflow, resettable: resolved.resettable?.has(path) || undefined, motif: resolved.motifs?.get(path) },
  );
  return { ...(leaf as PrefObject), group: look } as PrefLeaf;
}

function membersOf(
  resolved: ResolvedConfig,
  group: PrefGroup,
  at: string,
): Record<string, PrefLeaf | PrefSection> {
  const out: Record<string, PrefLeaf | PrefSection> = {};
  const specs = resolved.sections.filter((s) => s.at === at);
  const taken = new Set(Object.keys(group.children));
  const opened = new Map<SectionSpec, PrefSection>();
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    const node = isPrefLeaf(child) ? leafOf(resolved, child, path) : groupOf(resolved, child, path);
    const spec = specs.find((s) => s.paths.includes(path));
    if (spec === undefined) {
      out[key] = node;
      continue;
    }
    let section = opened.get(spec);
    if (section === undefined) {
      section = sectionOf(spec);
      opened.set(spec, section);
      out[slugOf(spec.label, taken)] = section;
    }
    (section.members as Record<string, PrefLeaf | PrefSection>)[key] = node;
  }
  return out;
}

/**
 * A resolved config as a property schema, the shape `PrefSchemaEditor` opens and `f.prefs` reads back: each
 * section a `PrefSection` over the nodes it heads, each `f.group` an `object` leaf holding its children at the
 * paths they had. What a `PrefLeaf` has no field for rides on the node, where the editor keeps it and its export
 * prints it: a group's `as`, `overflow`, `resettable`, and motif under `group` (which is what marks the leaf a
 * group), a section's `collapsed`, `layout`, `pack`, `className`, and motif (as `frame`), and a node's `.render`,
 * `.dialog`, and the `.showIf` and `.enableIf` written as functions (as `render`, `dialog`, `showWhen`, and
 * `enableWhen`).
 */
export function prefsFromConfig(resolved: ResolvedConfig): PrefSection {
  return { name: resolved.group.name, members: membersOf(resolved, resolved.group, '') };
}

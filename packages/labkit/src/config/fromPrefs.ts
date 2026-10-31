import {
  isPrefLeaf,
  type PrefCondition,
  type PrefLeaf,
  type PrefObject,
  type PrefSection,
  prefConditionPaths,
} from '@weasel-js/prefs';
import { withValueAtPath } from './path';
import type {
  Annotations,
  BranchAnnotations,
  BranchOptions,
  ConfigBranch,
  ConfigEntry,
  ConfigNode,
  ConfigSchema,
  ConfigShape,
  NodeOptions,
  SectionOption,
} from './types';

type OpenShape = Record<string, ConfigEntry>;

const encoded = (leaf: PrefLeaf): boolean =>
  (leaf as { encoding?: unknown }).encoding !== undefined;

/** The options `prefsFromConfig` put on a node beside its prefs fields, and those fields without them. */
function optionsOn(node: Record<string, unknown>): [Record<string, unknown>, NodeOptions] {
  const { render, dialog, showWhen, enableWhen, autoResolve, ...rest } = node;
  const options: Record<string, unknown> = { render, dialog, showIf: showWhen, enableIf: enableWhen, autoResolve };
  for (const k of Object.keys(options)) if (options[k] === undefined) delete options[k];
  return [rest, options as NodeOptions];
}

function nodeOf(leaf: PrefLeaf, given: NodeOptions): ConfigNode {
  const [fields, own] = optionsOn(leaf as unknown as Record<string, unknown>);
  const { kind, default: def, ...annotations } = fields as PrefLeaf & Record<string, unknown>;
  return { kind, default: def, annotations: annotations as Annotations, options: { ...given, ...own } };
}

/** What `prefsFromConfig` marks a group's `object` leaf with: the branch fields a leaf has none for. */
interface GroupLook {
  as?: BranchAnnotations['as'];
  overflow?: BranchAnnotations['overflow'];
  resettable?: boolean;
  motif?: BranchOptions['motif'];
}

const lookOf = (leaf: PrefLeaf): GroupLook | undefined => {
  const { group } = leaf as { group?: unknown };
  return leaf.kind === 'object' && typeof group === 'object' && group !== null ? (group as GroupLook) : undefined;
};

/** A section's heading, with what `prefsFromConfig` kept of it beside its prefs fields. */
function sectionOption(section: PrefSection): SectionOption {
  const { collapsed, layout, pack, className, frame } = section as PrefSection & Omit<SectionOption, 'label' | 'motif'> & { frame?: SectionOption['motif'] };
  const out: Record<string, unknown> = { label: section.name, collapsed, layout, pack, className, motif: frame };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as unknown as SectionOption;
}

type Conditions = { showIf: readonly PrefCondition[]; enableIf: readonly PrefCondition[] };

const NONE: Conditions = { showIf: [], enableIf: [] };

/** `leaf` answering to the conditions of the sections above it as well as its own, each kind folded into one. */
function conditioned(leaf: PrefLeaf, above: Conditions): PrefLeaf {
  const out = { ...leaf };
  for (const field of ['showIf', 'enableIf'] as const) {
    const all = leaf[field] === undefined ? above[field] : [...above[field], leaf[field]];
    if (all.length > 0) out[field] = all.length === 1 ? all[0] : { all };
  }
  return out;
}

/** Each leaf in `section` at its path, under its own and every enclosing section's `showIf` and `enableIf`. A
 *  section's `enableIf` passes over a leaf directly in it that the condition reads: that leaf is its switch. */
function sectionLeaves(section: PrefSection, above: Conditions): Array<[string, PrefLeaf]> {
  const { showIf, enableIf } = section;
  const reads = enableIf === undefined ? [] : prefConditionPaths(enableIf);
  const within: Conditions = {
    showIf: showIf === undefined ? above.showIf : [...above.showIf, showIf],
    enableIf: enableIf === undefined ? above.enableIf : [...above.enableIf, enableIf],
  };
  return Object.entries(section.members).flatMap(([key, child]): Array<[string, PrefLeaf]> => {
    if (!isPrefLeaf(child)) return sectionLeaves(child, within);
    const sits = reads.includes(key) ? { ...within, enableIf: above.enableIf } : within;
    return [[key, conditioned(child, sits)]];
  });
}

/** Puts `node` at `path` in `root`, each segment before its last a branch no group of the schema named. */
function place(root: OpenShape, path: string, node: ConfigEntry): void {
  const segments = path.split('.');
  const last = segments.pop()!;
  let shape = root;
  for (const segment of segments) {
    let branch = shape[segment] as ConfigBranch | undefined;
    if (branch === undefined || !('children' in branch)) {
      branch = { children: {}, annotations: { name: '' }, options: {} };
      shape[segment] = branch;
    }
    shape = branch.children as OpenShape;
  }
  shape[last] = node;
}

/** A group's `object` leaf as the branch it was, its children at `path` below it. */
function branchOf(
  leaf: PrefObject,
  look: GroupLook,
  given: NodeOptions,
  path: string,
  leaves: Array<[string, PrefLeaf]>,
): ConfigBranch {
  const [fields, own] = optionsOn(leaf as unknown as Record<string, unknown>);
  const { name, description, showIf, enableIf } = fields as unknown as PrefObject;
  const annotations: Record<string, unknown> = { name, description: description || undefined, showIf, enableIf, as: look.as, overflow: look.overflow };
  for (const k of Object.keys(annotations)) if (annotations[k] === undefined) delete annotations[k];
  const options: BranchOptions = { ...given, ...own };
  if (look.resettable) options.resettable = true;
  if (look.motif !== undefined) options.motif = look.motif;
  return { children: shapeOf(leaf.children, path, leaves), annotations, options };
}

/** `members` as a config shape, each key under `at`: whole dotted paths at the top, a key relative to its group's
 *  `object` leaf below it. Each leaf holding a value goes in `leaves` at its path. */
function shapeOf(members: PrefSection['members'], at: string, leaves: Array<[string, PrefLeaf]>): OpenShape {
  const shape: OpenShape = {};
  const add = (key: string, leaf: PrefLeaf, options: NodeOptions): void => {
    const path = at === '' ? key : `${at}.${key}`;
    const look = lookOf(leaf);
    if (look) return place(shape, key, branchOf(leaf as PrefObject, look, options, path, leaves));
    place(shape, key, nodeOf(leaf, options));
    leaves.push([path, leaf]);
  };
  for (const [key, child] of Object.entries(members)) {
    if (isPrefLeaf(child)) {
      add(key, child, {});
      continue;
    }
    const options: NodeOptions = child.name === '' ? {} : { section: sectionOption(child) };
    for (const [k, leaf] of sectionLeaves(child, NONE)) add(k, leaf, options);
  }
  return shape;
}

/**
 * A property schema as an instrument's `config`: each leaf at the dotted path
 * its key names, which is where the config holds its value, and each named
 * section of the schema's top level a heading over the leaves in it. A
 * section nested in another heads nothing of its own, and one whose leaves
 * sit under different paths heads each run of them where it sits.
 * A section's `showIf` and `enableIf`, at any depth, land on each leaf in it,
 * as a `PrefsForm` judges them, so the panel hides and disables those rows.
 *
 * The leaves keep everything they say, so a panel draws and writes them as a
 * `PrefsForm` would: a value in its stored unit, an option through its
 * `encoding`, an `object` leaf whole. `defaults()` holds every leaf's default
 * but an encoded one's, which it leaves absent.
 *
 * It reads back what `prefsFromConfig` writes: an `object` leaf marked
 * `group` is that group, its children keyed below it, and what that wrote
 * beside a node's or a section's prefs fields is its options again.
 */
export function configFromPrefs(schema: PrefSection): ConfigSchema<Record<string, unknown>> {
  const leaves: Array<[string, PrefLeaf]> = [];
  const nodes = shapeOf(schema.members, '', leaves);
  return {
    nodes: nodes as ConfigShape,
    // An encoded leaf's default is the option it reads as, not what is stored, and holding nothing reads as it.
    defaults: () =>
      leaves.reduce<Record<string, unknown>>(
        (config, [path, leaf]) =>
          encoded(leaf) ? config : withValueAtPath(config, path, leaf.default),
        {},
      ),
  };
}

import {
  isPrefLeaf,
  type PrefCondition,
  type PrefLeaf,
  type PrefSection,
  prefConditionPaths,
} from '@weasel-js/prefs';
import { withValueAtPath } from './path';
import type {
  Annotations,
  ConfigBranch,
  ConfigEntry,
  ConfigNode,
  ConfigSchema,
  ConfigShape,
  NodeOptions,
} from './types';

type OpenShape = Record<string, ConfigEntry>;

const encoded = (leaf: PrefLeaf): boolean =>
  (leaf as { encoding?: unknown }).encoding !== undefined;

function nodeOf(leaf: PrefLeaf, options: NodeOptions): ConfigNode {
  const { kind, default: def, ...annotations } = leaf as PrefLeaf & Record<string, unknown>;
  return { kind, default: def, annotations: annotations as Annotations, options };
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
function place(root: OpenShape, path: string, node: ConfigNode): void {
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
 */
export function configFromPrefs(schema: PrefSection): ConfigSchema<Record<string, unknown>> {
  const nodes: OpenShape = {};
  const leaves: Array<[string, PrefLeaf]> = [];
  for (const [key, child] of Object.entries(schema.members)) {
    if (isPrefLeaf(child)) {
      place(nodes, key, nodeOf(child, {}));
      leaves.push([key, child]);
      continue;
    }
    const options: NodeOptions = child.name === '' ? {} : { section: { label: child.name } };
    for (const [path, leaf] of sectionLeaves(child, NONE)) {
      place(nodes, path, nodeOf(leaf, options));
      leaves.push([path, leaf]);
    }
  }
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

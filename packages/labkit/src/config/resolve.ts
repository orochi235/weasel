import {
  checkPrefConditions,
  type PrefAuto,
  type PrefGroup,
  type PrefLeaf,
  type PrefSchemaConditionProblem,
  type PrefSection,
} from '@weasel-js/prefs';
import { isDev } from '@weasel-js/react';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import { isConfigBranch } from './builder';
import { applyRules, builtinRules, titleCase } from './rules';
import type {
  ConfigEntry,
  ConfigPredicate,
  ConfigRule,
  ConfigSchema,
  ConfigShape,
  ControlRenderer,
  DialogSpec,
  LeafPatch,
  ResolvedConfig,
  SectionSpec,
} from './types';

/** Drop keys whose value is undefined, so an unset annotation stays a gap the
 *  rule chain can fill rather than a settled `undefined`. */
/** The `auto` a leaf's own fields gave it, where an object: a prefs leaf `fromPrefs` carried over. */
const ownAuto = (patch: LeafPatch): PrefAuto | undefined => {
  const { auto } = patch as { auto?: unknown };
  return typeof auto === 'object' && auto !== null ? (auto as PrefAuto) : undefined;
};

function defined(annotations: Record<string, unknown>): LeafPatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(annotations)) if (v !== undefined) out[k] = v;
  return out as LeafPatch;
}

/** What the walk collects on the side of the `PrefGroup` tree. */
interface Sink {
  sections: SectionSpec[];
  showIf: Map<string, ConfigPredicate>;
  enableIf: Map<string, ConfigPredicate>;
  renderers: Record<string, ControlRenderer>;
  dialogs: Record<string, DialogSpec>;
  resettable: Set<string>;
  motifs: Map<string, Motif>;
  chain: readonly ConfigRule[];
}

/**
 * Resolve a schema into the vocabulary weasel-ui renders, running each leaf
 * through the consumer's rules and then labkit's own.
 *
 * The group mirrors the schema's own nesting: an `f.group` becomes a nested
 * `PrefGroup`, so a leaf's dotted path within the tree is the path its value
 * is written at, and both `ControlPanel` and `PrefsForm` address it
 * identically.
 */
export function resolveConfigSchema<TC>(
  schema: ConfigSchema<TC>,
  rules: readonly ConfigRule[] = [],
  over?: PrefGroup | PrefSection,
): ResolvedConfig {
  const sink: Sink = {
    sections: [],
    showIf: new Map(),
    enableIf: new Map(),
    renderers: {},
    dialogs: {},
    resettable: new Set(),
    motifs: new Map(),
    chain: [...rules, ...builtinRules],
  };
  const group = resolveShape(schema.nodes, '', '', sink);
  const said = ({ field, at, problem }: PrefSchemaConditionProblem) =>
    `[labkit] ${field} of "${at}": ${problem}`;
  const drawnOver = over ?? schema.over;
  const problems = checkPrefConditions(group, drawnOver);
  // An enum's options can change under a condition written against them; a test of one it no
  // longer has never matches, and is no reason to take the whole panel down.
  const faults = problems.filter((p) => p.code !== 'option');
  if (faults.length > 0) throw new Error(faults.map(said).join('\n'));
  if (isDev()) for (const p of problems) if (p.code === 'option') console.warn(said(p));
  return {
    group,
    sections: sink.sections,
    showIf: sink.showIf,
    enableIf: sink.enableIf,
    renderers: sink.renderers,
    dialogs: sink.dialogs,
    resettable: sink.resettable,
    motifs: sink.motifs,
    ...(drawnOver === undefined ? {} : { over: drawnOver }),
  };
}

/** A section while it is still being filled. */
type OpenSection = Omit<SectionSpec, 'paths'> & { paths: string[] };

function resolveShape(shape: ConfigShape, at: string, name: string, sink: Sink): PrefGroup {
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  const sections = new Map<string, OpenSection>();

  for (const [key, entry] of Object.entries(shape)) {
    const path = at === '' ? key : `${at}.${key}`;
    children[key] = resolveEntry(entry, key, path, sink);

    const { section, showIf: predicate, enableIf } = entry.options;
    if (section !== undefined) {
      let spec = sections.get(section.label);
      if (!spec) {
        spec = { at, label: section.label, paths: [] };
        sections.set(section.label, spec);
        sink.sections.push(spec);
      }
      spec.paths.push(path);
      // One node saying `collapsed` settles the section, so a schema does not
      // have to repeat it on every node under the heading.
      if (section.collapsed !== undefined) {
        spec.collapsed = (spec.collapsed ?? false) || section.collapsed;
      }
      if (section.layout !== undefined && spec.layout === undefined) spec.layout = section.layout;
      if (section.pack !== undefined && spec.pack === undefined) spec.pack = section.pack;
      if (section.className !== undefined && spec.className === undefined)
        spec.className = section.className;
      if (section.motif !== undefined && spec.motif === undefined) spec.motif = section.motif;
    }
    if (predicate) sink.showIf.set(path, predicate);
    if (enableIf) sink.enableIf.set(path, enableIf);
    if (isConfigBranch(entry) && entry.options.resettable) sink.resettable.add(path);
    if (isConfigBranch(entry) && entry.options.motif) sink.motifs.set(path, entry.options.motif);
    if (!isConfigBranch(entry) && entry.options.render) sink.renderers[path] = entry.options.render;
    if (!isConfigBranch(entry) && entry.options.dialog) sink.dialogs[path] = entry.options.dialog;
  }

  return { name, children };
}

function resolveEntry(
  entry: ConfigEntry,
  key: string,
  path: string,
  sink: Sink,
): PrefLeaf | PrefGroup {
  if (isConfigBranch(entry)) {
    const group = resolveShape(
      entry.children,
      path,
      entry.annotations.name ?? titleCase(key),
      sink,
    );
    const { name: _name, ...said } = entry.annotations;
    return { ...group, ...defined(said) } as PrefGroup;
  }
  const seed: LeafPatch = defined({
    ...entry.annotations,
    ...(entry.kind === null ? {} : { kind: entry.kind }),
  });
  const patch = applyRules(seed, { key, path, default: entry.default }, sink.chain);
  if (patch.kind === undefined) {
    throw new Error(
      `[labkit] "${path}" is an f.value whose kind cannot be inferred from its default (${String(entry.default)}) — declare it with a typed builder, or f.custom(kind, default) for a value with no row`,
    );
  }
  const { autoResolve, auto } = entry.options;
  return {
    ...patch,
    default: entry.default,
    // Extra keys survive onto the leaf at runtime; `ControlPanel` reads them
    // back with its `extra<T>` helper, the same as `min`, `step` and the rest.
    ...(autoResolve === undefined ? {} : { autoResolve }),
    // labkit's auto is opt-in, where a leaf with no `auto` can be auto to any other reader. A leaf
    // `fromPrefs` carried over keeps the `auto` its schema gave it.
    auto: auto ?? ownAuto(patch) ?? false,
  } as PrefLeaf;
}

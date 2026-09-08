import type { PrefGroup, PrefLeaf } from '@weasel-js/ui';
import { isConfigBranch } from './builder';
import { applyRules, builtinRules, titleCase } from './rules';
import type {
  ConfigEntry,
  ConfigRule,
  ConfigSchema,
  ConfigShape,
  ControlRenderer,
  LeafPatch,
  ResolvedConfig,
  SectionSpec,
} from './types';

/** Drop keys whose value is undefined, so an unset annotation stays a gap the
 *  rule chain can fill rather than a settled `undefined`. */
function defined(annotations: Record<string, unknown>): LeafPatch {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(annotations)) if (v !== undefined) out[k] = v;
  return out as LeafPatch;
}

/** What the walk collects on the side of the `PrefGroup` tree. */
interface Sink {
  sections: SectionSpec[];
  showIf: Map<string, (config: Record<string, unknown>) => boolean>;
  renderers: Record<string, ControlRenderer>;
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
): ResolvedConfig {
  const sink: Sink = {
    sections: [],
    showIf: new Map(),
    renderers: {},
    chain: [...rules, ...builtinRules],
  };
  const group = resolveShape(schema.nodes, '', '', sink);
  return { group, sections: sink.sections, showIf: sink.showIf, renderers: sink.renderers };
}

/** A section while it is still being filled. */
type OpenSection = Omit<SectionSpec, 'paths'> & { paths: string[] };

function resolveShape(shape: ConfigShape, at: string, name: string, sink: Sink): PrefGroup {
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  const sections = new Map<string, OpenSection>();

  for (const [key, entry] of Object.entries(shape)) {
    const path = at === '' ? key : `${at}.${key}`;
    children[key] = resolveEntry(entry, key, path, sink);

    const { section, showIf: predicate } = entry.options;
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
    }
    if (predicate) sink.showIf.set(path, predicate);
    if (!isConfigBranch(entry) && entry.options.render) sink.renderers[path] = entry.options.render;
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
    return entry.annotations.description === undefined
      ? group
      : { ...group, description: entry.annotations.description };
  }
  const seed: LeafPatch = defined({
    ...entry.annotations,
    ...(entry.kind === null ? {} : { kind: entry.kind }),
  });
  const patch = applyRules(seed, { key, path, default: entry.default }, sink.chain);
  return { ...patch, default: entry.default } as PrefLeaf;
}

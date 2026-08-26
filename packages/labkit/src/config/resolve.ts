import type { PrefGroup, PrefLeaf } from '@weasel-js/ui';
import { applyRules, builtinRules } from './rules';
import type {
  ConfigRule,
  ConfigSchema,
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

/**
 * Resolve a schema into the vocabulary weasel-ui renders, running each leaf
 * through the consumer's rules and then labkit's own.
 *
 * The group is flat — every leaf is a direct child — so a leaf's path is its
 * config key and both `ControlPanel` and `PrefsForm` address it identically.
 */
export function resolveConfigSchema<TC>(
  schema: ConfigSchema<TC>,
  rules: readonly ConfigRule[] = [],
): ResolvedConfig {
  const children: Record<string, PrefLeaf> = {};
  const sectionOrder: string[] = [];
  const sectionPaths = new Map<string, string[]>();
  const showIf = new Map<string, (config: Record<string, unknown>) => boolean>();
  const renderers: Record<string, ControlRenderer> = {};

  const chain = [...rules, ...builtinRules];

  for (const [key, node] of Object.entries(schema.nodes)) {
    const seed: LeafPatch = defined({
      ...node.annotations,
      ...(node.kind === null ? {} : { kind: node.kind }),
    });

    const patch = applyRules(seed, { key, path: key, default: node.default }, chain);
    children[key] = { ...patch, default: node.default } as PrefLeaf;

    const { section, showIf: predicate, render } = node.options;
    if (section !== undefined) {
      if (!sectionPaths.has(section)) {
        sectionOrder.push(section);
        sectionPaths.set(section, []);
      }
      sectionPaths.get(section)?.push(key);
    }
    if (predicate) showIf.set(key, predicate);
    if (render) renderers[key] = render;
  }

  const group: PrefGroup = { name: '', children };
  const sections: SectionSpec[] = sectionOrder.map((label) => ({
    label,
    paths: sectionPaths.get(label) ?? [],
  }));

  return { group, sections, showIf, renderers };
}

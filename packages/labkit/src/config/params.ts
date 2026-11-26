import {
  type ParamShape,
  type ParamSpec,
  type ParamValues,
  paramDefaults,
} from '@weasel-js/prefs-schema';
import { getOwn, setOwn } from '@weasel-js/registry';
import { AUTO } from './auto';
import type { BaseNode } from './baseNode';
import { f } from './builder';
import type { ConfigEntry, ConfigSchemaBuilder, ConfigShape } from './types';

/** What every kind of param says, said on the leaf built for it. */
function withCommon<N extends BaseNode<unknown>>(node: N, spec: ParamSpec): N {
  let out = node;
  if (spec.label !== undefined) out = out.label(spec.label);
  if (spec.description !== undefined) out = out.describe(spec.description);
  if (spec.auto !== undefined) out = spec.auto.on ? out.initial(AUTO) : out.auto();
  return out;
}

function leafFor(spec: ParamSpec, def: unknown): ConfigEntry {
  switch (spec.kind) {
    case 'number': {
      let node = f.number(def as number);
      const { min, max } = spec;
      if (min !== undefined && max !== undefined) node = node.range(min, max);
      else if (min !== undefined) node = node.min(min);
      else if (max !== undefined) node = node.max(max);
      if (spec.step !== undefined) node = node.step(spec.step);
      if (spec.suffix !== undefined) node = node.suffix(spec.suffix);
      return withCommon(node, spec);
    }
    case 'boolean':
      return withCommon(f.boolean(def as boolean), spec);
    case 'enum':
      return withCommon(
        f.enum(
          def as string,
          spec.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
        ),
        spec,
      );
    case 'color': {
      const node = f.color(def as string);
      return withCommon(spec.alpha ? node.alpha() : node, spec);
    }
  }
}

function shapeFor(params: ParamShape, defaults: Record<string, unknown>): ConfigShape {
  const out: Record<string, ConfigEntry> = {};
  for (const [key, entry] of Object.entries(params)) {
    if (entry.kind !== 'group') {
      setOwn(out, key, leafFor(entry, getOwn(defaults, key)));
      continue;
    }
    let group = f.group(shapeFor(entry.params, getOwn(defaults, key) as Record<string, unknown>));
    if (entry.label !== undefined) group = group.label(entry.label);
    if (entry.description !== undefined) group = group.describe(entry.description);
    setOwn(out, key, group);
  }
  return out;
}

/**
 * A plain-data param description (`ParamShape`, from `@weasel-js/prefs-schema`) as an instrument's
 * config: each param the `f` leaf of its kind, each group an `f.group`, so a value sits at the same
 * path in the config as in the description. A value in `options.defaults` stands in for a param's
 * own `default`, as `paramDefaults` reads it.
 */
export function configFromParams<const S extends ParamShape>(
  params: S,
  options: { defaults?: unknown } = {},
): ConfigSchemaBuilder<ParamValues<S>> {
  const defaults = paramDefaults(params, options.defaults) as Record<string, unknown>;
  return f.schema(shapeFor(params, defaults)) as unknown as ConfigSchemaBuilder<ParamValues<S>>;
}

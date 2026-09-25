import { type ConfigSchema, type ConfigShape, isConfigBranch, titleCase } from '@weasel-js/labkit/config';
import { isPlainObject } from '../../csf/isPlainObject';

export interface VariantValue {
  value: unknown;
  label: string;
}

/** One control a story is shown varying along, with every other control at its default. */
export interface VariantRow {
  /** Dotted, as `setConfig` takes it. */
  path: string;
  label: string;
  values: VariantValue[];
}

/** Above this many choices a row stops being something to scan. */
export const MAX_ENUM_OPTIONS = 8;
export const MAX_ROWS = 6;

const labelOf = (key: string, name: string | undefined): string => name ?? titleCase(key);

/**
 * The boolean and enum controls of `schema` a story can be shown varying along, in schema order: skipped are
 * controls that draw their own row, controls hidden at the defaults, and enums with more than
 * `MAX_ENUM_OPTIONS` choices. At most `MAX_ROWS`.
 */
export function variantRows(schema: ConfigSchema<unknown>): VariantRow[] {
  const defaults = schema.defaults() as Record<string, unknown>;
  const rows: VariantRow[] = [];
  const walk = (shape: ConfigShape, at: string): void => {
    for (const [key, entry] of Object.entries(shape)) {
      if (rows.length >= MAX_ROWS) return;
      const path = at === '' ? key : `${at}.${key}`;
      if (entry.options.showIf && !entry.options.showIf(defaults)) continue;
      if (isConfigBranch(entry)) {
        walk(entry.children, path);
        continue;
      }
      if (entry.annotations.hidden || entry.options.render) continue;
      const label = labelOf(key, entry.annotations.name);
      if (entry.kind === 'boolean') {
        rows.push({ path, label, values: [false, true].map((value) => ({ value, label: String(value) })) });
      } else if (entry.kind === 'enum') {
        const options = entry.annotations.options ?? [];
        if (options.length < 2 || options.length > MAX_ENUM_OPTIONS) continue;
        rows.push({ path, label, values: options.map((o) => ({ value: o.value, label: o.label })) });
      }
    }
  };
  walk(schema.nodes, '');
  return rows;
}

/** `over` merged into `base`: nested plain objects merge, anything else replaces. */
export function mergeConfig(base: unknown, over: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(over)) return over === undefined ? base : over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) out[key] = mergeConfig(base[key], value);
  return out;
}

/** `config` with `value` at dotted `path`, copying each object along the way. */
export function withValueAt(config: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split('.');
  if (head === undefined) return value;
  const record = isPlainObject(config) ? config : {};
  return { ...record, [head]: rest.length === 0 ? value : withValueAt(record[head], rest.join('.'), value) };
}

import { type ConfigShape, f } from '@weasel-js/labkit';
import { cssColorLiteral } from '@weasel-js/paint';

/** A slider over `min`…`max` by `step`, starting at `def`. */
export const num = (def: number, min: number, max: number, step: number) => f.number(def).range(min, max).step(step);

/** A line of text heading the rows after it. */
export const head = (text: string) => f.label(text);

export const LIGHT_FROM = ['tl', 'tr', 'bl', 'br'] as const;

export type Params = Record<string, unknown>;

/** A base's or effect's params as `<Badge>` takes them: every value set, a color as a color literal. */
export function badgeParams(shape: ConfigShape, values: Params): Params {
  const out: Params = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    out[key] = isColor(shape, key) ? cssColorLiteral(String(value)) : value;
  }
  return out;
}

/** Whether `key` in `shape` holds a color, which a snippet writes as a color literal. */
export const isColor = (shape: ConfigShape, key: string): boolean => (shape[key] as unknown as { kind?: string } | undefined)?.kind === 'color';

/** The values `params` holds that differ from `shape`'s defaults. */
export function changedParams(shape: ConfigShape, params: Params): Params {
  const defaults = f.schema(shape).defaults() as Params;
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => value !== undefined && value !== null && value !== defaults[key]),
  );
}

/** A value as source text. */
export const literal = (v: unknown): string => JSON.stringify(v) ?? String(v);

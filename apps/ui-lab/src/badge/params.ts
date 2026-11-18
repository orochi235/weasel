import { type ConfigShape, f } from '@weasel-js/labkit';
import { cssColorLiteral } from '@weasel-js/paint';
import { getOwn, setOwn } from '@weasel-js/registry';

/** A slider over `min`…`max` by `step`, starting at `def`. */
export const num = (def: number, min: number, max: number, step: number) => f.number(def).range(min, max).step(step);

/** A line of text heading the rows after it. */
export const head = (text: string) => f.label(text);

export const LIGHT_FROM = ['tl', 'tr', 'bl', 'br'] as const;

export type Params = Record<string, unknown>;

/** The switches `themeColor` makes, each a param of the lab's own that `<Badge>` never sees. */
const OWN_SWITCHES = new WeakSet<object>();

const ownKey = (key: string): string => `${key}Own`;

/**
 * A color param whose base or effect follows the theme unless it is given one: a switch, off at first, and the
 * color it enables. Off, the param is left unset, so the badge draws the color it would on its own.
 */
export function themeColor(key: string, def: string): ConfigShape {
  const own = f.boolean(false).label(`Own ${key}`);
  OWN_SWITCHES.add(own);
  return { [ownKey(key)]: own, [key]: f.color(def).enableIf({ path: ownKey(key), is: true }) };
}

const isOwnSwitch = (shape: ConfigShape, key: string): boolean => {
  const leaf = getOwn(shape, key) as object | undefined;
  return leaf !== undefined && OWN_SWITCHES.has(leaf);
};

/** Whether `key` in `shape` is a `themeColor`, which the badge draws in its own color until its switch is on. */
export const followsTheme = (shape: ConfigShape, key: string): boolean => isOwnSwitch(shape, ownKey(key));

/** The params of `values` that `<Badge>` is handed, as the lab holds them: no lab switch, and nothing left unset. */
export function sentParams(shape: ConfigShape, values: Params): Params {
  const out: Params = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || isOwnSwitch(shape, key)) continue;
    if (followsTheme(shape, key) && getOwn(values, ownKey(key)) !== true) continue;
    setOwn(out, key, value);
  }
  return out;
}

/** A base's or effect's params as `<Badge>` takes them: every value set, a color as a color literal. */
export function badgeParams(shape: ConfigShape, values: Params): Params {
  const out: Params = {};
  for (const [key, value] of Object.entries(sentParams(shape, values))) {
    setOwn(out, key, isColor(shape, key) ? cssColorLiteral(String(value)) : value);
  }
  return out;
}

/** Whether `key` in `shape` holds a color, which a snippet writes as a color literal. */
export const isColor = (shape: ConfigShape, key: string): boolean => (getOwn(shape, key) as unknown as { kind?: string } | undefined)?.kind === 'color';

/** The values `params` holds that differ from `shape`'s defaults. */
export function changedParams(shape: ConfigShape, params: Params): Params {
  const defaults = f.schema(shape).defaults() as Params;
  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => value !== undefined && value !== null && value !== getOwn(defaults, key)),
  );
}

/** A value as source text. */
export const literal = (v: unknown): string => JSON.stringify(v) ?? String(v);

import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import type { Globals } from '../protocol/messages';

/** One global the workshop's toolbar sets for every story, and a trial may pin for its own. */
export interface GlobalDeclaration {
  label: string;
  options: readonly { value: string; label: string }[];
  default: string;
}

export type GlobalDeclarations = Readonly<Record<string, GlobalDeclaration>>;

/** The config group every story schema gains, holding the trial's pins. A story never sees it. */
export const GLOBALS_KEY = '$globals';
/** A pin's value when the trial follows the lab. */
export const FOLLOW_LAB = 'lab';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isGlobalsPath = (path: string): boolean => path === GLOBALS_KEY || path.startsWith(`${GLOBALS_KEY}.`);

/** The lab's values from what was stored: declared keys only, and a value no option offers falls back to the default. */
export function labGlobals(declarations: GlobalDeclarations, stored: unknown): Globals {
  const from = isRecord(stored) ? stored : {};
  return Object.fromEntries(
    Object.entries(declarations).map(([key, declaration]) => {
      const value = from[key];
      return [key, declaration.options.some((option) => option.value === value) ? value : declaration.default];
    }),
  );
}

/** The lab's values, overridden by the pins in a trial's config that do not follow the lab. */
export function effectiveGlobals(lab: Globals, pins: unknown): Globals {
  if (!isRecord(pins)) return lab;
  const pinned = Object.entries(pins).filter(([key, value]) => key in lab && value !== FOLLOW_LAB);
  return pinned.length === 0 ? lab : { ...lab, ...Object.fromEntries(pinned) };
}

/**
 * The config a story receives: the trial's, without its pins. Returns `previous` when every other entry is the same,
 * so a change to a pin alone is not a change to the story's config.
 */
export function storyConfig(config: unknown, previous?: unknown): unknown {
  if (!isRecord(config) || !(GLOBALS_KEY in config)) return config;
  const rest = Object.fromEntries(Object.entries(config).filter(([key]) => key !== GLOBALS_KEY));
  if (isRecord(previous)) {
    const keys = Object.keys(rest);
    if (keys.length === Object.keys(previous).length && keys.every((key) => rest[key] === previous[key])) return previous;
  }
  return rest;
}

/** `schema` with a `$globals` group appended: one leaf per declaration, following the lab until pinned. */
export function withGlobals(schema: ConfigSchema<unknown>, declarations: GlobalDeclarations): ConfigSchema<unknown> {
  const entries = Object.entries(declarations);
  if (entries.length === 0) return schema;
  const leaves = Object.fromEntries(
    entries.map(([key, declaration]) => [
      key,
      f.enum(FOLLOW_LAB, [{ value: FOLLOW_LAB, label: 'Lab' }, ...declaration.options]).label(declaration.label),
    ]),
  );
  // An empty group name contributes rows without a heading of its own, under the section's.
  const group = f.group(leaves).label('').section('Globals');
  return f.schema({ ...schema.nodes, [GLOBALS_KEY]: group }) as ConfigSchema<unknown>;
}

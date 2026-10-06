import type { LabMode } from '@weasel-js/labkit';
import { type ConfigSchema, f } from '@weasel-js/labkit/config';
import type { Globals } from '../protocol/messages';

/** One global the workshop's toolbar sets for every story, and a trial may pin for its own. */
export interface GlobalDeclaration {
  label: string;
  options: readonly { value: string; label: string }[];
  default: string;
  /** Another global's key: the toolbar shows this one in a popover beside that one rather than in the bar itself. */
  under?: string;
  /**
   * Whether the toolbar offers `value` given the lab's other values; every option shows when absent. `globals` is
   * resolved without any declaration's `shows`, so one `shows` cannot depend on another's outcome.
   */
  shows?: (value: string, globals: Globals) => boolean;
  /**
   * What this global reads from the lab's own chrome. Given, the lab's value may be `App` (`FOLLOW_APP`), offered
   * first, and while it is the global follows that chrome control, as the header's mode switch sets it. A trial's
   * pin follows the lab or names a value; it cannot follow the app on its own.
   */
  follows?: (chrome: LabChrome) => string;
}

/** The lab chrome's own settings a global can follow. */
export interface LabChrome {
  mode: LabMode;
}

/** The shell config's `globals`: each declaration by the key stories read it under. */
export type GlobalDeclarations = Readonly<Record<string, GlobalDeclaration>>;

/** The config group every story schema gains, holding the trial's pins. A story never sees it. */
export const GLOBALS_KEY = '$globals';
/** A pin's value when the trial follows the lab. */
export const FOLLOW_LAB = 'lab';
/** A lab value, for a declaration that `follows` the app, meaning whatever the app's chrome is set to. */
export const FOLLOW_APP = 'app';

const APP_OPTION = { value: FOLLOW_APP, label: 'App' } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isGlobalsPath = (path: string): boolean => path === GLOBALS_KEY || path.startsWith(`${GLOBALS_KEY}.`);

/** The config key a timeline story's paused playhead is kept under, so labkit persists and snapshots it. */
export const PLAYHEAD_KEY = '$playhead';

/** Config keys forge owns: a story neither sees nor writes them. */
const FORGE_KEYS: ReadonlySet<string> = new Set([GLOBALS_KEY, PLAYHEAD_KEY]);

/** Whether a config path lies under a key forge owns. */
export const isForgePath = (path: string): boolean => FORGE_KEYS.has(path.split('.')[0]!);

/** The options the toolbar offers for `declaration` at `globals`. */
export function shownOptions(declaration: GlobalDeclaration, globals: Globals): GlobalDeclaration['options'] {
  const { shows } = declaration;
  return shows ? declaration.options.filter((option) => shows(option.value, globals)) : declaration.options;
}

/** The options the lab's own control offers: `shownOptions`, after `App` where the declaration follows the app. */
export function labOptions(declaration: GlobalDeclaration, globals: Globals): GlobalDeclaration['options'] {
  const shown = shownOptions(declaration, globals);
  return declaration.follows ? [APP_OPTION, ...shown] : shown;
}

/** `values` with each `App` replaced by what its declaration reads from `chrome`; `values` itself when none is. */
export function followApp(declarations: GlobalDeclarations, values: Globals, chrome: LabChrome): Globals {
  const followed = Object.entries(declarations).flatMap(([key, { follows }]) =>
    follows && values[key] === FOLLOW_APP ? [[key, follows(chrome)] as const] : [],
  );
  return followed.length === 0 ? values : { ...values, ...Object.fromEntries(followed) };
}

/**
 * The lab's values from what was stored: declared keys only. A value no option offers falls back to the default, and
 * one its declaration's `shows` hides falls back to the shown option nearest it in `options`, the earlier on a tie.
 */
export function labGlobals(declarations: GlobalDeclarations, stored: unknown): Globals {
  const from = isRecord(stored) ? stored : {};
  const offered: Globals = Object.fromEntries(
    Object.entries(declarations).map(([key, declaration]) => {
      const value = from[key];
      const known =
        declaration.options.some((option) => option.value === value) || (declaration.follows && value === FOLLOW_APP);
      return [key, known ? value : declaration.default];
    }),
  );
  return Object.fromEntries(
    Object.entries(declarations).map(([key, declaration]) => {
      const shown = shownOptions(declaration, offered);
      const value = offered[key];
      if (value === FOLLOW_APP && declaration.follows) return [key, value];
      if (!declaration.shows || shown.length === 0 || shown.some((option) => option.value === value)) return [key, value];
      const at = (v: unknown) => declaration.options.findIndex((option) => option.value === v);
      const from = at(value);
      const nearest = shown.reduce((best, option) =>
        Math.abs(at(option.value) - from) < Math.abs(at(best.value) - from) ? option : best,
      );
      return [key, nearest.value];
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
 * The config a story receives: the trial's, without the keys forge owns. Returns `previous` when every other entry is
 * the same, so a change to a pin or the playhead alone is not a change to the story's config.
 */
export function storyConfig(config: unknown, previous?: unknown): unknown {
  if (!isRecord(config) || !Object.keys(config).some((key) => FORGE_KEYS.has(key))) return config;
  const rest = Object.fromEntries(Object.entries(config).filter(([key]) => !FORGE_KEYS.has(key)));
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
  const group = f.group(leaves).label('').section('Globals', { layout: 'inline', pack: 'pairs' });
  return f.schema({ ...schema.nodes, [GLOBALS_KEY]: group }) as ConfigSchema<unknown>;
}

import { AUTO, prefCanAuto, type LeafReading } from '../autoReset';
import type { PrefGroup, PrefSection } from '../groups';
import { prefLeafAt, prefValueAtPath } from '../helpers';
import { prefLeafValue } from '../leafValue';
import type { PrefLeaf } from '../schema';
import { sourceResetPlan, writePlan } from './policy';
import { LEAF_FREE, type LeafState, type PrefsSource } from './prefsSource';

/** What a values map's owner keeps beside the values. */
export interface ValuesSourceOptions {
  /** The paths now unpinned. */
  auto?: ReadonlySet<string>;
  /** Hears a leaf unpinned or pinned. Without it no leaf is auto here. */
  onAutoChange?: (path: string, next: boolean) => void;
  /** Whether the leaf at a path may be auto here, beside opting in. Default: every one that opts in. */
  canAuto?: (path: string) => boolean;
  /** The paths whose values disagree, for a values map standing for several. */
  mixed?: ReadonlySet<string>;
  /** Puts a leaf back as its schema says, where the owner does that itself (a prefs store stores nothing for it). */
  onReset?: (path: string) => void;
  /** What the conditions over a path leave it. */
  stateAt?: (path: string) => LeafState;
  /** The schema the form's aliases point into, where an alias row's leaf is found. */
  over?: PrefGroup | PrefSection;
}

const parentOf = (values: unknown, path: string): Record<string, unknown> | undefined => {
  const dot = path.lastIndexOf('.');
  const parent = dot === -1 ? values : prefValueAtPath(values, path.slice(0, dot));
  return typeof parent === 'object' && parent !== null ? (parent as Record<string, unknown>) : undefined;
};

/**
 * A source over one values map, read through `get` each time it is asked, so a host keeping the map in a store
 * can hand out one source for good. Writes go to `set`; a leaf holding nothing shows its default.
 */
export function valuesSource(
  schema: PrefGroup | PrefSection,
  get: () => unknown,
  set: (path: string, value: unknown) => void,
  options: ValuesSourceOptions = {},
): PrefsSource {
  const { auto, onAutoChange, canAuto, mixed, onReset, stateAt = () => LEAF_FREE, over } = options;
  const leafAt = (path: string) => prefLeafAt(schema, path) ?? (over ? prefLeafAt(over, path) : undefined);
  const autoAt = (path: string): boolean | undefined => {
    const leaf = leafAt(path);
    if (!leaf || onAutoChange === undefined || !prefCanAuto(leaf) || !(canAuto?.(path) ?? true)) return undefined;
    return auto?.has(path) ?? false;
  };
  const write = (path: string, value: unknown): void => {
    if (value === AUTO) onAutoChange?.(path, true);
    else set(path, value);
  };
  const source: PrefsSource = {
    schema,
    valueAt: (path): LeafReading => {
      const leaf = leafAt(path);
      const stored = prefValueAtPath(get(), path);
      const unpinned = autoAt(path);
      const at = unpinned === undefined ? {} : { auto: unpinned };
      if (mixed?.has(path)) return { value: undefined, mixed: true, each: [], ...at };
      const value = leaf ? prefLeafValue(leaf, stored) : stored;
      return { value, mixed: false, each: [value], ...at };
    },
    write,
    update: (path, fn) => {
      const values = get();
      write(path, fn(prefValueAtPath(values, path), parentOf(values, path)));
    },
    autoAt,
    setAuto: (path, next) => {
      if (autoAt(path) !== undefined) onAutoChange?.(path, next);
    },
    stateAt,
    reset: (paths) => {
      const plan = sourceResetPlan(source, paths);
      if (onReset) for (const { path } of plan) onReset(path);
      else writePlan(plan, write);
    },
  };
  return source;
}

/**
 * A source over values keyed by whole dotted paths, `{ 'tools.size': 3 }`, as a standalone bar or one control is
 * handed them. `leaves` says what each path holds; `mixed` the paths whose values disagree. A value is read as
 * held, with no default put in for one holding nothing.
 */
export function recordSource(
  leaves: Readonly<Record<string, PrefLeaf>>,
  values: Readonly<Record<string, unknown>> | undefined,
  onChange: ((path: string, value: unknown) => void) | undefined,
  { mixed, stateAt = () => LEAF_FREE }: { mixed?: ReadonlySet<string>; stateAt?: (path: string) => LeafState } = {},
): PrefsSource {
  const schema: PrefSection = { name: '', members: leaves };
  const write = (path: string, value: unknown): void => onChange?.(path, value);
  const source: PrefsSource = {
    schema,
    valueAt: (path): LeafReading => {
      if (mixed?.has(path)) return { value: undefined, mixed: true, each: [] };
      const value = values?.[path];
      return { value, mixed: false, each: [value] };
    },
    write,
    update: (path, fn) => write(path, fn(values?.[path])),
    autoAt: () => undefined,
    stateAt,
    reset: (paths) => writePlan(sourceResetPlan(source, paths), write),
  };
  return source;
}

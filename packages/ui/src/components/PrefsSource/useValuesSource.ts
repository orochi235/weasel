import { useMemo } from 'react';
import {
  AUTO,
  prefCanAuto,
  prefLeafAt,
  prefLeafValue,
  prefValueAtPath,
  type LeafReading,
  type PrefGroup,
  type PrefSection,
} from '@weasel-js/prefs';
import type { PrefsSource } from './PrefsSource';
import { sourceResetPlan, writePlan } from './policy';
import type { LeafState } from './types';

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

const FREE: LeafState = { disabled: false, hidden: false, active: false };

const parentOf = (values: unknown, path: string): Record<string, unknown> | undefined => {
  const dot = path.lastIndexOf('.');
  const parent = dot === -1 ? values : prefValueAtPath(values, path.slice(0, dot));
  return typeof parent === 'object' && parent !== null ? (parent as Record<string, unknown>) : undefined;
};

/** A source over one values map: a form's `values`, written back through `onChange`. */
export function valuesSource(
  schema: PrefGroup | PrefSection,
  values: unknown,
  onChange: (path: string, value: unknown) => void,
  options: ValuesSourceOptions = {},
): PrefsSource {
  const { auto, onAutoChange, canAuto, mixed, onReset, stateAt = () => FREE, over } = options;
  const leafAt = (path: string) => prefLeafAt(schema, path) ?? (over ? prefLeafAt(over, path) : undefined);
  const autoAt = (path: string): boolean | undefined => {
    const leaf = leafAt(path);
    if (!leaf || onAutoChange === undefined || !prefCanAuto(leaf) || !(canAuto?.(path) ?? true)) return undefined;
    return auto?.has(path) ?? false;
  };
  const write = (path: string, value: unknown): void => {
    if (value === AUTO) onAutoChange?.(path, true);
    else onChange(path, value);
  };
  const source: PrefsSource = {
    schema,
    valueAt: (path): LeafReading => {
      const leaf = leafAt(path);
      const stored = prefValueAtPath(values, path);
      const auto = autoAt(path);
      const at = auto === undefined ? {} : { auto };
      if (mixed?.has(path)) return { value: undefined, mixed: true, each: [], ...at };
      const value = leaf ? prefLeafValue(leaf, stored) : stored;
      return { value, mixed: false, each: [value], ...at };
    },
    write,
    update: (path, fn) => write(path, fn(prefValueAtPath(values, path), parentOf(values, path))),
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

/** {@link valuesSource}, rebuilt only when what it reads changes. */
export function useValuesSource(
  schema: PrefGroup | PrefSection,
  values: unknown,
  onChange: (path: string, value: unknown) => void,
  options: ValuesSourceOptions = {},
): PrefsSource {
  const { auto, onAutoChange, canAuto, mixed, onReset, stateAt, over } = options;
  return useMemo(
    () => valuesSource(schema, values, onChange, { auto, onAutoChange, canAuto, mixed, onReset, stateAt, over }),
    [schema, values, onChange, auto, onAutoChange, canAuto, mixed, onReset, stateAt, over],
  );
}

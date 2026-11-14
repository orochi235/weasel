import type { LeafReading, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import type { PrefsSource } from './PrefsSource';
import { sourceLeafContext, sourceResetPlan, writePlan } from './policy';
import type { LeafContext, LeafState } from './types';

const FREE: LeafState = { disabled: false, hidden: false, active: false };

/**
 * A source over values keyed by whole dotted paths, `{ 'tools.size': 3 }`, as a standalone bar or one control is
 * handed them. `leaves` says what each path holds; `mixed` the paths whose values disagree.
 */
export function recordSource(
  leaves: Readonly<Record<string, PrefLeaf>>,
  values: Readonly<Record<string, unknown>> | undefined,
  onChange: ((path: string, value: unknown) => void) | undefined,
  { mixed, stateAt = () => FREE }: { mixed?: ReadonlySet<string>; stateAt?: (path: string) => LeafState } = {},
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

/** The context of one leaf drawn on its own, holding `value` and writing through `setValue`. */
export function loneLeafContext(path: string, pref: PrefLeaf, value: unknown, setValue: (value: unknown) => void): LeafContext {
  return sourceLeafContext(recordSource({ [path]: pref }, { [path]: value }, (_path, next) => setValue(next)), path, pref);
}

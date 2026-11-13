import {
  isPrefLeaf,
  type PrefGroup,
  type PrefLeaf,
  prefHoldsValue,
  repairPrefValue,
} from '@weasel-js/prefs';
import { valueAtPath, withValueAtPath } from './path';

/** Every leaf in a resolved schema, in schema order, with its dotted path.
 *  Not `prefLeaves`, which rejects the `$version` key a prefs store reserves. */
export function* configLeaves(group: PrefGroup, at = ''): Generator<[string, PrefLeaf]> {
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    if (isPrefLeaf(child)) yield [path, child];
    else yield* configLeaves(child, path);
  }
}

/**
 * `config` with each value its schema describes read the way a prefs store reads a stored one
 * (`repairPrefValue`): a number clamped into its range, and a value of the wrong kind, or an enum's
 * option no longer offered, read as the leaf's default. A path holding nothing stays empty, and a
 * key no leaf describes is kept. The input is left alone.
 */
export function repairedConfig<T>(group: PrefGroup, config: T): T {
  let out = config;
  for (const [path, leaf] of configLeaves(group)) {
    if (!prefHoldsValue(leaf)) continue;
    const held = valueAtPath(out, path);
    if (held === undefined) continue;
    const read = repairPrefValue(leaf, held);
    if (read !== held) out = withValueAtPath(out, path, read);
  }
  return out;
}

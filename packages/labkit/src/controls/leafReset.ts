import {
  type PrefLeaf,
  prefIsReset,
  prefResetOf,
  prefShownValue,
  prefStoredReset,
} from '@weasel-js/prefs';
import { auto } from '../config/auto';
import { isRecord, valueAtPath } from '../config/path';
import { isEncodedLeaf } from '../config/storedDefault';
import { leafValueAt } from './fields';

/** What the row at `path` shows: an encoded leaf's stored value read through its encoding. */
export function shownAt(config: Record<string, unknown>, path: string, leaf: PrefLeaf): unknown {
  if (!isEncodedLeaf(leaf)) return leafValueAt(config, path, leaf);
  const dot = path.lastIndexOf('.');
  const within = dot === -1 ? config : valueAtPath(config, path.slice(0, dot));
  return prefShownValue(leaf, valueAtPath(config, path), isRecord(within) ? within : undefined);
}

/** Whether the leaf at `path` already is what a reset makes of it, `auto` holding the paths now unpinned. */
export function leafIsReset(
  config: Record<string, unknown>,
  path: string,
  leaf: PrefLeaf,
  autoPaths: ReadonlySet<string>,
): boolean {
  return prefIsReset(leaf, { auto: autoPaths.has(path), value: shownAt(config, path, leaf) });
}

/** What `setConfig` is handed to reset `leaf`: the `auto` sentinel for one that starts auto, else what the
 *  config holds at its default. */
export function resetWrite(leaf: PrefLeaf): unknown {
  return prefResetOf(leaf).auto ? auto : prefStoredReset(leaf);
}

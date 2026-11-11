import type { PrefLeaf } from '@weasel-js/prefs';
import { ownAt } from './path';
import type { ControlRenderer, DialogSpec, ResolvedConfig } from './types';

/** The entry `map` holds for `key`, by path or by kind: not one every object inherits, so a leaf keyed
 *  `toString` is not drawn by `Object.prototype.toString`. */
export function entryAt<T extends ControlRenderer | DialogSpec>(
  map: Readonly<Record<string, T>> | undefined,
  key: string,
): T | undefined {
  return map === undefined ? undefined : (ownAt(map, key) as T | undefined);
}

/** Whether the lab or the instrument draws the control of the leaf at `path` itself: by path, in a dialog, or by kind. */
export function drawsOwn(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): boolean {
  return (
    (entryAt(renderers, path) ??
      entryAt(resolved.renderers, path) ??
      entryAt(resolved.dialogs, path) ??
      entryAt(renderers, leaf.kind)) !== undefined
  );
}

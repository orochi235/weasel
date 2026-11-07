import type { PrefLeaf } from '@weasel-js/prefs';
import type { ControlRenderer, ResolvedConfig } from './types';

/** Whether the lab or the instrument draws the control of the leaf at `path` itself: by path, in a dialog, or by kind. */
export function drawsOwn(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): boolean {
  return (
    (renderers?.[path] ??
      resolved.renderers[path] ??
      resolved.dialogs[path] ??
      renderers?.[leaf.kind]) !== undefined
  );
}

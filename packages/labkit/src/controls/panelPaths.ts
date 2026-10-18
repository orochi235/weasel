import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { schemaNodeAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig } from '../config/types';

/** Whether anything at `path` draws: a visible leaf, or a group with one inside it. */
export function drawsAnyAt(
  resolved: ResolvedConfig,
  visible: (path: string) => boolean,
  path: string,
): boolean {
  if (!visible(path)) return false;
  const found = schemaNodeAtPath(resolved.group, path);
  if (!found || isPrefLeaf(found)) return found !== undefined;
  return Object.keys(found.children).some((key) => drawsAnyAt(resolved, visible, `${path}.${key}`));
}

/** A group's paths that no section inside it claims, in schema order. */
export function loosePathsIn(resolved: ResolvedConfig, group: PrefGroup, at: string): string[] {
  const sectioned = new Set(resolved.sections.filter((s) => s.at === at).flatMap((s) => s.paths));
  return Object.keys(group.children)
    .map((key) => (at === '' ? key : `${at}.${key}`))
    .filter((p) => !sectioned.has(p));
}

/** Whether the lab or the instrument draws the control of the leaf at `path` itself: by path, in a dialog, or by kind. */
export function drawsOwn(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  path: string,
  leaf: PrefLeaf,
): boolean {
  const own =
    renderers?.[path] ??
    resolved.renderers[path] ??
    resolved.dialogs[path] ??
    renderers?.[leaf.kind];
  return own !== undefined;
}

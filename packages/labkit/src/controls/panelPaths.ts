import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import type { PrefFieldChoice } from '@weasel-js/ui/components/Prefs';
import { schemaNodeAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { isSliderLeaf, labField } from './fields';

const NO_CHOICES: readonly PrefFieldChoice[] = [];
const unwritten = (): void => {};

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

/**
 * The leaf at `path` if it may share a row with its neighbors: `pair` is
 * presentational, so a leaf whose control the lab draws itself, or one whose
 * control needs the whole row, keeps its own row instead.
 */
export function pairableAt(
  resolved: ResolvedConfig,
  renderers: Record<string, ControlRenderer> | undefined,
  visible: (path: string) => boolean,
  path: string,
): readonly [path: string, leaf: PrefLeaf] | undefined {
  const found = schemaNodeAtPath(resolved.group, path);
  if (!found || !isPrefLeaf(found)) return undefined;
  if (!visible(path)) return undefined;
  if (drawsOwn(resolved, renderers, path, found)) return undefined;
  // A cell is one bare control, so a leaf with no one field keeps its row.
  if (isSliderLeaf(found) || labField(found, undefined, unwritten, NO_CHOICES) === null)
    return undefined;
  return [path, found];
}

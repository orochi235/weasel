import { isPrefLeaf, type PrefLeaf, prefFitsHeading } from '@weasel-js/prefs';
import { schemaNodeAtPath } from './path';
import { stutters, warnOfStutter, warnOnce } from './stutter';
import type { ControlRenderer, ResolvedConfig } from './types';

/** The leaf heading a run of rows: the one marked `.heading()`, or a first row
 *  that repeats `heading`, which is warned about as the authoring mistake it
 *  is. Undefined when neither applies, or the leaf's control is too big to sit
 *  beside a title — only a switch, a checkbox, a select or segments fit. */
export function headingLeaf(
  resolved: ResolvedConfig,
  heading: unknown,
  paths: readonly string[],
  renderers?: Record<string, ControlRenderer>,
): { path: string; leaf: PrefLeaf } | undefined {
  const leafAt = (path: string): PrefLeaf | undefined => {
    const found = schemaNodeAtPath(resolved.group, path);
    return found && isPrefLeaf(found) ? found : undefined;
  };
  const marked = paths.find((p) => {
    const leaf = leafAt(p);
    return leaf?.heading === true;
  });
  const path = marked ?? paths[0];
  const leaf = path === undefined ? undefined : leafAt(path);
  if (path === undefined || leaf === undefined) return undefined;
  const compact =
    prefFitsHeading(leaf) &&
    !(
      renderers?.[path] ??
      resolved.renderers[path] ??
      resolved.dialogs[path] ??
      renderers?.[leaf.kind]
    );
  if (marked === undefined) {
    if (typeof heading !== 'string' || !stutters(heading, leaf.name)) return undefined;
    warnOfStutter(resolved, heading, path, leaf.name, compact);
  } else if (!compact) {
    warnOnce(
      resolved,
      `heading|${path}`,
      `${path} is marked .heading(), but only a boolean or enum with a built-in control can sit in a heading; it stays a row.`,
    );
  }
  if (!compact) return undefined;
  return { path, leaf };
}

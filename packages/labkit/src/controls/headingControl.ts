import { isBuiltinToolPref } from '@weasel-js/core';
import { isPrefLeaf, type PrefLeaf } from '@weasel-js/ui';
import { schemaNodeAtPath } from '../config/path';
import type { ControlRenderer, ResolvedConfig } from '../config/types';
import { extra } from './fields';

/**
 * Whether a row's label only repeats the heading above it: the same word, or
 * one word grown from the other, as "Pump" under "Pumping". Such a row is a
 * heading with a control, written as a heading over a row.
 */
export function stutters(heading: string, label: string): boolean {
  const h = heading.trim().toLowerCase();
  const l = label.trim().toLowerCase();
  if (h === '' || l === '') return false;
  if (h === l) return true;
  if (/\s/.test(h) || /\s/.test(l)) return false;
  const [short, long] = h.length < l.length ? [h, l] : [l, h];
  return short.length >= 3 && long.startsWith(short);
}

const warned = new WeakMap<ResolvedConfig, Set<string>>();

function warnOnce(resolved: ResolvedConfig, key: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const seen = warned.get(resolved) ?? new Set<string>();
  warned.set(resolved, seen);
  if (seen.has(key)) return;
  seen.add(key);
  console.warn(`[labkit] ${message}`);
}

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
    return leaf !== undefined && extra<boolean>(leaf, 'heading') === true;
  });
  const path = marked ?? paths[0];
  const leaf = path === undefined ? undefined : leafAt(path);
  if (path === undefined || leaf === undefined) return undefined;
  const compact =
    (leaf.kind === 'boolean' || leaf.kind === 'enum') &&
    isBuiltinToolPref(leaf) &&
    !(
      renderers?.[path] ??
      resolved.renderers[path] ??
      resolved.dialogs[path] ??
      renderers?.[leaf.kind]
    );
  if (marked === undefined) {
    if (typeof heading !== 'string' || !stutters(heading, leaf.name)) return undefined;
    warnOnce(
      resolved,
      `${heading}|${path}`,
      compact
        ? `"${leaf.name}" (${path}) repeats its heading "${heading}". It is drawn in the heading instead; mark it .heading() to say so, or give it a label of its own.`
        : `"${leaf.name}" (${path}) repeats its heading "${heading}". Give it a label of its own.`,
    );
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

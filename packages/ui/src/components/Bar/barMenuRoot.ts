import type { PrefGroup } from '@weasel-js/prefs';

/**
 * A menu group as a root `resolveSchemaMenu` can walk with the bar's own
 * paths: its children under the groups that hold it, each of those inline, so
 * every row reads and writes the value at the path the bar keys it by.
 */
export function barMenuRoot(group: PrefGroup, path: string): PrefGroup {
  const segments = path.split('.');
  let node: PrefGroup = { ...group, as: undefined, showIf: undefined, enableIf: undefined };
  for (let i = segments.length - 1; i > 0; i--) node = { name: '', children: { [segments[i]!]: node } };
  return { name: '', children: { [segments[0]!]: node } };
}

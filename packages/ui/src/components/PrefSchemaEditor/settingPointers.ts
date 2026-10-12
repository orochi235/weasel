import { isPrefLeaf, prefHoldsValue, type PrefGroup } from '@weasel-js/prefs';
import { pointersIn, pointerTarget } from './pointers';
import { aliasOf, canAlias, childrenOf, joinPath, keyOf, nodeAt, uniqueKey, type ChildMap, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** Whether the node at tree path `path` of the dialog `over` is a setting a layout may point at. */
export function pointable(over: SchemaRoot, path: string): boolean {
  const node = nodeAt(over, path);
  return node !== undefined && isPrefLeaf(node) && prefHoldsValue(node) && canAlias(over, path);
}

/** The tree path of every setting under `path` in `over` a layout may point at, in the dialog's order. */
function settingsUnder(over: SchemaRoot, path: string): string[] {
  const node = nodeAt(over, path);
  if (!node) return [];
  if (isPrefLeaf(node)) return pointable(over, path) ? [path] : [];
  return Object.keys(childrenOf(node) ?? {}).flatMap((key) => settingsUnder(over, joinPath(path, key)));
}

/**
 * What a layout takes for the node at tree path `path` of its dialog `over`, and the key it starts under: a pointer
 * to a setting, and for a group a heading under its name over a pointer to each setting it holds at any depth.
 * `undefined` where there is no setting to point at.
 */
export function pointersTo(over: SchemaRoot, path: string): { key: string; node: SchemaNode } | undefined {
  const node = nodeAt(over, path);
  if (!node) return undefined;
  if (isPrefLeaf(node)) return pointable(over, path) ? { key: keyOf(path), node: aliasOf(over, path) } : undefined;
  const settings = settingsUnder(over, path);
  if (settings.length === 0) return undefined;
  const children: ChildMap = {};
  for (const at of settings) children[uniqueKey(children, keyOf(at))] = aliasOf(over, at);
  return { key: keyOf(path), node: { name: node.name, as: 'section', children } as PrefGroup };
}

/** The value path of every setting of `over` that a pointer in `layout` names. */
export function pointedAt(layout: SchemaRoot, over: SchemaRoot): Set<string> {
  return new Set(pointersIn(layout).flatMap(([, pointer]) => pointerTarget(over, pointer)?.path ?? []));
}

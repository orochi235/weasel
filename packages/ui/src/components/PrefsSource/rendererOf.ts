import { getOwn } from '@weasel-js/registry';

/** The first of `keys` that `renderers` names as an own entry: a leaf's path before its kind. */
export function rendererOf<R>(renderers: Readonly<Record<string, R | undefined>> | undefined, ...keys: string[]): R | undefined {
  if (renderers === undefined) return undefined;
  for (const key of keys) {
    const found = getOwn(renderers, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

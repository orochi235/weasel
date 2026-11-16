import { isDev } from '@weasel-js/registry';

/** Every leaf path and leaf kind a schema holds, entries and union variants included. */
function pathsAndKinds(schemas: readonly unknown[]): { paths: Set<string>; kinds: Set<string> } {
  const paths = new Set<string>();
  const kinds = new Set<string>();
  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return;
    const n = node as { kind?: unknown; children?: unknown; members?: unknown; item?: unknown; variants?: unknown };
    if (typeof n.kind === 'string') {
      kinds.add(n.kind);
      if (path) paths.add(path);
    }
    for (const nested of [n.children, n.members]) {
      if (nested === null || typeof nested !== 'object') continue;
      for (const [key, child] of Object.entries(nested)) walk(child, path ? `${path}.${key}` : key);
    }
    walk(n.item, path);
    if (n.variants !== null && typeof n.variants === 'object') for (const v of Object.values(n.variants)) walk(v, path);
  };
  for (const schema of schemas) walk(schema, '');
  return { paths, kinds };
}

const warned = new Set<string>();

/** Warn once per key, in dev, of a `renderers` key that names neither a leaf path nor a leaf kind of `schemas`. */
export function warnUnmatchedRenderers(renderers: Readonly<Record<string, unknown>> | undefined, ...schemas: unknown[]): void {
  if (!isDev() || renderers === undefined) return;
  const keys = Object.keys(renderers).filter((key) => !warned.has(key));
  if (keys.length === 0) return;
  const { paths, kinds } = pathsAndKinds(schemas);
  for (const key of keys) {
    if (paths.has(key) || kinds.has(key)) continue;
    warned.add(key);
    console.warn(`weasel: PrefsForm renderers has a key "${key}", which is neither a leaf path nor a leaf kind in its schema, so it draws nothing. Check the path or kind for a typo.`);
  }
}

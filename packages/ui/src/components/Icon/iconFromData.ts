import { toIconSpec, type IconSpec } from '@weasel-js/icons';
import { isDev } from '@weasel-js/react';

const warned = new Set<string>();

/** A value as JSON, or its type for one JSON cannot write: a BigInt, or a cyclic object such as a React element. */
function written(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return typeof value === 'bigint' ? `${value}n` : Object.prototype.toString.call(value);
  }
}

/**
 * An icon read from data, such as a prefs schema loaded as JSON, as a spec: a `namespace:name` string, or
 * `{ name, mark }` holding two. Anything else reads as none, and a non-empty one warns once in development.
 */
export function iconFromData(value: unknown): IconSpec | undefined {
  const spec = toIconSpec(value);
  if (!spec && value && isDev()) {
    const shown = typeof value === 'string' ? `"${value}"` : written(value);
    if (!warned.has(shown)) {
      warned.add(shown);
      console.warn(`weasel: the icon ${shown} is not qualified, so it draws nothing. Write a name as namespace:name, such as "ui:close", and a name with a mark as { name, mark }.`);
    }
  }
  return spec;
}

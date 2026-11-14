import { toIconSpec, type IconSpec } from '@weasel-js/icons';
import { isDev } from '@weasel-js/react';

const warned = new Set<string>();

/**
 * An icon read from data, such as a prefs schema loaded as JSON, as a spec: a `namespace:name` string, or
 * `{ name, mark }` holding two. Anything else reads as none, and a non-empty one warns once in development.
 */
export function iconFromData(value: unknown): IconSpec | undefined {
  const spec = toIconSpec(value);
  if (!spec && value && isDev()) {
    const shown = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
    if (!warned.has(shown)) {
      warned.add(shown);
      console.warn(`weasel: the icon ${shown} is not qualified, so it draws nothing. Write a name as namespace:name, such as "ui:close", and a name with a mark as { name, mark }.`);
    }
  }
  return spec;
}

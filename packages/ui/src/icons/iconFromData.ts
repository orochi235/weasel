import { toIconRef, type IconRef } from '@weasel-js/icons';
import { isDev } from '@weasel-js/react';

const warned = new Set<string>();

/**
 * An icon name read from data, such as a prefs schema loaded as JSON, as a ref. A name that is not
 * `namespace:name` reads as none, and a non-empty one warns once in development.
 */
export function iconFromData(value: string | undefined): IconRef | undefined {
  const ref = toIconRef(value);
  if (!ref && value && isDev() && !warned.has(value)) {
    warned.add(value);
    console.warn(`weasel: the icon name "${value}" is not qualified, so it draws nothing. Write it as namespace:name, such as "ui:close".`);
  }
  return ref;
}

import { isDev } from '@weasel-js/registry';

const warned = new Set<string>();

/** Report something theme set aside: once per `key`, and only in development. */
export function warnThemeOnce(key: string, message: string): void {
  if (!isDev() || warned.has(key)) return;
  warned.add(key);
  console.warn(`[weasel theme] ${message}`);
}

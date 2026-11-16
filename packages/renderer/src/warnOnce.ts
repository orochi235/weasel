import { isDev } from '@weasel-js/registry';

const warned = new Set<string>();

/** Print `message` in development the first time `key` is seen. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  if (isDev()) console.warn(message);
}

/** Warn once that no source is registered for program `id`. Shares its key
 *  with the draw paths' own missing-program warnings, so one id warns once. */
export function warnMissingProgram(id: string, message: string): void {
  warnOnce(`${id}:(program)`, message);
}

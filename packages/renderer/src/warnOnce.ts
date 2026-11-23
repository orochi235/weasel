import { createWarnOnce } from '@weasel-js/registry';

const warn = createWarnOnce();

/** Print `message` in development the first time `key` is seen, of the last few hundred keys. */
export function warnOnce(key: string, message: string): void {
  warn(message, key);
}

/** Warn once that no source is registered for program `id`. Shares its key
 *  with the draw paths' own missing-program warnings, so one id warns once. */
export function warnMissingProgram(id: string, message: string): void {
  warnOnce(`${id}:(program)`, message);
}

import type { Logger } from 'vite';

// Not @weasel-js/registry's createPart: configs load these plugin files before any workspace package is built.
const said = new WeakMap<Logger, Set<string>>();

/** `logger.warn(message)`, unless that logger has already said it; nothing with no logger yet. */
export function warnOnce(logger: Logger | undefined, message: string): void {
  if (!logger) return;
  let seen = said.get(logger);
  if (!seen) said.set(logger, (seen = new Set()));
  if (seen.has(message)) return;
  seen.add(message);
  logger.warn(message);
}

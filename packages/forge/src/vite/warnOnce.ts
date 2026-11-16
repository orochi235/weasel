import type { Logger } from 'vite';

const said = new WeakMap<Logger, Set<string>>();

/** `logger.warn(message)`, unless that logger has already said it; nothing with no logger yet. */
export function warnOnce(logger: Logger | undefined, message: string): void {
  if (!logger) return;
  const seen = said.get(logger) ?? new Set<string>();
  said.set(logger, seen);
  if (seen.has(message)) return;
  seen.add(message);
  logger.warn(message);
}

import { createPart } from '@weasel-js/registry';
import type { Logger } from 'vite';

const said = createPart((_logger: Logger) => new Set<string>());

/** `logger.warn(message)`, unless that logger has already said it; nothing with no logger yet. */
export function warnOnce(logger: Logger | undefined, message: string): void {
  if (!logger) return;
  const seen = said(logger);
  if (seen.has(message)) return;
  seen.add(message);
  logger.warn(message);
}

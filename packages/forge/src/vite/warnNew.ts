import type { Logger } from 'vite';

// Not @weasel-js/registry's createWarnOnce: configs load these plugin files before any workspace package is built.
const said = new WeakMap<Logger, Map<string, ReadonlySet<string>>>();

/**
 * `logger.warn` of each of `messages` that `logger` did not say under `topic` the last time; nothing with no logger
 * yet. Only the latest messages are kept, so a problem fixed and then brought back is said again.
 */
export function warnNew(logger: Logger | undefined, topic: string, messages: readonly string[]): void {
  if (!logger) return;
  let topics = said.get(logger);
  if (!topics) said.set(logger, (topics = new Map()));
  const before = topics.get(topic);
  const now = new Set(messages);
  topics.set(topic, now);
  for (const message of now) if (!before?.has(message)) logger.warn(message);
}

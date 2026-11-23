import { isDev } from './isDev';

/**
 * A `console.warn` that, in development only, says each message once. It keeps the last `cap` messages
 * it said, so a message embedding something a session mints without end (an id, a key from document
 * data) can't grow it without bound; one pushed out says itself again when it next comes. Given a `key`,
 * it says once per key instead, so messages that differ in their wording count as one.
 */
export function createWarnOnce(cap = 256): (message: string, key?: string) => void {
  const said = new Set<string>();
  return (message, key = message) => {
    if (!isDev() || said.has(key)) return;
    said.add(key);
    if (said.size > cap) said.delete(said.values().next().value!);
    console.warn(message);
  };
}

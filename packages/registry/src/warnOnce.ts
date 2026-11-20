import { isDev } from './isDev';

/**
 * A `console.warn` that, in development only, says each message once. It keeps the last `cap` messages
 * it said, so a message embedding something a session mints without end (an id, a key from document
 * data) can't grow it without bound; one pushed out says itself again when it next comes.
 */
export function createWarnOnce(cap = 256): (message: string) => void {
  const said = new Set<string>();
  return (message) => {
    if (!isDev() || said.has(message)) return;
    said.add(message);
    if (said.size > cap) said.delete(said.values().next().value!);
    console.warn(message);
  };
}

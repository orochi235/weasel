/** A part of a {@link compositeKey}. */
export type KeyPart = string | number | boolean | null | undefined;

/**
 * One string for a tuple of parts, which no other tuple shares: a string part is written with its length first, so
 * no separator it holds can run it into the next part, and a number, a boolean, `null`, and `undefined` each write
 * apart from any string. `0` and `-0` share a key, as they do in a `Map`. The parts come as one array, so a list of
 * any length is one argument.
 */
export function compositeKey(parts: readonly KeyPart[]): string {
  let key = '';
  for (const p of parts) {
    if (typeof p === 'string') key += `${p.length}:${p}`;
    else if (typeof p === 'number') key += `#${p};`;
    else key += p === true ? 't' : p === false ? 'f' : p === null ? 'n' : 'u';
  }
  return key;
}

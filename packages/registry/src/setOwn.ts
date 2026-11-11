/** `record[key] = value` as an own property: assignment to `__proto__` would run its setter and change the
 *  prototype instead, and a key read from outside may be that one. */
export function setOwn<V>(record: Record<string, V>, key: string, value: V): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}

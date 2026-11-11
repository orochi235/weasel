/** `record[key] = value` as an own property: assignment to `__proto__` would run its setter and change the
 *  prototype instead, and a key read from outside may be that one. */
export function setOwn(record: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}

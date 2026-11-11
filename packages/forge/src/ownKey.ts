/** `record[key] = value` as an own property: assignment would run `__proto__`'s setter and change the prototype
 *  instead. */
export function setOwn(record: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}

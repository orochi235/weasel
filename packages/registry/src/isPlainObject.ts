/** Whether `proto` is the prototype a plain object has: `null`, or some
 *  realm's `Object.prototype`. Comparing against this realm's alone misses
 *  objects made in an iframe, a VM context, or by `structuredClone` under jsdom. */
export function isPlainPrototype(proto: object | null): boolean {
  return proto === Object.prototype || proto === null || Object.getPrototypeOf(proto) === null;
}

/** Whether `value` is a plain object — a literal or `Object.create(null)` — from any realm. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && isPlainPrototype(Object.getPrototypeOf(value));
}

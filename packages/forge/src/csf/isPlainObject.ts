/** Whether `value` is a plain object — a literal or `Object.create(null)` — from any
 *  realm. A story's args can come from another frame, so this realm's
 *  `Object.prototype` is not the only one a plain object can have. */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null || Object.getPrototypeOf(proto) === null;
};

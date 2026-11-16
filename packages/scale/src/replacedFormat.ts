/** `self`'s own `format` where it replaced `built`, as `{ ...scale, format }` does, so a scale's `tickFormat` labels
 *  with the format it was given rather than the one it was built with; `null` where it was not replaced. */
export function replacedFormat<T>(
  self: { readonly format?: (value: T) => string } | undefined,
  built: (value: T) => string,
): ((value: T) => string) | null {
  const own = self?.format;
  return own === undefined || own === built ? null : (value) => own.call(self, value);
}

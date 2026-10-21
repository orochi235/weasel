/**
 * Whether a CSS variable override can be declared as given: a custom property name, and a value that cannot close
 * the declaration or the rule around it. A value that could would let whoever sets it write rules of their own.
 */
export function isSafeOverride(name: string, value: string): boolean {
  return /^--[\w-]+$/.test(name) && !/[{};]/.test(value);
}

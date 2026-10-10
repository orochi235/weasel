/** Whether the reader has asked for less motion. False where there is no `matchMedia` to ask. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

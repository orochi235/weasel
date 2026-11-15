/** A control's height and type scale: `sm` is the compact one, for dense chrome; `md` is the default. */
export type ControlSize = 'sm' | 'md';

/**
 * The size a control draws at: its own, else the nearest scope's, else `fallback`. A control's own size wins over
 * any scope, and a scope set inside another wins over the outer one, so a host passes only the innermost it has.
 */
export function resolveSize(
  own: ControlSize | undefined,
  scope: ControlSize | undefined,
  fallback: ControlSize = 'md',
): ControlSize {
  return own ?? scope ?? fallback;
}

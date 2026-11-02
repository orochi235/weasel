/** How an animated trim override lays over a stroke's own trim. */
import type { TrimOverride } from '@weasel-js/animator';
import type { StrokeTrim } from '@weasel-js/paint';

/**
 * `base` with `override`'s edges in place of its own: each edge the override
 * sets becomes that fraction, read by `base`'s `pace`, and an edge it leaves
 * out stays as `base` gives it, an absolute measure included. With no base,
 * the override alone, at the default pace.
 */
export function overrideTrim(
  base: StrokeTrim | undefined,
  override: TrimOverride | undefined,
): StrokeTrim | undefined {
  if (override === undefined || (override.start === undefined && override.end === undefined)) return base;
  return {
    ...base,
    ...(override.start !== undefined ? { start: override.start } : {}),
    ...(override.end !== undefined ? { end: override.end } : {}),
  };
}

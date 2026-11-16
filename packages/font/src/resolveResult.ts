import type { DynamicFace } from './dynamic/dynamicAtlas';
import type { FontStyle } from './fontStyle';
import type { OutlineFace } from './outline/OutlineFace';
import type { FontEntry } from './registerFont';

/** What `resolveFontVariant` found: the atlas to draw with, the face it
 *  actually landed on after walking the fallback chain, and what has to be
 *  synthesized to cover the difference. */
export interface ResolveResult {
  entry: FontEntry | null;
  /**
   * The (family, weight, style) triple that was actually matched. May differ
   * from the requested values when the resolver walked the fallback chain —
   * including `family`, when the cross-family policy substituted a default.
   *
   * This is the atlas identity: pass all three to `getFont` /
   * `textureCacheKey` and the lookup hits. Keying a draw on the *requested*
   * family resolves to no atlas at all and paints nothing.
   *
   * The synthetic flags describe the gap between requested and resolved for
   * shader-side compensation. When `entry` is null, these mirror the
   * requested values.
   */
  resolved: { family: string; weight: number; style: FontStyle };
  synthetic: { bold: boolean; italic: boolean };
  /** Which tier resolved: a baked MSDF atlas, the runtime canvas-SDF dynamic
   *  atlas, or a parsed font face serving both geometry and metrics. Misses
   *  report 'atlas' (the default tier). */
  source: 'atlas' | 'canvas' | 'outline';
  /** Set only when source === 'canvas': the dynamic face whose BmFont-shaped
   *  `font` layoutRuns consumes in place of `entry.font`. */
  dynamicFace?: DynamicFace;
  /** Set only when source === 'outline': the parsed face supplying advances,
   *  kerning and the baseline. There is no atlas behind this tier, so it is
   *  the only metrics source the run has. */
  outlineFace?: OutlineFace;
  /**
   * Set when the requested family was not registered and the fallback policy
   * substituted a different one, so a UI can say "Inter — not loaded, showing
   * Roboto".
   */
  substituted?: { requested: string; resolved: string };
}

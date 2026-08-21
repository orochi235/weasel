/**
 * Shapes one vertical edge of a badge base. Given a position down the edge
 * (`t`, 0 at the top to 1 at the bottom) and the configured depth in CSS px,
 * returns the horizontal displacement of that point, positive to the right.
 */
export type EdgeProfile = (t: number, depth: number) => number;

/** The named edge profiles in {@link EDGE_PROFILES}. */
export type BuiltInEdgeName =
  | 'flat'
  | 'chevron'
  | 'slant'
  | 'slant-up'
  | 'round'
  | 'scallop'
  | 'concave-chevron';

/** An edge profile, either by name or as a function. */
export type EdgeCap = BuiltInEdgeName | EdgeProfile;

/** The built-in {@link EdgeProfile} implementations, by name. */
export const EDGE_PROFILES: Record<BuiltInEdgeName, EdgeProfile> = {
  flat:              (_t, _d) => 0,
  chevron:           (t, d)   => (1 - Math.abs(t - 0.5) * 2) * d,
  slant:             (t, d)   => t * d,
  'slant-up':        (t, d)   => (1 - t) * d,
  round:             (t, d)   => Math.sin(t * Math.PI) * d,
  scallop:           (t, d)   => Math.sin(t * Math.PI * 3) * 0.4 * d,
  'concave-chevron': (t, d)   => -(1 - Math.abs(t - 0.5) * 2) * d,
};

export function resolveEdge(cap: EdgeCap): EdgeProfile {
  if (typeof cap === 'function') return cap;
  return EDGE_PROFILES[cap] ?? EDGE_PROFILES.flat;
}

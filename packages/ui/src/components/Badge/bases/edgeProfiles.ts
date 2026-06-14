export type EdgeProfile = (t: number, depth: number) => number;

export type BuiltInEdgeName =
  | 'flat'
  | 'chevron'
  | 'slant'
  | 'slant-up'
  | 'round'
  | 'scallop'
  | 'concave-chevron';

export type EdgeCap = BuiltInEdgeName | EdgeProfile;

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

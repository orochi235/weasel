/**
 * Shapes one vertical edge of a badge base. Given a position down the edge
 * (`t`, 0 at the top to 1 at the bottom) and the configured depth in CSS px,
 * returns the horizontal displacement of that point, positive to the right.
 */
export type EdgeProfile = (t: number, depth: number) => number;

/** The named edge caps expressible as an {@link EdgeProfile}, in {@link EDGE_PROFILES}. */
export type BuiltInProfileName =
  | 'flat'
  | 'chevron'
  | 'slant'
  | 'slant-up'
  | 'round'
  | 'scallop'
  | 'concave-chevron';

/**
 * Every named edge cap. `puzzle` is a jigsaw tab: a round knob on a narrower
 * neck, protruding from the edge's owner into a matching socket in its
 * neighbor. Its bulb overhangs its neck, so it is not a function of `t` and
 * has no entry in {@link EDGE_PROFILES}.
 */
export type BuiltInEdgeName = BuiltInProfileName | 'puzzle';

/** An edge profile, either by name or as a function. */
export type EdgeCap = BuiltInEdgeName | EdgeProfile;

/** The built-in {@link EdgeProfile} implementations, by name. */
export const EDGE_PROFILES: Record<BuiltInProfileName, EdgeProfile> = {
  flat:              (_t, _d) => 0,
  chevron:           (t, d)   => (1 - Math.abs(t - 0.5) * 2) * d,
  slant:             (t, d)   => t * d,
  'slant-up':        (t, d)   => (1 - t) * d,
  round:             (t, d)   => Math.sin(t * Math.PI) * d,
  scallop:           (t, d)   => Math.sin(t * Math.PI * 3) * 0.4 * d,
  'concave-chevron': (t, d)   => -(1 - Math.abs(t - 0.5) * 2) * d,
};

/** A point on an edge in CSS px: `y` down from the top, `x` displaced outward (right). */
export interface EdgePoint {
  x: number;
  y: number;
}

/**
 * An edge as a polyline from `y = 0` to `y = height`, given the depth and the
 * edge's height in CSS px. Unlike an {@link EdgeProfile}, `y` need not be
 * monotonic, so the edge can double back on itself.
 */
export type EdgePath = (depth: number, height: number) => EdgePoint[];

// Samples per profile edge. 64 is smooth enough for chevron/round caps and
// cheap to evaluate.
const PROFILE_SAMPLES = 64;

function profilePath(profile: EdgeProfile): EdgePath {
  return (depth, height) => {
    const pts: EdgePoint[] = [];
    for (let i = 0; i <= PROFILE_SAMPLES; i++) {
      const t = i / PROFILE_SAMPLES;
      pts.push({ x: profile(t, depth), y: t * height });
    }
    return pts;
  };
}

// Puzzle knob, in units of the bulb radius r: the bulb's center sits BULB_OFFSET
// beyond the edge, and a fillet of radius FILLET rounds each side of the neck.
// With these values the fillets meet the edge exactly one r above and below the
// knob's center, and the tab protrudes (BULB_OFFSET + 1) r.
const PUZZLE_BULB_OFFSET = 1;
const PUZZLE_FILLET = 0.25;
// The knob spans 2r of the edge; keep that within this share of the height.
const PUZZLE_MAX_SPAN = 0.7;
const PUZZLE_ARC_SAMPLES = 24;

/**
 * The `puzzle` cap. The bulb is a circle of radius r centered `c = BULB_OFFSET·r`
 * beyond the edge. Each fillet is a circle of radius f tangent to the edge line
 * (so its center sits f beyond it) and externally tangent to the bulb, so its
 * center is r + f from the bulb's: that fixes the fillet's height above the
 * knob's center at yf = √((r + f)² − (c − f)²), and its tangency with the bulb
 * on the line joining the two centers, f from the fillet's.
 */
export const puzzleEdge: EdgePath = (depth, height) => {
  const sign = Math.sign(depth);
  const r = Math.min(Math.abs(depth) / (PUZZLE_BULB_OFFSET + 1), (height * PUZZLE_MAX_SPAN) / 2);
  if (!(r > 0)) return [{ x: 0, y: 0 }, { x: 0, y: height }];

  const yc = height / 2;
  const c = PUZZLE_BULB_OFFSET * r;
  const f = PUZZLE_FILLET * r;
  const yf = Math.sqrt((r + f) ** 2 - (c - f) ** 2);
  // Fillet center (f, yc − yf); bulb center (c, yc).
  const tangentFromFillet = Math.atan2(yf, c - f);
  const tangentFromBulb = tangentFromFillet - Math.PI;

  const upper: EdgePoint[] = [{ x: 0, y: 0 }, { x: 0, y: yc - yf }];
  for (let i = 1; i <= PUZZLE_ARC_SAMPLES; i++) {
    const a = Math.PI + (tangentFromFillet - Math.PI) * (i / PUZZLE_ARC_SAMPLES);
    upper.push({ x: f + f * Math.cos(a), y: yc - yf + f * Math.sin(a) });
  }
  for (let i = 1; i <= PUZZLE_ARC_SAMPLES; i++) {
    const a = tangentFromBulb * (1 - i / PUZZLE_ARC_SAMPLES);
    upper.push({ x: c + r * Math.cos(a), y: yc + r * Math.sin(a) });
  }
  const lower = upper.slice(0, -1).reverse().map((p) => ({ x: p.x, y: height - p.y }));
  return [...upper, ...lower].map((p) => ({ x: sign * p.x, y: p.y }));
};

const PATHS: Record<BuiltInEdgeName, EdgePath> = {
  ...(Object.fromEntries(
    Object.entries(EDGE_PROFILES).map(([name, profile]) => [name, profilePath(profile)]),
  ) as Record<BuiltInProfileName, EdgePath>),
  puzzle: puzzleEdge,
};

export function resolveEdge(cap: EdgeCap): EdgePath {
  if (typeof cap === 'function') return profilePath(cap);
  return PATHS[cap] ?? PATHS.flat;
}

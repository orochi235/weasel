import type { BadgeProps } from '@orochi235/weasel-ui';

/** A single value within a token set, paired with the props its renderer
 *  needs. The shape of `props` depends on the set's `kind`. */
export interface TokenEntry<P> {
  value: string;
  props: P;
}

interface TokenSetBase {
  id: string;
  label: string;
  /** Short explanation of what enumerated type this set maps over and where
   *  the mapping is consumed in the app. */
  description: string;
}

export interface BadgeTokenSet extends TokenSetBase {
  kind: 'badge';
  entries: readonly TokenEntry<Omit<BadgeProps, 'children'>>[];
}

export interface KeycapsTokenSet extends TokenSetBase {
  kind: 'keycap';
  /** Each entry's `props.parts` feeds `<Keycaps parts={…} />`. */
  entries: readonly TokenEntry<{ parts: readonly string[] }>[];
}

/** Compound token — entries are raw `phase.gesture.target[:modifiers]`
 *  strings the inspector decomposes into per-segment badges. The renderer
 *  lives in `RegistryDetail.tsx` so this file stays View-free. */
export interface RouteTokenSet extends TokenSetBase {
  kind: 'route';
  entries: readonly TokenEntry<{ route: string }>[];
}

export type TokenSet = BadgeTokenSet | KeycapsTokenSet | RouteTokenSet;

// ── slot tone ──────────────────────────────────────────────────────────────

/** Mapping consumed by `ToolkitBuilder` — colors each tool row by the slot
 *  it currently occupies. */
export const SLOT_TONE = {
  active: 'accent',
  ambient: 'warn',
  hotkey: 'info',
  inactive: 'danger',
} as const;

const slotTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'slot-tone',
  label: 'Slot tone',
  description:
    'Tone per tool-routing slot. Used by the Toolkit Builder to color tool rows '
    + 'by where each tool currently mounts.',
  entries: Object.entries(SLOT_TONE).map(([value, tone]) => ({
    value,
    props: {
      shape: 'pill',
      size: 'sm',
      tone,
      variant: value === 'inactive' ? 'solid' : 'outline',
    },
  })),
};

// ── gesture ────────────────────────────────────────────────────────────────

/** Gesture badge family — `RegistryDetail` uses these props whenever it
 *  needs to render a gesture-channel name (e.g. on a tool's phase row).
 *  One consistent style across every gesture so the family reads as a
 *  group at a glance. */
export const GESTURE_BADGE_PROPS: Omit<BadgeProps, 'children'> = {
  shape: 'ribbon',
  shapeParams: { left: 'inward', right: 'outward' },
  size: 'sm',
  tone: 'info',
  variant: 'outline',
};

const GESTURE_VALUES = ['click', 'pointerDown', 'dblTap', 'drag', 'wheel', 'keyDown', 'keyUp'] as const;

const gestureTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'gesture',
  label: 'Gesture',
  description:
    'One consistent style for every gesture channel. Used wherever a gesture '
    + 'name appears in the Bundle Inspector so the family reads at a glance.',
  entries: GESTURE_VALUES.map((value) => ({ value, props: GESTURE_BADGE_PROPS })),
};

// ── phase ──────────────────────────────────────────────────────────────────

/** Phase badge family — applied wherever the inspector names a lifecycle
 *  phase (`initial`, `engaged`). Ribbons with a flat left edge and an
 *  outward-pointing right edge — reads as a "phase leading into something",
 *  visually mirroring how routes are read left-to-right (phase → gesture → target). */
export const PHASE_BADGE_PROPS: Omit<BadgeProps, 'children'> = {
  shape: 'ribbon',
  shapeParams: { left: 'flat', right: 'outward' },
  size: 'sm',
  tone: 'accent',
  variant: 'subtle',
};

/** Channel badge — leading chip when a phase atom names a tool/wildcard
 *  channel other than the implicit `&` ("this tool's own phase"). Muted
 *  tone so it reads as context for the phase chip that follows it. */
export const CHANNEL_BADGE_PROPS: Omit<BadgeProps, 'children'> = {
  shape: 'ribbon',
  shapeParams: { left: 'flat', right: 'flat' },
  size: 'sm',
  tone: 'neutral',
  variant: 'subtle',
};

const PHASE_VALUES = ['initial', 'engaged'] as const;

const phaseTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'phase',
  label: 'Phase',
  description:
    'Lifecycle phases a `ToolDef` may declare routes in. One consistent style '
    + 'wherever a phase name appears (per-tool phase rows, gesture / phase-output details).',
  entries: PHASE_VALUES.map((value) => ({ value, props: PHASE_BADGE_PROPS })),
};

// ── boolean ────────────────────────────────────────────────────────────────

/** Per-truthiness props for boolean fields surfaced in the inspector. */
export const BOOLEAN_BADGE_PROPS = {
  true: { shape: 'pill', size: 'sm', tone: 'accent', variant: 'solid' },
  false: { shape: 'pill', size: 'sm', tone: 'muted', variant: 'subtle' },
} as const satisfies Record<'true' | 'false', Omit<BadgeProps, 'children'>>;

const booleanTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'boolean',
  label: 'Boolean',
  description:
    'Yes/no rendering for boolean fields (e.g. tool capability flags, claimsAll). '
    + 'True reads as a positive accent; false fades into the panel.',
  entries: [
    { value: 'true', props: BOOLEAN_BADGE_PROPS.true },
    { value: 'false', props: BOOLEAN_BADGE_PROPS.false },
  ],
};

// ── bundle id ──────────────────────────────────────────────────────────────

/** Per-bundle badge — tones grade from muted (minimal) to accent (exhaustive)
 *  to convey the deliberate progression the bundles encode. */
export const BUNDLE_BADGE_PROPS = {
  minimal:    { shape: 'pill', size: 'sm', tone: 'muted',  variant: 'outline' },
  standard:   { shape: 'pill', size: 'sm', tone: 'info',   variant: 'outline' },
  exhaustive: { shape: 'pill', size: 'sm', tone: 'accent', variant: 'outline' },
} as const satisfies Record<string, Omit<BadgeProps, 'children'>>;

const bundleTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'bundle',
  label: 'Bundle id',
  description:
    'Named tool presets passable as `SceneCanvas.toolBundle`. Tone grades from '
    + 'muted → info → accent to reflect the minimal → standard → exhaustive progression.',
  entries: (Object.entries(BUNDLE_BADGE_PROPS) as [keyof typeof BUNDLE_BADGE_PROPS, Omit<BadgeProps, 'children'>][])
    .map(([value, props]) => ({ value, props })),
};

// ── entry kind ─────────────────────────────────────────────────────────────

/** Label applied wherever a detail panel needs to declare what kind of entry
 *  it is describing (e.g. "shape", "op factory"). One consistent style so the
 *  "kind" dt/dd row reads uniformly across panels. */
export const KIND_BADGE_PROPS: Omit<BadgeProps, 'children'> = {
  shape: 'plaque',
  size: 'sm',
  tone: 'muted',
  variant: 'outline',
};

const KIND_VALUES = [
  'tool', 'action', 'shape', 'bundle', 'icon', 'op factory', 'public export',
  'phase', 'gesture', 'phase output', 'op kind', 'slot',
  'route target', 'modifier set', 'group',
] as const;

const kindTokenSet: BadgeTokenSet = {
  kind: 'badge',
  id: 'entry-kind',
  label: 'Entry kind',
  description:
    'Identifies what kind of catalog entry a detail panel is describing. One '
    + 'consistent style across every kind so the "kind" row reads uniformly.',
  entries: KIND_VALUES.map((value) => ({ value, props: KIND_BADGE_PROPS })),
};

// ── route ──────────────────────────────────────────────────────────────────

/** Sample routes used by the Tokens panel to preview the compound renderer.
 *  Routes are the `phase.gesture.target[:modifiers]` strings emitted by
 *  `buildActionRegistry` — they don't live in a closed set, so this is just
 *  a representative slice. */
const ROUTE_SAMPLES = [
  '[initial] click => empty',
  '[initial] drag => node',
  '[initial] drag => node +shift',
  '[initial] keyDown(Escape)',
  '[engaged] drag',
  '[initial] wheel +mod',
] as const;

const routeTokenSet: RouteTokenSet = {
  kind: 'route',
  id: 'route',
  label: 'Route',
  description:
    'Compound `phase.gesture.target[:modifiers]` signature decomposed into its '
    + 'sub-tokens. Used in tool / route-target / modifier-set detail panels.',
  entries: ROUTE_SAMPLES.map((value) => ({ value, props: { route: value } })),
};

export const TOKEN_SETS: readonly TokenSet[] = [
  slotTokenSet,
  gestureTokenSet,
  phaseTokenSet,
  routeTokenSet,
  booleanTokenSet,
  bundleTokenSet,
  kindTokenSet,
];

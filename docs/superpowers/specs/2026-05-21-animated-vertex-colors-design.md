# Animated vertex colors — design

**Status:** Draft, awaiting implementation
**Tier:** P1 follow-up to per-anchor path coloring (shipped 2026-05-10)
**Spec date:** 2026-05-21

## Background

`createPathLayer` exposes `getVertexColors` (fill) and `getStrokeVertexColors` (stroke) accessors that return flat RGBA `Uint8Array`s sized to the path's anchor count. The renderer arc-length-interpolates between consecutive anchor colors across the flattened/tessellated mesh. Today these arrays are read once per render and are static unless the consumer mutates `data`.

The animation module (`src/animation/`) ships `useAnimator`, easings, `tween`/`spring`/`loop`/`tweenLoop`/`stagger`, and pose helpers (`tweenPose`, `springPose`). Vertex colors are not yet plumbed through.

## Goal

Let consumers tween, spring, cycle, and stagger per-anchor color arrays without mutating scene `data`. The kit keeps `data` canonical; animation runs as an overlay that the renderer consults during draw.

## Non-goals

- Animating gradient stops on `FillStyle` gradient variants (different data shape).
- Multi-override composition (e.g. cycle + flash simultaneously). One override per `(id, channel)`; last write wins.
- Perceptual interpolation beyond OKLCH (P3, Rec2020). Escape hatch supports them via custom interpolator.

## Architecture

Three new pieces, plus one small renderer-side wrap.

### 1. `ColorOverrideRegistry`

Lives on the animator instance, returned alongside the existing animator API. Shape:

```ts
type ColorOverride = Uint8Array | ((base: Uint8Array, tMs: number) => Uint8Array);

interface ColorOverrideRegistry {
  set(id: string, channel: 'fill' | 'stroke', override: ColorOverride): void;
  clear(id: string, channel: 'fill' | 'stroke'): void;
  get(id: string, channel: 'fill' | 'stroke'): ColorOverride | undefined;
}
```

Backed by `Map<string, { fill?: ColorOverride; stroke?: ColorOverride }>`. Mutation bumps a version counter that the renderer reads to invalidate caches.

Exposed at `useAnimator()` return as `.colorOverrides`. Cleared automatically on animator unmount.

### 2. Renderer integration

`createPathLayer`'s color-resolution accessors wrap the consumer's `getVertexColors` / `getStrokeVertexColors`:

```ts
const base = getVertexColors(node);
const override = animator?.colorOverrides.get(node.id, 'fill');
const colors =
  typeof override === 'function'
    ? override(base ?? FALLBACK, nowMs)
    : (override ?? base);
```

The `animator` reference reaches `createPathLayer` via a new optional field on the layer-factory options bag (exact plumbing to be confirmed during implementation; precedent: how `useAnimator` already coordinates with `WeaselRenderer`'s render loop).

Function-form overrides receive `nowMs` so cycle/stagger don't have to call `performance.now()` themselves.

#### GL mesh cache invalidation

`GLMeshCache` keys today incorporate vertex-color identity. For nodes with an active override, the cache bypasses entirely — animated colors change every frame, so caching them is pointless. Implementation-level: a quick `registry.get(id, channel) !== undefined` check skips the cache lookup/insert path. Profile-driven optimization (memoizing function-override results within a single frame if multiple draw passes need them) is deferred.

### 3. Helper functions (`src/animation/colorHelpers.ts`)

Four functions, parallel in shape to `tweenPose` / `springPose`.

#### `tweenVertexColors`

```ts
interface TweenVertexColorsOptions {
  id: string;
  channel: 'fill' | 'stroke';
  to: Uint8Array;
  from?: Uint8Array;
  ms: number;
  easing?: EasingFn;
  interpolation?: 'rgb' | 'oklch';   // default: 'rgb'
  interpolate?: (from: Uint8Array, to: Uint8Array, t: number) => Uint8Array;
  onDone?: () => void;
}

function tweenVertexColors(
  animator: Animator,
  opts: TweenVertexColorsOptions,
): AnimationHandle;
```

If `from` is omitted, the helper reads the layer's current colors via the same accessor the renderer uses, capturing a snapshot at call time. Registers an array override that updates each tick. Unregisters `onDone`.

If `interpolate` is passed, it wins over `interpolation`.

Length validation: `from.length === to.length === anchorCount * 4`. Mismatch throws synchronously.

#### `springVertexColors`

```ts
interface SpringVertexColorsOptions {
  id: string;
  channel: 'fill' | 'stroke';
  to: Uint8Array;
  from?: Uint8Array;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolation?: 'rgb' | 'oklch';
  interpolate?: (from: Uint8Array, to: Uint8Array, t: number) => Uint8Array;
  onDone?: () => void;
}
```

Same shape as `tweenVertexColors`, spring dynamics. Mirrors `springPose`'s integrate-progress-then-lerp pattern (avoids requiring add/subtract/scale ops on the color array — we lerp at the byte level on every tick).

#### `cycleVertexColors`

```ts
interface CycleVertexColorsOptions {
  id: string;
  channel: 'fill' | 'stroke';
  msPerCycle: number;       // duration for phase to advance by anchor-count steps
  direction?: 1 | -1;       // default +1
  easing?: EasingFn;        // applied per-cycle to phase (default linear)
  interpolation?: 'rgb' | 'oklch';
  interpolate?: (from: Uint8Array, to: Uint8Array, t: number) => Uint8Array;
}
```

Registers a function override `(base, tMs) => rotated`. Internally:

```ts
const n = base.length / 4;
const phase = ((tMs / msPerCycle) * n * direction) % n;     // 0..n
const phaseInt = Math.floor(phase);
const phaseFrac = phase - phaseInt;
// out[i] is the lerp between base[(i + phaseInt) % n] and base[(i + phaseInt + 1) % n] at t=phaseFrac
```

Fractional phase lerps between adjacent indices using the selected color space. Returns a handle whose `cancel()` removes the override.

#### `staggerVertexColors`

```ts
interface StaggerVertexColorsOptions {
  id: string;
  channel: 'fill' | 'stroke';
  to: Uint8Array;
  from?: Uint8Array;
  anchorMs: number;
  perAnchorDelay: number;
  origin?: 'first' | 'last' | number;   // default: 'first'
  easing?: EasingFn;
  interpolation?: 'rgb' | 'oklch';
  interpolate?: (from: Uint8Array, to: Uint8Array, t: number) => Uint8Array;
  onDone?: () => void;
}
```

Drives `animator.stagger`. Override is a function that, each tick, computes per-anchor local progress:

```ts
const distance = Math.abs(anchorIndex - originIndex);
const startMs = distance * perAnchorDelay;
const localT = clamp((tMs - startMs) / anchorMs, 0, 1);
```

then writes lerped RGBA into the output array. Fires `onDone` and unregisters when the last anchor reaches `localT === 1`.

### 4. Color-space utilities (`src/animation/colorSpaces.ts`)

Pure math, no kit deps. ~80 lines.

- `srgbU8ToOklab(r: u8, g: u8, b: u8): [L, a, b]` — sRGB byte → linear (via 256-entry LUT) → OKLab via Björn Ottosson's reference matrices.
- `oklabToSrgbU8(L: number, a: number, b: number): [r: u8, g: u8, b: u8]` — inverse, with gamut clip ("preserve L, binary-search reduce C until in sRGB gamut", ≤5 iters).
- `lerpOklab(from: [L,a,b], to: [L,a,b], t: number): [L,a,b]` — straight component lerp in OKLab.
- `lerpColorArray(from: Uint8Array, to: Uint8Array, t: number, space: 'rgb' | 'oklch'): Uint8Array` — exported utility; the helpers' default interpolators delegate to this. Public, so consumers can use it for custom interpolation needs.

Alpha is always lerped linearly (no perceptual model applies).

## Module layout

```
src/animation/
  colorHelpers.ts          # tween/spring/cycle/stagger
  colorRegistry.ts         # ColorOverrideRegistry, attached to useAnimator
  colorSpaces.ts           # OKLab math + lerpColorArray
  colorHelpers.test.ts
  colorSpaces.test.ts
  colorRegistry.test.ts
```

Re-export from `src/animation/index.ts`:

```ts
export {
  tweenVertexColors, springVertexColors, cycleVertexColors, staggerVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions,
  type CycleVertexColorsOptions, type StaggerVertexColorsOptions,
} from './colorHelpers';
export { type ColorOverrideRegistry, type ColorOverride } from './colorRegistry';
export { lerpColorArray, srgbU8ToOklab, oklabToSrgbU8, lerpOklab } from './colorSpaces';
```

## Testing

**`colorSpaces.test.ts`:**
- Round-trip: every byte triple `srgbU8ToOklab → oklabToSrgbU8` stays within ±1 u8 per channel.
- Known landmarks: pure red, green, blue, white, black produce expected OKLab coordinates (cross-check against published values).
- Red↔green midpoint: RGB midpoint is gray (`{128, 128, 0}`-ish); OKLCH midpoint is not gray (asserts L > 0.6 and C > 0.05). This is the explicit "why OKLCH" test.
- Gamut clip: a synthetic OKLab value outside sRGB clips to the boundary; L preserved within ±0.01.

**`colorRegistry.test.ts`:**
- `set` then `get` round-trips arrays and functions.
- `clear` removes a single channel without affecting the other.
- Version counter increments on set/clear.

**`colorHelpers.test.ts`** (each helper run twice: `'rgb'` and `'oklch'`):
- Length-mismatch throw at call time.
- Tween: t=0 → from, t=0.5 → expected midpoint (per-space), t=1 → to. `onDone` fires; override cleared.
- Spring: settles within tolerance of `to`; `onDone` fires; override cleared.
- Cycle: phase wraps correctly at integer steps; fractional phase produces expected blend between adjacent indices; `cancel()` removes override.
- Stagger: origin='first', origin='last', origin=N produce correct anchor delay schedule; `onDone` fires after slowest anchor.

**Integration test (rendering):**
- Mount a path with a tween active, advance mock time, snapshot the renderer's resolved color array and assert it matches the expected lerp at the queried t. Validates registry → renderer wiring end-to-end.

## Demo

Extend `apps/swillustrator/.../BezierEditDemo` (or whichever demo currently shows the rainbow S-curve) with three controls in a small overlay panel:

- **Tween** — button: tween rainbow → solid red over 800ms, then a follow-up button to tween back.
- **Cycle** — toggle: rainbow chases along the stroke at 1500ms/cycle. Includes an `interpolation: 'oklch'` checkbox so the visual difference is observable.
- **Stagger** — button: ripple from clicked anchor outward, 200ms per anchor, anchorMs=400.

One demo covers tween, cycle, stagger; spring is covered by unit tests + `tweenPose`/`springPose` parity (same `Animator.spring` underneath).

## Performance budget

Per-color OKLab round-trip: ~30 muls + 20 adds + 1 cbrt + 1 pow + ≤5 gamut-clip iterations. Worst-case stagger of 200 anchors × 60fps × 2 channels ≈ 24K conversions/sec, well under 1ms/frame on modern hardware. No SIMD in v1.

GL cache bypass for overridden nodes means animated paths re-tessellate-and-color each frame; today's tessellation cost dominates conversion cost. If profiling flags this, options include (a) memoizing function-override output within a single frame across multiple draw passes, or (b) caching the tessellated mesh separately from the per-vertex color attribute (color updates without re-tessellating). Deferred.

## Open questions

1. **Exact plumbing of `animator` reference into `createPathLayer`.** The renderer already coordinates with `useAnimator` for the rAF loop; the path-layer factory needs to consult the registry too. Resolved during implementation — most likely a new optional field on the layer factory's options bag, populated by `Canvas` / `SceneCanvas` from its `useAnimator` context.

2. **Hot-cache strategy if profiling flags re-tessellation cost.** Mesh-with-color-attribute separation has precedent in WebGL toolchains but is a significant refactor of `GLMeshCache`. Defer until measured.

## Out of scope (deferred follow-ups)

- **Gradient-stop animation.** Animating `FillStyle` gradient stops is a different data shape (stop offsets + colors, not flat RGBA-per-anchor). Worth its own design.
- **Multi-override composition.** Combining cycle + flash on the same `(id, channel)` requires a stacking model. v1 is last-write-wins.
- **HSL interpolation.** OKLCH supersedes HSL for perceptual lerping. Consumers needing HSL pass a custom `interpolate`.
- **P3 / Rec2020 gamut.** Same escape hatch.

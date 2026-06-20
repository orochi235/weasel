# Geometry Kernel — Representation & Architecture (Spec 1 of 2)

Date: 2026-06-20
Status: design, pending implementation plan
Branch: `feat/geometry-kernel`

## Summary

Extract weasel's scattered 2D geometry math into a standalone, dependency-disciplined
package `@weasel-js/geom`. This spec ratifies the **canonical representation** and the
**kernel architecture**, and pins the **regression-test contract** that gates the
follow-up migration. It deliberately does **not** carry the migration itself — re-pointing
the seven canonical ops, deleting duplicates, and fixing the resize-after-boolean bug live
in Spec 2 (`...-geometry-migration-design.md`), written and executed against this foundation.

Companion analysis: `2026-06-20-geometry-consolidation-analysis.md` (same dir) — the seven canonical seams, the
geometry-representation split, the 13 ranked work items. This spec is the foundation those
work items build on.

## Motivation

Geometry math is spread across `features/paths/`, `canvas/`, `interactions/actions/`, and
`core/viewport/`, applied to four different layer structs (`Path`, `DrawCommand`, pose,
`view`+DOM). The same primitives are reimplemented in incompatible forms — most visibly two
**byte-identical** `pointInPolygon`s and two `segmentsCross`es, one written against
interleaved `number[]` and one against `{x,y}[]`. There is no principled boundary between
the flat-array regime and the struct regime, and nothing enforces that geometry stays
dependency-free, so it keeps re-tangling with the layers above it.

The root cause of the headline bug (resize-after-boolean: a polygon-content node scales its
AABB but not its contents) is the *absence* of this abstraction: "rebase a path into a pose
box" is expressed as translate-only for polygons instead of as a box→box affine. A kernel
that expresses it as an affine makes the bug unrepresentable.

## Non-goals

- **Not** re-pointing the seven ops / dedup deletions / the resize fix — that is Spec 2.
- **Not** reimplementing a polygon clipper — we keep the `polygon-clipping` dependency.
- **Not** changing `Path`'s on-the-wire storage (stays `Float32Array` coords / `Uint8Array`
  commands) or the SVG serialization format.
- **Not** introducing a build step for the package — it is a source-exported workspace like
  the existing subpackages.

## Decisions (ratified during brainstorming)

### 1. Representation: flat everywhere in the kernel

`Path` already commits to flat typed-array storage (`coords: Float32Array`,
`commands: Uint8Array`) for monomorphic hot loops and low GC — that decision stands and the
kernel adopts it as canonical.

- Kernel polyline / coord-stream / curve ops operate **only** on flat interleaved arrays. No
  per-vertex structs. The `{x,y}[]` array form is **banned** — it pays both a struct alloc
  per vertex and defeats the `Float32Array` intent.
- The two redundant single-point types (`Vec2` in `polygonHitTestRect.ts`, `Point` in
  `cubicMath.ts`) are **deleted**, not consolidated. The kernel core has no point struct.
- Single-point **returns** use `[x, y]` tuples for cold one-offs and out-params /
  return-into-scratch for hot paths. Single-point **inputs** are scalar pairs (`f(px, py)`),
  which allocate nothing.
- Accepted cost: scalar-pair signatures forgo the argument-transposition safety a struct
  would give. Mitigated by low arity, the property tests below, and degree-elevation (one
  curve type). The `{x,y}` ergonomic win is otherwise recoverable with a one-line accessor.
- `{x,y}` survives **only** in the weasel-side wrapper layer (and the public consumer API),
  where DOM/consumer interop (`getBoundingClientRect`, pointer events) makes it natural. The
  kernel staying pure-flat is orthogonal to that.

### 2. Precision: f64 compute, f32 storage

A JS `number` is an f64. Reading out of a `Float32Array` into a local yields f64; arithmetic
is f64; narrowing happens **only** on store back into a `Float32Array`. So "compute in f64"
is automatic — the rule is simply *don't narrow intermediates early*.

- Kernel **computes and returns f64** (plain numbers / `Float64Array` scratch).
- `Path` storage **stays f32**. The f64→f32 narrowing happens only at **commit**
  (`worldEditToStorage`), which is cold. Rendering never narrows per-vertex — it applies the
  transform via the matrix at draw time, not by rewriting coords.
- f64-throughout (incl. storage) is rejected: 2× memory on the hottest structure, and WebGL
  vertex buffers are f32 anyway, so it buys rendering nothing.
- **Epsilon policy:** epsilons must be f32-scale (~1e-6 relative), since stored coords carry
  ~7 significant digits. A fixed absolute epsilon breaks at large coordinate magnitudes (f32
  ULP at 100k units is ~0.008), so the kernel uses a **magnitude-scaled (relative)** epsilon,
  defined once as a named policy constant + helper. Comparing f64-tight epsilons against
  f32-stored data is the one concrete footgun; the policy exists to prevent it.

### 3. Tiers: the kernel owns all three, on a shared base

Geometry ops fall into three categories stacked on one shared scalar+Mat3 base:

```
scalar/vector  (cross, dot, sub, len²)              ← the bottom; everyone uses it
Mat3           (build, compose, invert, apply, boxToBox)
   ├─ affine tier    = Mat3 applied to a coord stream; commands untouched
   ├─ curve tier     = eval + flatten + extrema + split
   └─ polyline tier  = point-in-polygon + seg-cross + pt-seg-dist
```

- **Affine tier** is exact and needs **no flattening** — affine maps send béziers to béziers
  with transformed control points (weasel poses are all affine). The hot ops (move / resize /
  rotate / flip) live here and never flatten.
- **Curve tier** owns bezier eval, flatten, extrema-for-tight-bounds, split. **Quadratics are
  degree-elevated to cubics** (a Q is exactly a C via control-point elevation) so the tier
  handles one curve type, with lines as the degenerate case — this removes the cubic/quad
  fork.
- **Polyline tier** needs straight edges; **flatten is the bridge** down from curve/affine
  into polyline. The kernel owns flatten and its tolerance.
- Internal duplication is near-zero by construction: `cross`/`dot` written once, reused by the
  crossing predicate, flatten's flatness test, segment-intersection, and point-segment
  distance. The flat-everywhere decision *forces* the two `pointInPolygon`s and two
  `segmentsCross`es into one each — there is no second representation to fork into.
- **Justified exceptions:** if a specific hot loop needs a hand-inlined copy of a primitive
  for monomorphism, it is allowed as a **measured, documented** exception — not assumed.

### 4. Command-stream encoding moves into the kernel

The kernel curve form is `(commands: Uint8Array, coords: Float32Array | Float64Array)` passed
as positional args — structurally identical to `PolygonPath`'s internals minus the wrapper.
weasel passes `path.commands, path.coords` straight through with **zero conversion**; the
kernel never imports the `Path` *type*.

- The command-code constants (`PATH_M`, `PATH_L`, `PATH_C`, `PATH_Q`, `PATH_Z`,
  `PATH_CMD_LENGTHS`) **move into `@weasel-js/geom`**; `features/paths/types.ts` re-exports
  them. Ownership statement: the command-stream encoding is a geometry concern; `Path` is a
  thin weasel wrapper adding only `kind` discrimination + `fillRule`.
- `RectPath` stays a wrapper-side fast path; its `{x,y,w,h}` expands to a 4-point contour
  only when a polyline op actually needs it.

### 5. Booleans: geometry half in, action half out

- `pathUnion` / `pathIntersect` / `pathSubtract` / `pathExclude` / `pathDivide` + their
  Path↔clipper adapter (today `features/paths/booleans.ts` + `booleans.adapter.ts`) are
  generic 2D geometry and a polyline-tier consumer (flatten → clip → reconstruct). They move
  into the kernel.
- They live in a **`@weasel-js/geom/booleans` subpath**, the **only** place `polygon-clipping`
  is a dependency. The core stays `deps: {}`.
- The clipper speaks `[x,y][][]` nested arrays — the alloc-heavy form the flat rule bans. That
  conversion is unavoidable against the third-party API; it is isolated in the one adapter and
  is *why* booleans are a separate submodule rather than core.
- The **action layer** (`interactions/actions/booleans/booleans.ts` — undoable op, node
  minting, scene wiring) stays put and *calls* the kernel.
- The existing bezier-flatten lossiness in booleans (output is M/L/Z only) is a pre-existing
  v1 limitation that is centralized, not changed.

### 6. Packaging: `packages/geom`, source-exported, dependency-walled

A real subpackage from the start (not internal-first). Rationale:

- The package boundary is the **only** enforcement of the dependency direction — the kernel
  physically cannot import from `canvas/` / `interactions/` / `features/`. There is no
  import-boundary lint tooling in the repo today; a lint rule would be the half-measure, the
  package wall is the compile-time guarantee. Enforcing that direction is the whole point.
- Subpackages here are **source-exported workspaces** (`@weasel-js/svg` exports
  `"./src/index.ts"`, `deps: {}`), so there is no per-package build/dts friction during
  development. The dts-inlining concern is publish-time for `core` and already solved.
- 11 subpackages already exist; adding one is routine. `@weasel-js/svg` is a direct
  precedent — a zero-dep geometry-neighbor whose `pathAabb`/`pathBounds` shims can eventually
  delegate to geom.

Package layout:

| Export | Contents | Deps |
|---|---|---|
| `@weasel-js/geom` | scalar/vector, Mat3, box, curve (eval/flatten/extrema/split), polyline (pt-in-poly, seg-cross, pt-seg-dist), command-stream constants, epsilon policy | `{}` |
| `@weasel-js/geom/booleans` | `pathUnion`/`Intersect`/`Subtract`/`Exclude`/`Divide` + Path↔clipper adapter | `polygon-clipping` |

## Architecture

`packages/geom/src/` (illustrative; exact file split decided in the plan):

- `scalar.ts` — `cross`, `dot`, `sub`, `len2`, the epsilon policy (`EPS`, `approxEq`,
  magnitude-scaled comparison).
- `mat3.ts` — `Mat3` build / compose / invert / apply, `boxToBox(a, b): Mat3`, rotate-about-point.
- `box.ts` — bounds-of-points, union, contains, box↔box.
- `commands.ts` — `PATH_M…PATH_Z`, `PATH_CMD_LENGTHS`, command-stream walk helpers.
- `curve.ts` — cubic eval (de Casteljau), Q→C elevation, flatten (subdivision + flatness
  predicate), extrema-for-bounds (derivative roots), split-at-t.
- `polyline.ts` — `pointInPolygon` (even-odd raycast), `segmentsCross`, `pointSegmentDist2`,
  bounds-of-polyline; one shared `edgeCrossesUpward` predicate.
- `affine.ts` — apply a `Mat3` to a coord stream (commands untouched).
- `index.ts` — core barrel.
- `booleans/` — `index.ts` (`pathUnion` …), `adapter.ts` (coords ↔ `MultiPolygon`).

Dependency direction is strictly inward: `@weasel-js/core` (and `features/paths`) depend on
`@weasel-js/geom`; never the reverse.

### Where the seven seams will land (preview — implemented in Spec 2)

| Seam | Kernel primitive(s) it composes on | Wrapper home (stays weasel-side) |
|---|---|---|
| 1 project-path-to-pose-frame | `boxToBox` + affine-on-coords | `features/paths/pathInWorld.ts` |
| 2 project-path-to-world | seam 1 + rotate-about-AABB-center | same |
| 3 world-edit-to-storage | Mat3 invert + seam 1 | same |
| 4 bounds-of-path | curve extrema / polyline bounds | same |
| 5 rotate-about-AABB-center | Mat3 rotate-about-point | `canvas/poseRotation.ts` (DrawCommand wrap stays render-side) |
| 6 hit-test point-in-pose | Mat3 invert + pt-in-polygon / pt-in-box | `canvas/SceneCanvas/poseGeometry.ts` (silhouette dispatch stays) |
| 7 client↔world | Mat3 invert + apply | new `core/viewport/clientToWorld.ts` (DOM rect subtraction stays) |

The irreducible per-seam glue (DrawCommand wrapping #5, silhouette dispatch #6, DOM rect #7)
stays in its layer home and calls the kernel. The kernel does not absorb it.

## Regression-test contract (the gate)

The kernel ships with property tests over its own primitives (affine round-trips, `boxToBox`
composition, Q→C elevation exactness, flatten convergence under tolerance, point-in-polygon
agreement on non-convex shapes). These are pure number-in/number-out and do not depend on any
weasel layer.

In addition, this spec pins the **geometry contract test** that Spec 2's resize fix must
satisfy — authored here so it is the agreed gate before any migration begins. It is
parametrized FACTORIES × OPS and must **fail today** for polygon-content nodes:

- FACTORIES: rect, ellipse, star, polygon, pen, boolean-union, boolean-intersect,
  boolean-subtract, slice-piece.
- OPS: resize-2x, resize-nonuniform, move, nudge, rotate-30, flip-x.
- Core assertions per (factory, op):
  - `afterWorld` is the affine image of `beforeWorld` under the *same* map applied to the pose
    (catches "box scaled, contents not" — the anchor bug).
  - `boundsOfPath(afterWorld) ≈ aabbOf(after.pose)` (contents fill the pose box — the
    invariant resize currently violates for polygons).
  - rotate∘resize on a rotated polygon catches the `applyPoseToObj` shear.
- Two narrow cross-tests: align vs resize derive the same union frame (locks the
  `unionBounds` dedup); corner→anchor encode/decode agreement on a rotated pose.

Locations: `packages/geom/src/__tests__/*.test.ts` (pure kernel) and, for the contract test,
a kit-level `src/interactions/actions/__tests__/geometryContract.test.ts` plus a mirror in
`apps/draw/src/__tests__/` that exercises the actual apps/draw `SceneCanvas` wiring (the bug
is specifically that apps/draw wires no projection).

## Open questions deferred to Spec 2

- Whether the resize action has the node's `data` in scope at the projection call site
  (determines kit-level vs app-side fix for the resize bug). Verify in `resize.ts`.
- `poseContainsRotated` public promotion — only if a standalone consumer needs it.
- The flatten-cache strategy for hit-testing in pointermove loops (memoize flattened contour
  per path version) — a wrapper-layer concern, kept out of the kernel.

## Risks

- **Churn of moving the command constants** rewrites imports across `features/paths` and any
  consumer of `PATH_*`. Mechanical, but wide; gated by the existing path-test suite.
- **f32/f64 epsilon mismatches** if any migrated comparison keeps an f64-tight epsilon against
  f32 data — caught by the magnitude-scaled policy and the property tests.
- **Boolean adapter representation boundary** is the one place the flat rule is suspended;
  isolated to `booleans/adapter.ts` and covered by the existing boolean tests.

# Path boolean operations — design

Status: design, awaiting user approval before implementation plan.

Promoted from Tier 3 by consumer demand. Background and motivation:
`docs/TODO.md` → "Active priority — path boolean operations (Pathfinder)".

## Goal

Ship the **core four** polygon-boolean operations plus **Divide** as pure
functions over `Path`, and expose them as a multi-selection-driven action
hook `useBooleans`. v1 is destructive (Illustrator "Unite" semantics): the
hook replaces the source paths with one (or, for Divide, several) new path
in a single undoable batch.

The remaining Pathfinder companion ops (Crop, Outline, Trim, Merge) and the
non-destructive variant (Figma-style boolean groups) are out of scope; they
move to medium-priority TODO entries.

## Scope

**In:** `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`,
`pathDivide`; `useBooleans` hook; an engine adapter over
`polygon-clipping`; unit tests; one Playwright visual baseline.

**Out:**

- Non-destructive boolean groups (a new layer type with renderer changes).
- Crop / Outline / Trim / Merge companion ops.
- True curve booleans (Bezier-preserving). v1 flattens curves before
  clipping and returns straight-line geometry.
- Stroke-to-fill (needed for "boolean ops on strokes").
- Live preview during the gesture.
- Pathfinder against text glyphs.

## API surface

### Pure functions — `src/features/paths/booleans.ts`

```ts
// Commutative — N inputs, single output.
export function pathUnion(...paths: Path[]): PolygonPath;
export function pathIntersect(...paths: Path[]): PolygonPath;
export function pathExclude(...paths: Path[]): PolygonPath; // XOR

// Asymmetric — 2 inputs, single output. Returns `a − b`.
export function pathSubtract(a: Path, b: Path): PolygonPath;

// One-to-many — N inputs, fractured to maximal non-overlapping regions.
export function pathDivide(...paths: Path[]): PolygonPath[];
```

Conventions:

- **Inputs** accept `Path` (either `RectPath` or `PolygonPath`). Rects are
  converted to polygons internally; the result is always a polygon — booleans
  rarely produce a pure rect.
- **Output `fillRule`** is always `'nonzero'`. The engine
  (`polygon-clipping`) emits non-overlapping simple rings with canonical
  outer-CCW / inner-CW winding, so nonzero and evenodd render identically on
  its output. Nonzero matches the codebase default.
- **Empty result** (disjoint intersect, full subtract, etc.) is a
  `PolygonPath` with zero-length `commands`/`coords`. Renderers, bounds, and
  hit-test kernels already handle empty paths.
- **Bezier inputs** are flattened via the existing `flatten.ts` utility
  before clipping. The result contains only `M`/`L`/`Z` commands. Documented
  in JSDoc as a v1 limitation.
- **No mutation of inputs.** All functions are pure.

### Engine adapter — `src/features/paths/booleans.adapter.ts`

Kept in a separate file so the public surface stays small and the dep is one
import away from being swappable:

```ts
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon } from 'polygon-clipping';

export function pathToMultiPolygon(path: Path): MultiPolygon;
export function multiPolygonToPath(mp: MultiPolygon): PolygonPath;
```

Adapter behavior:

- `pathToMultiPolygon` walks the command stream, flattens cubic/quadratic
  beziers via `flatten.ts`, splits the stream at each `M` into rings, closes
  any open ring (an unterminated subpath becomes a closed contour for
  boolean purposes — open polylines have no area). Returns the
  `[[[x, y], ...], ...]` MultiPolygon shape.
- `multiPolygonToPath` emits one `M`/`L*`/`Z` sequence per ring into a fresh
  `Uint8Array` + `Float32Array`, returns a `PolygonPath` with
  `fillRule: 'nonzero'`.
- Each public boolean fn in `booleans.ts` is a ~3-line composition:
  inputs → `pathToMultiPolygon` → `polygonClipping.<op>` →
  `multiPolygonToPath`.

### Action hook — `src/interactions/actions/booleans/`

Directory layout (mirrors `align/`, `flip/`, `group/` — dir name and core
file name match):

```
booleans/
  index.ts
  booleans.ts            // pure core: (paths in z-order, op) -> batch
  booleans.test.ts
  useBooleans.ts         // React hook surface
  useBooleans.test.tsx
```

`useBooleans()` returns five callables:

```ts
interface BooleanActions {
  union(): void;
  intersect(): void;
  subtract(): void;
  exclude(): void;
  divide(): void;
}
```

Semantics:

- Selection resolution: read selected paths in **z-order top-to-bottom**.
  Non-path selections (groups, text, images) are ignored.
- Commutative ops (`union`, `intersect`, `exclude`, `divide`): pass all
  selected paths to the corresponding pure fn.
- `subtract`: requires ≥ 2 paths. Result = `pathSubtract(back, frontUnion)`
  where `back` is the bottommost selected path and `frontUnion =
  pathUnion(...everythingAboveBack)` — i.e. `back − frontUnion`. Matches
  Illustrator's "Minus Front." With < 2 paths the action is a no-op (and
  logs a dev-mode warning).
- Geometry feeds the engine in **world space** — we apply each layer's pose
  via `transform.ts` before clipping. The resulting path is inserted with
  identity pose; its geometry already encodes the world-space outcome. This
  is the simplest behavior and matches Illustrator (after a boolean, the
  result has its own bounding box, not the union of the source poses).
- **Insertion z-position** for single-output ops: at the slot of the
  topmost source. For `divide`: all results inserted at the topmost
  source's slot, ordered to match input order so the result is
  deterministic.
- **Undo granularity**: one batch covering deletes + insertions, applied via
  `ctx.applyBatch([...createDeleteOp(id), createInsertOp(newPath, {at})])`.
  One undo step regardless of N inputs.
- **Empty-result handling**: if the op returns an empty geometry (disjoint
  intersect, full subtract), the action is a no-op — sources untouched.
  Avoids the "I clicked intersect and all my shapes vanished" surprise.
  `divide` has no empty case in practice: N disjoint inputs round-trip as
  N output regions.
- **Post-action selection**: select the new result path(s).

### Public exports — `src/index.ts`

```ts
export { pathUnion, pathIntersect, pathSubtract, pathExclude, pathDivide }
  from './features/paths/booleans';
export { useBooleans } from './interactions/actions/booleans';
```

The engine adapter is *not* exported — it's an internal contract.

## Dependency

Add `polygon-clipping` (mfogel) as a regular `dependency` in `package.json`:

- ~30 KB minified, MIT-licensed, zero transitive deps.
- Martinez-Rueda-Feito algorithm; handles all four boolean ops natively
  with multipolygon + hole output.
- Battle-tested in production by Turf.js and several other GIS / CAD libs.
- Robustness story (degenerate vertices, T-junctions, collinear edges) is
  the strongest of the JS-ecosystem options and is the reason we prefer it
  over an in-tree implementation.

Divide is not provided by the lib but is derivable in adapter code:
fracture by taking the union of all inputs, then re-intersecting each
input with each output region (or, more efficiently, using the lib's
internal event-queue output if we end up exposing it). The plan should
specify which approach; both produce the same geometry.

## Testing

### Unit — `booleans.test.ts`

Each op against canned geometries, all in deterministic input coords:

- two overlapping rects (basic correctness, every op)
- disjoint pair (empty intersect; concat union)
- one contained in the other (subtract → annulus, verifies multi-contour
  output round-trips through the adapter)
- touching at edge / T-junction (engine degeneracy)
- touching at a single vertex (worse degeneracy)
- `RectPath` + `PolygonPath` mixed (verifies rect→polygon conversion)
- path with a cubic bezier (verifies flatten pre-pass)
- self-intersecting polygon (figure-8 — output uses canonical winding
  regardless of input fill rule)
- empty-result cases (disjoint intersect; full subtract)

### Adapter — `booleans.adapter.test.ts`

Round-trip a representative set of `Path`s through
`pathToMultiPolygon` → `multiPolygonToPath` and assert geometric
equivalence via point sampling against the original `pointInPath`.

### Hook — `useBooleans.test.tsx`

Mounted with a seeded scene; for each op assert:

- one undo step is appended (`history.length` delta = 1)
- source layers are deleted
- result inserted at the topmost source's z-slot
- result becomes the new selection
- `subtract` with < 2 paths is a no-op (no batch dispatched, no warning
  thrown to test consumer; dev-mode console warning is fine)
- empty result → no batch dispatched, sources retained, selection
  unchanged

### Visual regression

One demo + Playwright spec pair:

- `demo/demos/BooleanOpsDemo.tsx` — five canvas regions, each showing the
  result of one op on a fixed two-shape input (a circle overlapping a
  rect, say). Static after mount.
- `tests/visual/boolean-ops.spec.ts` — captures the canvas, default 2%
  tolerance. Bumps to 5% only if compound paths trigger the same
  evenodd-stencil-edge issue we already document in `compound-paths.spec.ts`.

## Risk / open items

- **Divide implementation strategy** (lib doesn't expose it directly).
  Decide in the plan: derive from union+per-input intersect, or expose the
  engine's sweep-line internal output. Either works; the former is simpler
  but O(N²) intersections, the latter is O(N log N) but couples us to the
  lib's internals.
- **Coordinate scaling.** `polygon-clipping` is robust but recommends
  scaling coords up so its epsilon (~1e-10 of the scaled range) lies below
  the smallest meaningful feature. We'll scale by `1 / boundsExtent * 1e6`
  before clipping and inverse-scale on output. Plan should add a unit test
  with extreme coord magnitudes to validate.
- **Open polylines.** A selected path with no `Z` has zero area. Today's
  decision: treat as closed for boolean purposes (we close it before
  feeding the engine). Alternative — silently filter polyline inputs out —
  is rejected as more confusing.

## Out-of-scope follow-ups (move to TODO medium-priority)

- Crop, Outline, Trim, Merge companion ops.
- Non-destructive Figma-style boolean group (new layer type).
- True curve booleans (Skia/PathKit-style).
- Live preview during the action gesture.
- Boolean ops on stroked paths (requires stroke-to-fill).
- Pathfinder UI panel (icons, palette).

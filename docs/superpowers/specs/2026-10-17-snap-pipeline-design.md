# One snap pipeline

**Status: unbuilt — in progress on branch `snap-arc`.** Design for the P1 TODO entry "Guides and
snapping, designed as one arc". Written for whoever builds it: a weasel maintainer who knows
the dispatcher, deps, and actions, and who has not read the snap code yet. It answers how every
gesture, in a 2D or a 3D host, finds and ranks snap targets and shows what it snapped to.

## Why

Ten snap paths exist today. None of them ranks its candidates against another's; whichever runs
first wins.

| Path | Targets | Reach | Suspended by | Feedback |
|---|---|---|---|---|
| Path snap (`snap` dep, `features/paths/pathSnap`) | anchor, center, intersection, tangent, perpendicular, midpoint, extremum, quadrant, nearest | `pathSnap.radius` ?? 8 screen px; no kit setting | nothing | marker layer |
| Grid (`guides/strategies/grid.ts`, three copies) | rounds the pose origin | none: always snaps | optional `bypassKey`, never set by draw | none |
| Ruler guides (`strategies/guides.ts`) | guide lines | `targets.guideSnapPx` | `bypassKey` | none |
| Alignment (`guides/alignment`) | sibling edges and centers | `targets.guideSnapPx` | `bypassKey` | active guides |
| Equal spacing (`alignment/spacing.ts`) | existing gap sizes, centering | `targets.guideSnapPx` | none | gap marks |
| Pen anchor (`nearestPathAnchor`) | nearest anchor | `targets.penAnchorSnapPx` | none | none |
| Measure ends (`nearestMeasureEnd`) | measure ends | world units | none | none |
| Angle (four copies) | 15° or 45° steps | — | Shift *engages* it | handle snap only |
| Resize point snap (`resize/pointSnap.ts`) | grid corners | — | `bypassKey` | none |
| Layout drop (`guides/layout/snaps.ts`) | container slots | world units | — | — |

In move, a path target holds every behavior off. Otherwise the grid snaps first, and alignment
adds its own delta on top of the snapped pose. Resize never reads the `snap` dep. In draw, the
"Snap to grid" preference says it constrains resize; it does not. kernel3d's `createSnap()` is
the identity, so nothing in 3D snaps at all.

## Goals

- One resolver that every gesture calls, in 2D and in 3D: move, resize, rotate, insert, pen and
  spiro placement, pen handles, anchor and handle drags in path edit, measure, and the symmetry
  center.
- Every target type is a **source**, and sources compete under one ranking rule instead of by
  call order.
- One reach setting, measured in screen px, with an optional per-source override.
- One modifier role that suspends snapping, and one that constrains. Every snapping action
  declares both.
- One readout layer that draws what won: point markers with labels, alignment lines, equal-gap
  marks, and distances, Alt-hover readouts included.
- kernel3d snaps for real: box corners, edges and faces, alignment planes, and a ground grid,
  wired into the 3D lab.

## Non-goals

- Container slot and layout drops (`guides/layout/snaps.ts`, `snapToContainer`). They decide
  *which parent* a node goes into, not where it lands geometrically. They stay move behaviors.
- Making `InvocationCtx` 3D. Actions keep receiving the 2D point the dispatcher hands them:
  world in 2D, screen in a 3D host. That is the stated contract of the snap dep below.
- 3D resize and rotate. No 3D host mounts either; `supportsRotation()` is false in kernel3d.
  The 3D resolver supports them, but nothing exercises them.
- UI widget snapping (`packages/ui/src/snap.ts`: sliders, curve editor). Different domain.

## Anti-goals

- **A pipeline that is 2D underneath with a 3D shim.** The resolver is written over n-vectors
  from the start, and 2D is the case where n = 2.
- **Keeping the old snap behaviors as parallel routes.** Every replaced API is removed, not
  wrapped, per "one pathway per decision". The breakage is stated in changeset prose.
- **Sources ranking themselves by order.** No source may assume it runs first or last.

## The model

### Loci, probes, and constraints

A **locus** is the set of world positions a target allows: an affine subspace given by a point
and 0–2 direction vectors.

| Locus | 2D | 3D |
|---|---|---|
| point (0 directions) | path anchor, intersection, measure end, pen anchor | box corner, box center, vertex |
| line (1 direction) | guide, sibling edge or center line, equal-spacing position, one grid axis | box edge, axis line, ground-grid line |
| plane (2 directions) | — | box face, alignment plane |

A locus may carry an optional **span** (a segment or a bounded face). A solution outside the span
fails that candidate.

A **probe** is a point on the subject that should land on a locus, tagged with a role that says
which sources may match it:

| Role | Probes | Matched by |
|---|---|---|
| `origin` | the pose origin, through the pose's `OriginProjection` | grid, ruler guides |
| `box` | the drawn box's (stroke included) min, center, max | alignment, spacing |
| `geometry` | the subject's own path geometry, as move picks it today (`include: moved`) | path, measure ends, 3D box |
| `pointer` | the cursor, for point gestures; the moving edge or corner for resize | every source |

Each source declares the roles it matches. The point is to keep each source snapping what it
snaps today, so the arc does not settle the open P3 "Should grid and guide snaps line up the
stroke?". That question stays the maintainer's, and answering it later means changing one
source's role list.

A **candidate** pairs one probe with one locus and names its source, its tier (`target` or
`fallback`), and the mark to draw if it wins. Because a move shifts every probe by the same δ,
each candidate is a linear constraint on δ: an affine subspace of δ-space whose codimension
equals the locus's.

### The input subspace

Every query carries a **hard input subspace** `H` that δ must stay inside, plus the raw δ₀ the
gesture would produce unsnapped.

- **2D move or point gesture:** `H` is the whole plane.
- **Shift-constrained gesture:** `H` is the line through the origin at the nearest angle step.
  That covers 15° for line insert and measure, 45° for pen handles, and a new axis/45° lock for
  move.
- **Aspect-locked resize:** `H` is the line through the fixed corner along the box diagonal.
  So a snap with aspect lock held lands where the diagonal meets the guide, instead of
  disagreeing with it.
- **Edge resize handle:** `H` is the handle's axis.
- **3D move:** `H` is the plane through the subject perpendicular to `up`, which is the plane
  `translate` already moves on. 3D insert uses the ground plane.

Every constraint is now an affine subspace, so "snap along a constraint" is just an
intersection. The four angle-snap implementations and the aspect lock stop competing with
snapping.

### Resolution

Reach is per source. The grid's is unlimited (`reachPx: Infinity`): today it always snaps, and
it still does. Because tier ranks before displacement, an unlimited fallback never beats a
target in reach.

1. Collect candidates from every active source near the current probes (see "Sources").
2. For each candidate `c`, compute δ_c: the point of `H ∩ C_c` closest to δ₀. A candidate whose
   δ_c moves its probe more than reach on screen (`toScreen(probe + δ_c)` vs
   `toScreen(probe + δ₀)`) is out.
3. Form combinations of in-reach candidates, up to `dim(H)` members. A combination is feasible
   when `H ∩ C₁ ∩ … ∩ Cₖ` is non-empty, raises the codimension with each member, and its δ moves
   no member's probe more than reach. Two lines through different probes combine; that is how x
   aligns to one shape and y to another.
4. Rank combinations by these keys, best first:
   - **codimension within `H`.** A point beats a line, and a line beats nothing.
   - **target-tier codimension.** The grid fills an axis that no real target claims, but never
     displaces one.
   - **screen displacement**, smaller first.
   - **stable source order**, as a final deterministic tiebreak only.
5. The winner's δ is the result. **Marks** come from every in-reach candidate the result
   satisfies (within ε), not just the members of the winning combination. When three siblings
   share the edge you landed on, all three lines show.

Keep the search bounded: pool the K nearest in-reach candidates per probe (K = 24 is the
builder's call), and solve with small dense linear algebra. n ≤ 3 and k ≤ 3, so least squares
on a 3×3 is the whole cost.

Rotation runs the same resolver in one dimension: δ is an angle, targets are angles, and reach
is converted to radians through the handle's screen radius. Rotation's targets are multiples of
90° (target tier), sibling rotations (target tier) and, while Shift is held, 15° steps. Shift
makes that step set required: the result must include one of them.

### Curves

Some path-snap kinds are not affine: nearest-on-path, tangent and perpendicular. Their source
solves them for the current probe position each frame and emits a point locus. A tangent and
perpendicular need the query's `origin`. Re-collecting each frame is already how path snap
works.

## Surfaces

### `@weasel-js/geom` — the resolver (`geom/src/snap/`)

Pure and dependency-free:

- `Locus`, `SnapCandidate<M>` (`M` is the mark payload, opaque to the resolver), `Subspace`.
- `resolveSnap(query): SnapResolution<M>`. The query holds `dim`, probes as number tuples, `H`,
  δ₀, candidates, `toScreen`, `reach`, and `required?`.
- 2D and 3D adapters convert `Point` / `Vec3` to and from tuples.

Add what is missing beside the existing helpers: closest point on a line, segment, or plane to a
point; closest points between a ray and a line; and a vector `distance`. Missing 3D helpers go
into `geom/src/3d`, not into kernel3d's private ones; move `pointOnRay` and `aabbOfPoints` there
too.

`findPathSnap` / `createPathSnapIndex` stay in geom as the path source's spatial index. Their
ranking is replaced by the resolver.

### Core — sources and the dep

```ts
interface SnapSource<P = Point> {
  id: string;
  tier?: 'target' | 'fallback';
  reachPx?: number;                          // overrides targets.snapPx for this source
  collect(q: SnapCollect<P>): Iterable<SnapCandidate<SnapMark>>;
}
```

`SnapCollect` carries the probes at δ₀, the excluded/included ids, `origin`, the gesture kind,
`also` geometry (path edit's still anchors), and the view (scale, or a projection in 3D) so a
source can cull by reach.

The `snap` dep becomes session-shaped, because a gesture captures probes at press:

```ts
interface SnapDep {
  begin(req: SnapBegin): SnapSession;
}
interface SnapBegin {
  gesture: 'point' | 'move' | 'resize' | 'rotate';
  press: Point;                 // ctx coordinates: world in 2D, screen in a 3D host
  ids?: readonly string[];      // the subject; excluded from targets
  handle?: ResizeHandle;        // resize: which edge or corner moves
  pivot?: Point;                // rotate
  origin?: Point;               // point gestures: the previous anchor, line start
  also?: SnapGeometry;
  constrain?: AngleStep | 'aspect' | 'axis';   // builds H
}
interface SnapSession {
  at(p: Point, mods: { suspend: boolean; constrain: boolean }): SnapOutcome;
  angle?(theta: number, mods): { theta: number; marks: readonly SnapMark[] };
  end(): void;
}
interface SnapOutcome { point: Point; held: boolean; marks: readonly SnapMark[] }
```

**The contract is ctx coordinates in and out.** An action hands the dep the point the dispatcher
gave it and gets back the point it should have been. In 2D that is a world point. In 3D it is a
screen point: the host projects the snapped world position back, and `translate` / `insert`
re-cast it onto the same plane, so the round trip is exact. That is why `InvocationCtx` can stay
2D, and it is how kernel3d already builds its rays inside each dep.

Core's 2D implementation is `useSnapDepSource`: it builds probes from the subject's union box and
its path geometry, and it owns the subscribable outcome store the readout layer reads.

Registration:

- `<SceneCanvas snap={{ sources?, reachPx?, readout? }}>`.
- `FeaturePreset.snapSources`, which composes like `moveBehaviors` does today.
- A `useSnapSource(source)` hook for contributions.

`toolOptions.snapPoint`, `toolOptions.snapTargets`, `toolOptions.pathSnap`, and the pen's
`snapPoint` / `anchorSnapRadius` options are all removed. A consumer's custom rule becomes a
source.

**Settings:**

- One kit setting, `targets.snapPx`, default 8, declared in core.
- `targets.guideSnapPx` and `targets.penAnchorSnapPx` are removed. `DEFAULT_PATH_SNAP_RADIUS` goes
  with them.
- `targets.penCloseHitPx` stays: it is a hit test, not a snap.

**Modifier roles.** Declared on each snapping action's `modifierRoles`:

| Role | Default keys | Meaning |
|---|---|---|
| `snap.suspend` | `['ctrl']` | no source answers while held; `H` constraints still apply |
| `snap.constrain` | `['shift']` | builds the gesture's `H`: angle step, axis lock, or aspect lock (resize) |

Today Shift already means aspect lock in resize and angle step in insert, measure, pen and
rotate. Those keep their meaning, now as one role. Alt keeps its existing meanings (clone on
move, center origin on insert, mirror break on handles); suspend never takes it.

### Actions

| Action | Change |
|---|---|
| move | `begin({gesture:'move', ids, press})` at session start; each frame `at(pointer)` and the delta from the returned point. `captureMovePathSnap` / `snapMoveDelta` go. The `snap()` behavior adapter and the grid, guide and alignment move behaviors go. Non-snap behaviors (container dwell, layout drop, reparent) stay and run after the snap. |
| resize | gains `snap` in `requires`. `begin({gesture:'resize', ids, handle})`; the pointer is snapped before `computeProposedBounds`. `PointSnapBehavior`, `snapPose`, and `resizePolicy.pointSnap` go. Aspect lock becomes `constrain:'aspect'`. Other `BoundsConstraint`s (min size) still run after. |
| rotate | `begin({gesture:'rotate', pivot})`, then `angle()`. `snapRotationWithModifier` goes from `DEFAULT_ROTATE_BEHAVIORS`. |
| insert | `begin({gesture:'point', press, constrain: kind === 'line' ? 15° : undefined})`. `snapTo15Degrees`'s call site goes; the step lives in `H`. The grid and alignment insert behaviors go. |
| pen, spiro | placement goes through the session with `origin` = last anchor. `nearestPathAnchor` becomes the path source's anchor kind. Handle placement uses `constrain: 45°` in place of `constrainTo45`. |
| edit-anchors | anchor drag: `begin({gesture:'point', ids:[id], also: still})`. Handle drag runs the one-dimensional `angle()` path, in polar coordinates about the anchor: δ is the handle's angle, its length is kept, and targets are the 45° steps and the opposite handle's angle. Reach stays in degrees (today's 6°). The length lock is then automatic, and the angle lock is `required`. The handle drag does not declare `snap.suspend`, because Ctrl already holds the length (`handle.holdLength`). Handle snap stays opt-in through its preset. |
| measure, symmetry center | `point` sessions. Measure's Shift step is `H`. |

### Sources

| Source | Package | Tier | Loci |
|---|---|---|---|
| `pathSnapSource(opts)` | core (`features/paths/pathSnap`) | target | points of every `PATH_SNAP_KINDS` kind; `kinds` toggles each |
| `gridSnapSource({ spacing, origin? })` | guides | fallback | per axis, the nearest grid line on each side of each probe; plane-aware through `roundToGridOn` |
| `guideSnapSource(getGuides)` | guides | target | ruler-guide lines |
| `alignmentSnapSource(opts)` | guides | target | sibling edge and center lines (from `deriveAlignmentGuides`), optional page box; marks span from the probe's box to the target's |
| `spacingSnapSource(opts)` | guides | target | positions giving an equal gap or centering between neighbors (from `matchSpacing`); gap marks with the gap value |
| `measureEndSource(scene)` | core (`features/measure`) | target | measure end points |
| `handleSnapSource(opts)` | path-tools | target | 1D angle targets: steps, plus the opposite handle's angle |
| `boxSnapSource(world)` | kernel3d | target | each node's world box: 8 corners, 12 edges, 6 faces, center |
| `alignPlaneSource(world)` | kernel3d | target | planes x/y/z = each node's min, center, max |
| `groundGridSource({ step })` | kernel3d | fallback | grid lines on the ground plane |

The spacing-hints preset becomes alignment + spacing sources plus the readout, with alignment
off by default as today. Each source culls with the reach the query gives it, so a scene with
thousands of nodes does not hand the resolver thousands of candidates.

### The readout layer

```ts
type SnapMark =
  | { kind: 'point'; at: Point; glyph: PathSnapKind | 'corner' | 'center'; label?: string }
  | { kind: 'line'; from: Point; to: Point }
  | { kind: 'gap'; from: Point; to: Point; value: number }
  | { kind: 'distance'; from: Point; to: Point; value: number };
```

Marks are in world coordinates, typed `P`, so 3D marks carry `Vec3`. Core mounts one readout
layer: screen space, always on, subscribed to the snap outcome store. It merges what
`createPathSnapMarkerLayer` draws (glyphs and labels) with what `createGuidesLayer` draws for
active guides and gaps (ticked lines and gap labels). The Alt-hover distance readout writes
`distance` marks into the same store instead of mounting its own guides layer. Ruler guides keep
`createGuidesLayer` for drawing the guides themselves; that is content, not readout.

In 3D, kernel3d exports `projectSnapMarks(marks, viewport)`, which returns screen lines and
points. The 3D lab draws them through its renderer, beside the existing chrome boxes. kernel3d
gains the world-to-screen point projection it lacks today.

### apps/draw and demos

- **draw:** the "Snap to grid" preference turns on `gridSnapSource`. It now covers resize, as its
  description already claims. The spacing-hints preference composes the sources. The measure-end
  wiring in `Workspace.tsx` becomes `measureEndSource`. `useGrid`'s hand-written `Math.round`
  `snapPoint` goes.
- **Site demos** move to sources: AlignmentGuides, SpacingHintsLab, PathSnapLab, HandleSnapLab,
  PointSnap (becomes a grid-source resize demo), MeasureLab, SceneLab, DebugOverlay, PathPose,
  Text, Transform, Layout. `apps/site/registry.ts` entries follow the renamed exports.
- **labkit:** weasel-lab mounts a grid source. The 3D lab gets box, alignment and ground-grid
  sources and draws their marks.

## Constraints

- weasel rules apply throughout:
  - `check:size`: files under 400 lines, functions under 120.
  - Every changeset is `patch`, with breaking changes stated in prose.
  - Every frame loop goes through `useVisibleRaf`.
  - No `export *` of another workspace package.
  - `check:imports` passes.
- Tests run on the fleet (`npm run test:fleet`), and the gate runs before merge
  (`npm run test:gate`).
- Outside weasel, eric imports `snapToGrid` from `@weasel-js/core/move` (already a stale
  subpath). The changeset prose names the replacement.

## Calls made without the maintainer

The maintainer said to build all of it overnight. These calls are mine:

- The resolver lives in geom; sources live with the package that owns their geometry.
- **Points beat lines through codimension ranking**, and per-axis alignment falls out of combining
  lines. This is the answer to the "point wins vs per axis" question.
- **Grid is fallback tier**, so alignment beats grid on an axis. Today alignment is added *on top
  of* the grid.
- `snap.suspend` defaults to Ctrl, except on path-edit handle drags, where Ctrl already holds the
  length.
- **Probes keep what each source snaps today** (origin for grid and guides, drawn box for
  alignment), so the open stroke question stays open.
- **Handle snap stays angular**, run as 1D rotation about the anchor.
- **Move gains Shift axis lock** (horizontal, vertical, 45°) as a constraint. This is new behavior.
- **Rotation gains 90° and sibling-angle targets without Shift.** This is new behavior.
- **One `targets.snapPx` default of 8**, replacing `guideSnapPx` (6) and `penAnchorSnapPx` (8).
- **Old snap APIs are removed, not wrapped.**
- Layout drops stay out of scope.

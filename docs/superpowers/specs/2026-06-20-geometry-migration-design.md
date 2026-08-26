# Geometry Migration — Re-point Seams, Dedup, Fix Resize (Spec 2 of 2)

Date: 2026-06-20
Status: COMPLETE (2026-06-20) — Phase 2 (seam re-points 1/4/7 + dedups) and Phase 3
(anchor fix + opt-in `geometryProjection` seam) landed on `feat/geometry-migration-impl`.
Phases 4–6 (the remainder) landed on `geom-remainder`: seams 2/3/5/6 kernel re-points,
the selection fix #3, and dead-code/dedup items #5/#6/#8/#9/#12/#13. Both contract gates
green throughout (kit 54/54, apps/draw 36/36). The deferred list is now EMPTY — nothing
carried over. (Seam 6 re-points only the inverse-rotation onto the kernel and keeps the
richer `pointInPath` containment, since kernel `pointInPolygon` lacks curves/fillRule/
subpaths — noted, not punted.) Plans:
`2026-06-20-geometry-migration` (plan, deleted at merge) (Phases 2–3),
`2026-06-20-geometry-migration-remainder` (plan, deleted at merge) (Phases 4–6).
Branch: `feat/geometry-kernel`
Depends on: `2026-06-20-geometry-kernel-representation-design.md` (Spec 1 — builds `@weasel-js/geom`)
Companion analysis: `2026-06-20-geometry-consolidation-analysis.md` (the seven seams, the split, the 13 ranked items)

## Summary

With the `@weasel-js/geom` kernel in place (Spec 1), this spec migrates the existing kit and
`apps/draw` onto it: re-point the seven canonical seams to compose on kernel primitives,
delete the scattered duplicate primitives in favor of one canonical owner each, and **fix the
anchor bug** — resize/move/nudge/rotate/flip must transform a node's *contents*, not just its
AABB, for geometry-in-data (polygon-content) nodes.

This is the behavior-changing half. Every step is gated by the parametrized **geometry
contract test** (defined in Spec 1 §4, authored here), which must **fail today** for
polygon-content nodes and pass after the fix.

## Dependency on Spec 1

Spec 2 assumes the kernel exposes (all verified-present before migration begins):
`@weasel-js/geom`: `boxToBox`, `multiply`, `invert`, `rotateAboutPoint`, `applyToPoint`,
`transformCoords`, `boundsOfCoords`, `cubicBounds`, `pointInPolygon`, `segmentsCross`,
`pointSegmentDist2`, `forEachSegment`, `PATH_*`, `elevateQuadraticToCubic`, `EPS`/`approxEq`;
`@weasel-js/geom/booleans`: `pathUnion`/`Intersect`/`Subtract`/`Exclude`/`Divide`.

The wrapper layer (weasel-typed, stays in `src/`) adapts `Path`/pose/`view`/DOM to those.
`Path` becomes "geom command stream + `kind` + `fillRule`"; `features/paths/types.ts`
re-exports the `PATH_*` constants from `@weasel-js/geom` (one ownership move).

## The convention decision (resolves analysis §2)

**Adopt geometry-in-data as the consumer convention** (pose = AABB + rotation; geometry in
`data.path`) **and make the kit's resize/translate/flip projection transform `data.path`**
instead of relying on `isPathLike(pose)`. This is what `apps/draw`, the renderer's
`PATH_PAINTER`, and every world-space action already assume; the defect is that the kit's
default projection only scales geometry when it lives *on the pose* and silently no-ops when
it lives in `data`.

### Kit-level (b) vs app-side (a) — gated by a verification task

The analysis recommends the **kit-level data-aware descriptor (b)** — the resize action,
when the pose is a bare AABB and the node carries `data.path`, remaps the path through the
kernel — over the app-side projection (a). Per project norms (consumer pressure is not a
scoping factor; expose the foundation, not a half-measure), (b) is the target.

**Open blocker, resolved first in the plan:** whether the resize action has the node's `data`
in scope at the projection call site. Verify in `src/interactions/actions/resize/resize.ts`
(and the move/nudge/flip equivalents) before committing to (b).
- If `data` is reachable → implement (b): a kit data-aware `PoseProjection` that reads/writes
  `data.path` via `boxToBox`+`transformCoords` (resize), `translate` (move/nudge), and
  rotation about the AABB center (rotate), with the flip mirror across the centerline.
- If `data` is *not* reachable without a larger refactor → implement (a) as the interim
  (apps/draw wires a `resizePolicy.projection` that does the same kernel calls on
  `data.path`), and file the action-signature refactor that unblocks (b) as a follow-up. Do
  **not** silently ship the rect-only behavior.

Either way the *math* is identical and lives in the kernel; only the wiring site differs.

### Resolution (2026-06-20, Phase 1 investigation)

**Verdict: kit-level (b) is not possible with the current action signature, and (b) is the chosen direction — implemented via a new generic geometry seam.**

Phase 1 proved the resize/move/nudge/flip actions operate purely on poses: `PoseProjection<TPose>` has no `data` parameter (`resize/geometry.ts:15-43`), and the action only reads `node.pose`, never the node body (`defaults/resize.ts:314,319,428`). So there is no existing seam to remap data-held geometry.

Critically, the kit is **generic over `TData`** (`Scene<TData, TLayer, TPose>`) — it cannot reach into `data.path` directly, because `data` is consumer-defined. So (b) is **not** "thread `data.path` through the projection." (b) is: **add a generic, consumer-supplied geometry-projection seam** — a real public hook, not an internal reach — that the actions invoke.

**Seam shape (the key new public API; confirm on plan review):** an optional per-`SceneCanvas` (and/or per-node-kind) projection the consumer supplies:

```
geometryProjection?: {
  /** Return updated data with the node's data-held geometry transformed by `m`,
   *  or null if this node has no data-held geometry (kit leaves it alone). */
  transform(node: SceneNode<TData, TPose>, m: Mat3): TData | null;
}
```

- The action computes the affine it applied to the **pose** as a `Mat3` and calls `geometryProjection.transform(node, m)`, committing the pose op **and** the data op in one undoable batch.
- Per op: resize → `boxToBox(originBounds, proposedBounds)`; move/nudge → `translate(dx,dy)`; flip → mirror across the centerline; **rotate → no data call** (rotation is stored on the pose and baked at render; `data.path` is unchanged — matches the green rotate tests).
- `apps/draw` implements `transform` via the kernel: `{ ...data, path: pathFromCoords(transformCoords(data.path.coords, m), data.path.commands) }`. This is the first consumer of the seam; it replaces the hand-rolled `applyPoseToObj` `scalePathToBounds`.
- This keeps the kit's pose-only model intact for pose-held geometry and adds a clean, generic extension for data-held geometry — no `@internal` leak, no side-effecting projection reaching into the scene (which is why interim (a) is rejected).

**`mintPathLeaf`** still consolidates the booleans/slice/release-compound leaf minting so the convention is enforced once and the seam applies uniformly.

## Seam re-pointing (the seven)

Each canonical owner stays in its layer home and is rewritten to compose on the kernel. The
irreducible per-seam glue stays put.

| # | Owner (stays) | Re-point to kernel | Glue that stays |
|---|---|---|---|
| 1 `pathInPoseFrame` | `features/paths/pathInWorld.ts` | `boxToBox(srcBounds→poseBox)` + `transformCoords`; rect branch unchanged | rect/polygon dispatch on `Path.kind` |
| 2 `pathInWorld` | same | seam 1 + `rotateAboutPoint(aabbCenter)` ∘ `transformCoords` | — |
| 3 `worldEditToStorage` | same | `invert(rotation)` + seam-1 realign; preserve rotation | — |
| 4 `boundsOfPath` | `features/paths/bounds.ts` | `cubicBounds` per C-segment (Q via `elevateQuadraticToCubic`); rect O(1) | command walk via `forEachSegment` |
| 5 `rotateAroundAABBCenter` | `canvas/poseRotation.ts` | `rotateAboutPoint` for the Mat3 | `DrawCommand` wrap (`wrapWithPoseRotation`) stays render-side |
| 6 `poseContainsRotated` | `canvas/SceneCanvas/poseGeometry.ts` | `invert`+`applyToPoint` to pose-local; `pointInPolygon`/`boxContainsPoint` | silhouette dispatch (`isPathLike`/rect fast path) stays |
| 7 `clientToWorld` (new) | new `core/viewport/clientToWorld.ts` | `invert(viewMat3)`+`applyToPoint` | DOM `rect.left/top` subtraction stays; re-point the 8 inline copies |

## Dedup deletions (converge onto one owner)

- **point-in-polygon:** delete the `{x,y}` copy in `polygonHitTestRect.ts` and the byte-twin
  in `pathHitTest.ts`; both call `@weasel-js/geom` `pointInPolygon`. Adapt the rect/AABB
  helpers to feed flat coords. Share the crossing predicate with `tessellate.ts:308`
  `pointInContour`.
- **segment-segment-cross:** delete both copies (`pathHitTest.ts`, `polygonHitTestRect.ts`)
  → kernel `segmentsCross`.
- **bounds-of-bounds-union:** keep the public `unionBounds` (`features/groups/unionBounds.ts`);
  delete the 3 private copies (`align/align.ts:39`, `defaults/align.tsx:44`,
  `computeUnionBounds@resize.ts:219`); coerce `unionBounds(b)!` at the guarded call sites.
  (Note: `unionBounds` operates on `Bounds` objects, not raw coords — it stays kit-side; the
  kernel's `unionBox` is the raw-coord analog, not a forced merge target.)
- **cubicEval / flatten / splitCubic:** re-point `cubicMath.ts`, `flatten.ts` consumers to
  the kernel's `cubicEvalAt`/`flattenCubic`/(split); delete the `Point` struct.
- **command constants:** `features/paths/types.ts` re-exports `PATH_*` from `@weasel-js/geom`.
- **booleans:** `features/paths/booleans.ts` becomes a thin `Path`↔`GeomPath` shim over
  `@weasel-js/geom/booleans`; the action layer (`interactions/actions/booleans/booleans.ts`)
  is unchanged.

## Ranked work items (from analysis §3, kernel-aware)

Bugs → latent-risk → cosmetic. Blast radius = what visibly breaks if wrong.

| # | Finding | Severity | Fix | Blast |
|---|---|---|---|---|
| 1 | Resize-after-boolean / polygon-content resize (anchor bug) | BUG | data-aware projection (b/a) via kernel; `mintPathLeaf` for booleans/slice/release-compound; fix `applyPoseToObj` | High — gate on contract test |
| 2 | nudge + flip use rect-only descriptor | BUG | `RECT_POSE_DESCRIPTOR`→`AUTO_POSE_DESCRIPTOR`; share `translatePose` | Low-med |
| 3 | Marquee/lasso drop polygon-pose nodes (`hitTestAABB` rect-only) | BUG | make `hitTestAABB` silhouette-aware via kernel `pointInPolygon`/`aabbOfPose`; extract one `hitTestArea` | Med (additive) |
| 4 | `applyPoseToObj` hand-rolled resize, ignores rotation | High | route through kernel projection (folds into #1) | Med |
| 5 | 3 private `unionBounds` copies | latent | delete; use public canonical | Low |
| 6 | Container-move cascade rect-only copies | latent | route through `translatePose`; delete dead inline cascade | Med if a live caller appears |
| 7 | `pathAtPose` re-implements `pathInPoseFrame` | latent | promote/use `pathInPoseFrame` (now exported); delete `svgExport.ts:55`; re-point `useModality.ts:101` | Med |
| 8 | `rotationRender.ts` dup (dead) | cosmetic | delete file + test (guard-grep first) | None |
| 9 | `rotationHitTest.ts` dup (dead) | cosmetic | delete file + test | None |
| 10 | client→world: 8 inline copies | latent | new `clientToWorld` (seam 7); re-point all 8 | Med (pure refactor) |
| 11 | point-in-polygon / segmentsCross dups | cosmetic | converge on kernel | Low |
| 12 | corner→anchor table inlined 3× | latent | one ordered `CORNER_ANCHORS`; decode via `fixedCornerOf` | Med |
| 13 | seed node duplicates pose coords into rect path | cosmetic | `rectPath(0,0,w,h)` at origin | None |

The two missing exports from the original barrel discussion (`pathInPoseFrame`,
`poseContainsRotated`) are made public as part of #7/#6 here, since their consumers now live
across the new seam boundaries.

## Regression contract (the gate)

Author the parametrized FACTORIES × OPS test from Spec 1 §4. It lands **red** and turns
**green** as #1 (and #2/#4) complete.

- `src/interactions/actions/__tests__/geometryContract.test.ts` — kit-level, via the
  existing `useScene`/resize-action harness.
- `apps/draw/src/__tests__/geometryContract.test.ts` — mirrors the *actual* apps/draw
  `SceneCanvas` wiring (the bug is specifically that apps/draw wires no projection).
- FACTORIES: rect, ellipse, star, polygon, pen, boolean-union/intersect/subtract, slice-piece.
- OPS: resize-2x, resize-nonuniform, move, nudge, rotate-30, flip-x.
- Assertions: `afterWorld` is the affine image of `beforeWorld` under the same map applied to
  the pose; `boundsOfPath(afterWorld) ≈ aabbOf(after.pose)`; rotate∘resize catches the
  `applyPoseToObj` shear.
- Cross-tests: align vs resize derive the same union frame (#5); corner encode/decode on a
  rotated pose (#12).

## Phasing

1. **Verify** the `data`-in-scope question (decides b vs a) + author the contract test (red).
2. **Seam re-point** 1–7 onto the kernel — pure refactors, behavior-preserving, each guarded
   by existing suites. (#7, #10, #11 land here.)
3. **Anchor fix** #1 + #4 + `mintPathLeaf` + #2 — contract test goes green.
4. **Selection fix** #3.
5. **Dedup + dead-code** #5, #6, #12, #8, #9, #13.

Each phase is independently shippable and leaves the suite green (phase 1's contract test is
the one deliberate red, isolated until phase 3).

## Risks / open questions

- **b-vs-a hinges on action `data` scope** — phase 1 resolves it; do not ship rect-only.
- **`hitTestAABB` change alters selection results** for non-rect poses (additive: previously
  undroppable nodes become selectable). Snapshot/áffirm in tests.
- **Container-move cascade (#6)** — both rect-only copies are currently dead/opt-in-unused;
  fixing is cheap but verify no live caller regresses.
- **Flatten cache** for pointermove hit-testing (memoize flattened contour per path version) —
  a wrapper-layer optimization; only needed if profiling shows re-flatten cost. Out of the
  kernel.
- **f32/f64 epsilons** — any migrated comparison must use the kernel's magnitude-scaled
  `approxEq`, not a retained f64-tight literal.

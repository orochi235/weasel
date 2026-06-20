# Geometry Layer Consolidation Plan — weasel canvas-kit

Audience: senior engineer. Scope: the geometry primitives under `src/features/paths/`, `src/canvas/`, `src/interactions/actions/`, and their `apps/draw/` consumers. The anchor defect is **resize-after-boolean** (and its whole family): a node whose geometry lives in `data.path` under a bare-AABB pose scales its bounding box but not its contents.

All file:line references below were verified against the working tree on `feat/alignment-multiselect`.

---

## 1. Canonical seams

The geometry layer reduces to **seven fundamental operations**. Each should have exactly one owner; everything else delegates or is deleted.

| # | Operation | Canonical owner (file:line) | Duplicate(s) to delete / re-point | Export status |
|---|---|---|---|---|
| 1 | **project-path-to-pose-frame** (translate-only; rect rebased to pose dims; no rotation) | `pathInPoseFrame` @ `src/features/paths/pathInWorld.ts:53` | `pathAtPose` @ `apps/draw/src/svgExport.ts:55` (delete); inline `(pose - boundsOfPath origin)` delta in `getAnchors` @ `apps/draw/src/modality/useModality.ts:101` (re-point) | **NOT exported** — blocker. Only `pathInWorld`/`worldEditToStorage` are exported (`src/features/paths/index.ts:49`, `src/index.ts:488`). Must promote first. |
| 2 | **project-path-to-world** (pose-frame + bake rotation about AABB center) | `pathInWorld` @ `src/features/paths/pathInWorld.ts:76` | None — slice/booleans/release-compound/edit-anchors all correctly delegate. Healthy. | Public (`src/index.ts:488`) |
| 3 | **world-edit-to-storage** (inverse-rotate, realign to AABB origin, preserve rotation) | `worldEditToStorage` @ `src/features/paths/pathInWorld.ts:103` | None — `editAnchors.ts:161` delegates. Healthy. | Public (`src/index.ts:489`) |
| 4 | **bounds-of-path** (AABB; rect O(1), curves via extrema) | `boundsOfPath` @ `src/features/paths/bounds.ts:35` | `pathAabb`/`pathBounds` in `packages/svg` are cross-package shape-shims that already delegate — tolerable. | Public |
| 5 | **rotate-about-aabb-center** (Mat3 + drawcommand wrap; pivot = unrotated AABB center) | `rotateAroundAABBCenter` + `wrapWithPoseRotation` @ `src/canvas/poseRotation.ts:31/47` | `rotateAround`/`wrapWithRotation` @ `apps/draw/src/rotationRender.ts:10/28` — **delete file + test (dead code, zero prod importers)** | `rotateAroundAABBCenter` public (`src/index.ts:897`); `wrapWithPoseRotation` internal |
| 6 | **hit-test point-in-pose** (silhouette-aware, rotation-aware) | `poseContainsRotated` @ `src/canvas/SceneCanvas/poseGeometry.ts:58` | `pointInRotatedAabb` @ `apps/draw/src/rotationHitTest.ts:4` (**delete file + test, dead**); rect-only `hitTestAABB` @ `src/canvas/deps/aabbHitTest.ts:18` (make path-aware — see §3); `pointInRotatedRect` @ `rotate/geometry.ts:43` stays as the explicit rect-pose primitive `poseContains` delegates to | `poseContainsRotated` **NOT exported**; `pointInRotatedRect` public (`src/index.ts:703`) |
| 7 | **client↔world** (inverse-view: `(clientX - rect.left)/scale.x + view.x`) | **None yet** — needs new `clientToWorld` next to `src/core/viewport/viewToMat3.ts` | 8 inline copies: `Canvas.tsx:867,1265`; `SceneCanvas.tsx:1136,1212,1841`; `PickHud.tsx:63`; `CursorCoordsHud.tsx:83`; `PointerProviderIfRoot.tsx:41` | n/a — labkit's `screenToWorld` and `src/core/viewport/viewTransform.ts` both use the incompatible `{pan,zoom}` shape and omit rect subtraction; do **not** converge on them |

**Secondary dedups** (lower-tier primitives, all within `src/features/paths/`):

- **point-in-polygon** (even-odd raycast): keep `pointInPolygon` @ `polygonHitTestRect.ts:13` (already the documented kernel `pathHitTest.ts` imports from); delete the byte-identical copy @ `pathHitTest.ts:72`; extract one `edgeCrossesUpward` predicate so `pointInContour` @ `tessellate.ts:308` (interleaved coords) shares the crossing logic.
- **segment-segment-cross**: two byte-identical `segmentsCross` (`pathHitTest.ts:103`, `polygonHitTestRect.ts:93`) → one shared `src/features/paths/segmentMath.ts`. Leave `segmentsProperlyCross`, `segmentCrossesRayRight`, `lineLineIntersect` (genuinely distinct).
- **bounds-of-bounds-union**: a **public canonical already exists** — `unionBounds` @ `src/features/groups/unionBounds.ts:13` (exported `src/index.ts:563`). Delete THREE private copies: `align/align.ts:39`, `defaults/align.tsx:44`, `computeUnionBounds @ resize.ts:219`. Note empty-input contract differs (canonical → `null`; copies → `Infinity/NaN`) but all call sites pre-guard, so coerce with `unionBounds(b)!` at the single call site.
- **point-segment-dist²**, **circlePath (12-seg)**, **linePath (2-pt)**, **cubicEval (2D)**: small duplicates; collapse opportunistically (low risk).

---

## 2. The geometry-representation split

### The two conventions in the codebase

**A. geometry-in-pose** — the pose object *is* a `Path`: `{kind:'polygon', commands, coords}` or `{kind:'rect', x,y,width,height}`. The kit's `AUTO_POSE_DESCRIPTOR` (`autoPoseDescriptor.ts:21`) dispatches on this via `isPathLike(p)` (`autoPoseDescriptor.ts:9`), which is true **only when `pose.kind` is `'polygon'` or `'rect'`**. When true, resize/translate/flip route through `pathPoseDescriptor` and transform the actual coords.

**B. geometry-in-data** — the pose is a bare AABB `{x,y,width,height,rotation?}` with **no `kind`**, and geometry lives in `data.path`. This is exactly `WeaselDrawPose` (`apps/draw/src/App.tsx:110-112`, verified: no `kind` field). The renderer's `PATH_PAINTER` reconciles pose↔path at draw time via `pathInPoseFrame`, so it *renders* correctly. But `isPathLike` is **always false** for these poses.

### Why this is the anchor bug

apps/draw wires **no** `resizePolicy.projection` on its `SceneCanvas` (`App.tsx:1401`), so resize falls back to `AUTO_POSE_DESCRIPTOR` (`resize.ts:85`). Because `WeaselDrawPose` has no `kind`, `isPathLike` returns false and AUTO **always takes the rect branch** (`RECT_POSE_DESCRIPTOR`). For a rect path this is invisible — `pathInPoseFrame`'s rect branch rebuilds geometry from pose dims, so the box and the path stay coincident. **But for a polygon** (`pathInPoseFrame` only *translates* polygons, never scales — `pathInWorld.ts:65-69`), resizing the AABB pose scales the box while the `data.path` vertices are untouched. The contents tear loose from the frame. That is the resize-after-boolean defect, and every polygon-content node hits it:

- **boolean union/intersect/subtract** → `createPathNode` @ `App.tsx:946` mints `{kind:'polygon'}` into `data.path` + AABB pose
- **slice pieces** → `computeSliceOps` @ `sliceCommit.ts:117` — same convention
- **release-compound pieces** → `onReleaseCompound` @ `App.tsx:700` — same convention
- **star / ellipse / polygon insert** → `pathForShape` builds inscribed polygons; `useInsertDepSource` commits them into `data.path`
- **pen** → polygon/bezier coords in `data.path`

The same rect-only assumption also breaks **nudge** (`nudge.ts:53` hard-codes `RECT_POSE_DESCRIPTOR.translate`, verified) and **flip** (`flip.ts:38` hard-codes `RECT_POSE_DESCRIPTOR`, verified) for geometry-in-*pose* nodes — the inverse regime — and the consumer-side `applyPoseToObj` @ `apps/draw/src/poseUpdate.ts:52` hand-rolls `scalePathToBounds` (verified) which also ignores rotation (resizing a rotated path scales the *unrotated* AABB → visible shear).

### Recommended convention

**Adopt geometry-in-data as the consumer-facing convention (pose = AABB + rotation; geometry in `data.path`), and make the kit's resize/translate/flip projection scale/transform `data.path` instead of relying on `isPathLike(pose)`.**

Rationale: geometry-in-data is what apps/draw, the renderer's `PATH_PAINTER`, and every world-space action (`pathInWorld`, slice, booleans) already assume. Flipping the whole app to geometry-in-pose would mean putting `commands`/`coords` on every pose and is a far larger change. The defect is not the convention — it's that the kit's *default* projection only knows how to scale geometry when it's *on the pose*, and silently no-ops when it's in data.

**Concrete changes for polygon-content nodes to resize/move/rotate uniformly:**

1. **Provide a geometry-in-data `PoseProjection`** that reads/writes `data.path`. Today `AUTO_POSE_DESCRIPTOR` inspects only the pose; it has no access to `data`. Two viable shapes:
   - **(a) App-side projection** — apps/draw wires a `resizePolicy.projection` (and the equivalent for nudge/flip/move once they accept a `geometry` dep) whose `remapBounds`/`translate` operate on the node's `data.path` via `pathPoseDescriptor` + `scalePathToBounds`/`translatePath`, with rotation handled about the AABB center. This is the targeted fix and keeps the kit's pose-only model intact.
   - **(b) Kit-level data-aware descriptor** — give the kit a first-class "geometry-in-data" mode where the resize action, when the pose is a bare AABB and the node carries `data.path`, remaps the path. This is the deeper fix and removes the foot-gun for all future consumers.

   I recommend **(b)** as the real foundation (consumer pressure is not a scoping factor here, per project norms), with **(a)** as the interim if (b) can't land in one pass. Flag: I'm **uncertain whether the resize action currently has the node's `data` in scope** at the projection call site — `resize.ts` operates on poses; wiring `data.path` through requires confirming the action can reach the node body. Verify before committing to (b).

2. **Route nudge + flip through AUTO instead of bare RECT.** Replace `nudge.ts:53` `RECT_POSE_DESCRIPTOR.translate` → `AUTO_POSE_DESCRIPTOR.translate`, and `flip.ts:38` → `AUTO_POSE_DESCRIPTOR`. This fixes the geometry-in-*pose* regime immediately. (For geometry-in-data it's still inert until step 1 lands, but it removes the divergence-from-move.)

3. **Extract one `translatePose(pose, dx, dy, projection?)` helper** (from `move.ts:77` `translatePoseGeneric`) and have move/nudge/align/container-cascade all call it. Default `align`'s `geom` to `AUTO_POSE_DESCRIPTOR` not `RECT` (`align.ts:94`).

4. **Mint-leaf helper.** Slice / release-compound / booleans each independently mint `{AABB pose, data.path polygon, rotation:0}`. Extract ONE `mintPathLeaf` so the convention is enforced in one place — and so step 1's fix (whichever projection convention) is guaranteed to apply to all three.

5. **Fix `applyPoseToObj`** (`poseUpdate.ts:52`) to route through the same projection rather than hand-rolling `scalePathToBounds` (which ignores rotation).

---

## 3. Ranked work items

Bugs first, then latent-risks, then cosmetic. "Blast radius" = what can visibly break if the change is wrong.

| # | Finding | Severity | Files to touch | Consolidation | Blast radius |
|---|---|---|---|---|---|
| 1 | **Resize-after-boolean / polygon-content resize** (anchor bug) | **BUG** | `resize.ts` projection path; new geometry-in-data descriptor; `apps/draw/App.tsx:1401` SceneCanvas wiring; `mintPathLeaf` for `App.tsx:946,700`, `sliceCommit.ts:117`; `poseUpdate.ts:52` | Make resize transform `data.path` for AABB-pose nodes (convention §2). One mint helper. | **High** — touches every resize in apps/draw. Must not regress rect resize (the common case). Gate behind the regression test in §4. |
| 2 | **nudge + flip use rect-only descriptor** | **BUG** | `nudge.ts:53`, `flip.ts:38` (+ optional `AUTO`/`geometry` dep) | Swap `RECT_POSE_DESCRIPTOR` → `AUTO_POSE_DESCRIPTOR`; share `translatePose` helper | **Low-med** — nudge/flip only. Rect poses unaffected (AUTO rect branch == RECT). |
| 3 | **Marquee/lasso drop polygon-pose nodes** (`hitTestAABB` rect-only, wired for both area-select + lasso fallback) | **BUG** | `src/canvas/deps/aabbHitTest.ts:18`, `deps/areaSelect.ts:31`, `deps/lassoSelect.ts:27`; fix stale comment `SceneCanvas.tsx:372-375` | Make `hitTestAABB` dispatch via `isPathLike`/`aabbOfPose` like `useSceneSelectTool.hitTestArea:147`; extract one `hitTestArea(scene,rect)` the 4 sites share | **Med** — selection results change for non-rect poses (the fix is *additive*: previously-undroppable nodes become selectable). Also fixes rotated-rect picking. |
| 4 | **applyPoseToObj** hand-rolled resize, ignores rotation | **High** (consumer) | `apps/draw/src/poseUpdate.ts:52` | Route through kit projection (folds into #1) | **Med** — apps/draw pose-edit panel + any setPose-driven resize. |
| 5 | **3 private `unionBounds` copies** vs public canonical | latent-risk | `align/align.ts:39`, `defaults/align.tsx:44`, `resize.ts:219` | Delete all 3; import `unionBounds` from `features/groups/unionBounds`; coerce `!` at guarded call sites | **Low** — align/resize framing. Add cross-test (§4). |
| 6 | **Container-move cascade** — 2 rect-only copies vs projection-aware commit | latent-risk | `sceneAdapter.ts:280` (default → AUTO), delete dead inline cascade `useSceneSelectTool.ts:112-137` | Route all through `translatePose`; the live `move.ts:732` path is already correct | **Med** *if a live caller appears* — currently both rect-only copies are dead/opt-in-unused. |
| 7 | **`pathAtPose` re-implements `pathInPoseFrame`** | latent-risk | (a) promote `pathInPoseFrame` to public (`paths/index.ts:49`, `src/index.ts:488`); (b) delete `svgExport.ts:55`, call `pathInPoseFrame` in `leafToObj` (`App.tsx:92`); (c) re-point `useModality.ts:101` anchor offset | One local-frame projection shared by painter + export + anchors | **Med** — SVG export geometry + path-edit anchor placement. **Blocked** until (a). |
| 8 | **`rotationRender.ts` dup of kit rotation primitives** | cosmetic (dead) | Delete `apps/draw/src/rotationRender.ts` + `.test.ts` | None — zero prod importers (guard-grep first) | **None** |
| 9 | **`rotationHitTest.ts` dup, silhouette-blind** | cosmetic (dead) | Delete `apps/draw/src/rotationHitTest.ts` + `.test.ts`; promote `poseContainsRotated` to public if a real consumer appears | None — zero prod importers | **None** |
| 10 | **client→world: 8 inline copies** | latent-risk | New `clientToWorld` in `src/core/viewport/`; re-point all 8 sites | One inverse-view helper (rect-subtracting) | **Med** — every HUD/affordance/pointer hit-point. Pure refactor; test by equality with old inline math. |
| 11 | **point-in-polygon / segmentsCross dups** | cosmetic | `polygonHitTestRect.ts` (export kernel), `pathHitTest.ts` (import), `tessellate.ts:308` (share predicate); new `segmentMath.ts` | One crossing predicate, one segment-cross | **Low** — hit-test. Add non-convex-polygon agreement test. |
| 12 | **corner→anchor table inlined 3×** | latent-risk | `cornerHandles.ts` (export `CORNER_ANCHORS`), `affordanceAt.ts:96`, `cornerResize.ts:45`, decode via `fixedCornerOf` in `resize.ts:108` | One ordered corner/anchor descriptor | **Med** — wrong-fixed-corner resize if mismatched. Add encode/decode agreement test. |
| 13 | **seed node duplicates pose coords into rect path** | cosmetic | `App.tsx:892` → `rectPath(0,0,160,100)` | Path-at-origin convention; placement on pose only | **None** (rect rebases regardless) |

---

## 4. Regression guard

A single **parametrized** test that pins the geometry contract across every node-creation path. This is the gate for work item #1 — it should **fail today** for polygon-content nodes and pass after the fix.

**Location:** `src/interactions/actions/__tests__/geometryContract.test.ts` (kit-level, using the same `useScene`/resize-action harness the resize tests use) — and a mirror in `apps/draw/src/__tests__/` that exercises the *actual* apps/draw `SceneCanvas` wiring (since the bug is specifically that apps/draw wires no projection).

**Shape:**

```
const FACTORIES = [
  { name: 'rect',            make: () => mintRect(...) },
  { name: 'ellipse',         make: () => mintShape('ellipse', ...) },   // pathForShape
  { name: 'star',            make: () => mintShape('star', ...) },
  { name: 'polygon',         make: () => mintShape('polygon', ...) },
  { name: 'pen',             make: () => mintPen([...beziers]) },
  { name: 'boolean-union',   make: () => booleanOf('union',     A, B) },
  { name: 'boolean-intersect',make:() => booleanOf('intersect', A, B) },
  { name: 'boolean-subtract',make: () => booleanOf('subtract',  A, B) },
  { name: 'slice-piece',     make: () => sliceFirstPiece(node, line) },
];

const OPS = [
  { name: 'resize-2x',  apply: n => resize(n, scaleBounds(boundsOf(n), 2)) },
  { name: 'resize-nonuniform', apply: n => resize(n, {w:*3, h:*1}) },     // catches aspect-only scaling of box-not-contents
  { name: 'move',       apply: n => move(n, 37, -19) },
  { name: 'nudge',      apply: n => nudge(n, 1, 0) },                     // catches #2
  { name: 'rotate-30',  apply: n => rotate(n, deg(30)) },
  { name: 'flip-x',     apply: n => flip(n, 'x') },                      // catches #2
];

for (const f of FACTORIES) for (const op of OPS) {
  test(`${f.name} :: ${op.name} transforms contents, not just the frame`, () => {
    const before = f.make();
    const beforeWorld = pathInWorld(geometryOf(before), before.pose);   // canonical world geometry
    const after = op.apply(before);
    const afterWorld  = pathInWorld(geometryOf(after), after.pose);

    // Core assertion: the WORLD geometry transformed by the same map as the pose AABB.
    // For resize: every vertex of afterWorld lies on the affine image of beforeWorld
    //   under the box→box map (scaleBounds). For move/nudge: +dx,+dy. For rotate: rotated
    //   about AABB center. For flip: mirrored across the centerline.
    expect(afterWorld).toMatchTransformOf(beforeWorld, op.expectedMap);

    // Anti-regression for the anchor bug specifically:
    //   the world AABB of the CONTENTS must equal the pose AABB (no tear-loose).
    expect(boundsOfPath(afterWorld)).toBeCloseToRect(aabbOf(after.pose));
  });
}
```

**Key assertions:**
- `afterWorld` must be the affine image of `beforeWorld` under the *same* map applied to the pose — this catches "box scaled, contents not" (the anchor bug), since the contents would be unchanged while the expected map scales them.
- `boundsOfPath(afterWorld) ≈ aabbOf(after.pose)` — the contents' world bounds must still fill the pose box. This is the single invariant that geometry-in-data must preserve and that resize currently violates for polygons.
- The `rotate` + `resize` combination (resize a rotated polygon) catches the `applyPoseToObj` shear (#4).

**Plus two narrow cross-tests** (cheap, prevent silent re-divergence):
- align vs resize derive the *same* union frame for a fixed multi-selection (locks #5 — assert both route through `features/groups/unionBounds`).
- `cornersFor().fixedPoint === buildPointSnapContext().fixedCorner` for each of the 4 anchors on a rotated pose (locks #12).

---

### Uncertainties flagged
- **Whether the resize action has node `data` in scope** at the projection call site (determines feasibility of the kit-level §2(b) fix vs the app-side §2(a) fix). Verify in `resize.ts` before committing to (b).
- **`poseContainsRotated` public promotion** is a prerequisite *only if* a real consumer needs standalone rotated hit-testing; for now apps/draw gets it via `SceneCanvas` default picking, so #9 is pure deletion.
- The labkit/`viewTransform.ts` `screenToWorld` helpers are **not** reuse candidates for #10 — different `{pan,zoom}` representation, no rect subtraction. Do not "consolidate" onto them.

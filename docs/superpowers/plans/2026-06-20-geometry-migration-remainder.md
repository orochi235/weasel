# Geometry Migration — Remainder (Phases 4–6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the geometry migration atomically — complete the four remaining kernel seam re-points (2/3/5/6), fix the marquee/lasso silhouette bug (#3), and clear the deferred dedup/dead-code items (#5/#6/#8/#9/#12/#13) — so nothing carries over.

**Predecessor:** `2026-06-20-geometry-migration.md` (Phases 2–3) is MERGED to `main` (merge `96a58fca`). The `@weasel-js/geom` kernel, `transformPath`, `pathInPoseFrame` (now box→box rebasing + public), and the opt-in `geometryProjection` seam all already exist. Both contract gates are green.

**Source specs:** `docs/superpowers/specs/2026-06-20-geometry-migration-design.md` (the seam table §"Seam re-pointing", the ranked items §"Ranked work items", Phases 4–5) and `...-geometry-kernel-representation-design.md` (kernel API).

**Execution:** ONE worktree off `main`; one atomic merge at the end. Worktree dep setup is non-obvious — see the worktree-install memory: `pnpm`/`npm` both fail to link the workspace (root pkg IS `@weasel-js/core`); instead `rsync -a --exclude='.vite' --exclude='.cache' --exclude='.vitest' /Users/mike/src/weasel/node_modules/ ./node_modules/`, then run `npx vitest run --project=kit` and `apps/draw` explicitly (the full `vitest run` chokes on the browser project's missing `.vite` manifest). Pre-existing noise to ignore: 4 `tsc` errors in `demo/demos/MoveSnapDemo.tsx`.

**Kernel API reminders (verified):** `Mat3 = [a,b,c,d,e,f]` (DOMMatrix order); `Box = [minX,minY,maxX,maxY]` (flat tuple, NOT `{x,y,w,h}`); `boxToBox`, `transformCoords`, `invert(m): Mat3|null`, `applyToPoint(m,x,y):[x,y]`, `rotateAboutPoint(cx,cy,rad):Mat3`, `pointInPolygon(coords,px,py)`, `segmentsCross(...)`, `boundsOfCoords(coords):Box|null`. `transformPath(path, Mat3)` and `pathInPoseFrame` are public from `@weasel-js/core`.

**Discipline:** TDD; one logical change per commit; run the named suite after each; commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Behavior-preserving tasks: guard with the existing suite (capture baseline count, confirm unchanged after). Each task leaves the suite green AND both contract gates green (kit 54/54, draw 36/36).

---

## PHASE 4 — Dead-code & low-risk dedup (do first; smallest blast radius)

### Task 4.1: Delete dead `rotationRender.ts` (#8) and `rotationHitTest.ts` (#9)
**Guard-grep FIRST.** These are documented as dead duplicates.
- [ ] `git grep -n "rotationRender\|rotationHitTest"` across `src/` and `apps/`. Confirm the only references are the files themselves + their own test files (no live import). If ANY live consumer exists, STOP and report — do not delete a live file.
- [ ] `find src -name 'rotationRender*' -o -name 'rotationHitTest*'` to get exact paths (+ their `.test.ts`).
- [ ] Delete each source file and its colocated test.
- [ ] `npx vitest run --project=kit` → all pass (count drops by the deleted tests; no FAILURES). `npx tsc --noEmit` → no new errors.
- [ ] Commit: `chore(geom): delete dead rotationRender + rotationHitTest dups (#8/#9)`.

### Task 4.2: Seed-node rect-path dedup (#13)
The seed/insert path duplicates pose coords into a rect path instead of using an origin rect.
- [ ] Find the site (spec: "seed node duplicates pose coords into rect path"). `git grep -n "kind: 'rect'" src/tools src/interactions` and look for a seed/insert default that builds a rect path from pose x/y/w/h. Read it.
- [ ] Replace with `rectPath(0, 0, w, h)` at origin (geometry-in-local-frame; pose carries position) IF that matches the convention the renderer expects for that node; otherwise leave and report. VERIFY against how other inserts build their path. Behavior-preserving.
- [ ] Run the relevant tool/insert tests + `--project=kit`. Commit: `refactor(geom): seed node uses origin rectPath, not duplicated pose coords (#13)`.

### Task 4.3: Dedup the 3 private `unionBounds` copies (#5)
Canonical owner: `src/features/groups/unionBounds.ts` (public `unionBounds`, operates on `Bounds` objects). Delete the 3 private copies:
- [ ] Read `unionBounds.ts` to confirm its signature (it returns `Bounds | undefined` — note the null case).
- [ ] Replace the private copies at `src/interactions/actions/align/align.ts:~39`, `src/interactions/actions/defaults/align.tsx:~44`, and `computeUnionBounds` in `src/interactions/actions/defaults/resize.ts:~219` with calls to the canonical `unionBounds`. At guarded call sites coerce `unionBounds(b)!` where the caller already guarantees non-empty (match existing guards). Remove the now-dead private fns.
- [ ] Cross-check the spec's narrow cross-test intent: "align vs resize derive the same union frame." Run align + resize suites + `--project=kit`. Commit: `refactor(geom): dedup unionBounds onto the canonical owner (#5)`.

### Task 4.4: Corner→anchor table (#12)
The corner→anchor mapping is inlined 3×. Consolidate to one ordered `CORNER_ANCHORS` + a `fixedCornerOf` decode.
- [ ] `git grep -n` the inlined corner/anchor tables (resize handle anchor math; spec says inlined 3×). Read all three.
- [ ] Extract one ordered `CORNER_ANCHORS` constant + `fixedCornerOf(...)` decoder in the resize geometry area; re-point all three sites. Behavior-preserving.
- [ ] Add/keep the spec's cross-test: "corner encode/decode on a rotated pose." Run resize suites + `--project=kit`. Commit: `refactor(geom): one CORNER_ANCHORS table; decode via fixedCornerOf (#12)`.

### Task 4.5: Container-move cascade rect-only copies (#6)
- [ ] Locate the container-move cascade rect-only pose copies (spec: "route through `translatePose`; delete dead inline cascade"). `git grep -n` cascade/container-move pose translation. Determine if the copies are dead/opt-in-unused (spec says they currently are) — confirm with a guard-grep for live callers.
- [ ] If dead: delete the inline cascade. If live: route through the shared `translatePose`/`translatePoseGeneric` helper. Do NOT change behavior for any live caller — verify with its test.
- [ ] Run `--project=kit`. Commit: `refactor(geom): container-move cascade routes through translatePose (#6)`.

---

## PHASE 5 — Seam re-points 2/3/5/6 (behavior-preserving kernel composition)

### Task 5.1: Seam 5 — `rotateAroundAABBCenter` → kernel `rotateAboutPoint`
`src/canvas/poseRotation.ts` builds a rotation matrix by hand (`rotationMatrixAbout` → a 9-element `Float32Array`, column-major, for the DrawCommand wrap). The kernel `rotateAboutPoint(cx,cy,rad)` returns a 6-element `Mat3`.
- [ ] Read `poseRotation.ts`. The render-side consumer needs the 9-el f32 form (`wrapWithPoseRotation`/`DrawCommand`). Compose: compute the affine via kernel `rotateAboutPoint` (6-el), then expand to the 9-el column-major f32 the DrawCommand wrap expects (write a tiny `mat3ToRenderMatrix(m6): Float32Array` adapter IF the shapes differ). The GLUE (DrawCommand wrap) stays render-side; only the matrix math moves to the kernel. If the existing hand-rolled matrix is already exactly the kernel formula and re-pointing buys nothing but indirection, note that and prefer leaving it — VERIFY the formulas match first; the value is single-ownership of the rotate-about-point math.
- [ ] Guard: `npx vitest run src/canvas/poseRotation` (+ rotationParity test) + `--project=kit`. Behavior-preserving. Commit: `refactor(geom): rotateAroundAABBCenter composes on kernel rotateAboutPoint (seam 5)`.

### Task 5.2: Seam 2 — `pathInWorld` rotation → kernel
`src/features/paths/pathInWorld.ts` `pathInWorld` already calls `pathInPoseFrame` (seam 1, done) then `rotatePathAround`. Re-point the rotation step to compose on the kernel: build the rotation `Mat3` via `rotateAboutPoint(aabbCenter)` and apply via `transformPath` (which handles rect→polygon promotion), replacing the bespoke `rotatePathAround`/`poseRotationOf` path IF that's a true simplification.
- [ ] Read the current `pathInWorld` + `rotatePathAround` + `poseRotationOf` (in `features/paths/poseRotation.ts`). Note: `pathInWorld.test.ts` pins exact rotated outputs (e.g. rect→polygon promotion, bezier control-point rotation) — these MUST stay green unchanged.
- [ ] Re-point rotation onto `rotateAboutPoint` + `transformPath`. The rect→rotated-polygon promotion is already in `transformPath`. Keep `poseRotationOf`'s gate (when rotation ≈ 0, return the unrotated local path). Behavior-preserving — `pathInWorld.test.ts` is the guard.
- [ ] `npx vitest run src/features/paths/pathInWorld.test.ts` (unchanged pass count) + `src/features/paths` + `--project=kit`. Commit: `refactor(geom): pathInWorld rotation composes on kernel rotateAboutPoint (seam 2)`.

### Task 5.3: Seam 3 — `worldEditToStorage` → kernel `invert`
Same file. `worldEditToStorage` inverse-rotates a world-edited polygon back to storage. Re-point the inverse rotation onto kernel `invert(rotateAboutPoint(...))` (or `rotateAboutPoint(cx,cy,-r)`) + the seam-1 realign.
- [ ] Read `worldEditToStorage`. It currently uses `rotatePathAround(worldPath, cx, cy, -rotation)`. Re-point onto the kernel rotation (negative angle, or `invert`). Preserve the round-trip invariant `pathInWorld(result.path, result.pose) ≈ worldPath` and the pose-`rotation` preservation. The realign-to-AABB-origin glue stays.
- [ ] Guard: the existing pen-edit / anchor round-trip tests (`git grep -l worldEditToStorage`) + `--project=kit`. Behavior-preserving. Commit: `refactor(geom): worldEditToStorage inverse-rotation composes on kernel invert (seam 3)`.

### Task 5.4: Seam 6 — `poseContainsRotated` → kernel `invert`+`applyToPoint`+`pointInPolygon`
`src/canvas/SceneCanvas/poseGeometry.ts`. Re-point the rotated-hit-test: transform the world point to pose-local via `invert(rotateAboutPoint(center, rotation))` + `applyToPoint`, then dispatch silhouette (`pointInPolygon` for path-like, box-contains for rect). The silhouette dispatch (`isPathLike`/rect fast path) STAYS.
- [ ] Read `poseGeometry.ts` (`poseContainsRotated`/`poseContains`/`rotatePoint`). Re-point `rotatePoint`'s inverse rotation onto the kernel; route the polygon containment to kernel `pointInPolygon` (flat coords). Keep the dispatch + stroke-slop logic.
- [ ] Guard: hit-test suites for poseGeometry + `--project=kit`. Behavior-preserving. (Spec note: `poseContainsRotated` may be promoted public only if a standalone consumer needs it — it does NOT here, so keep it internal.) Commit: `refactor(geom): poseContainsRotated composes on kernel invert+pointInPolygon (seam 6)`.

---

## PHASE 6 — The selection bug (#3) — behavior change, own gate

### Task 6.1: Make marquee/lasso area-select silhouette-aware (#3)
`src/canvas/deps/aabbHitTest.ts` `hitTestAABB` is rect-only, so marquee/lasso DROP polygon-pose (and silhouette) nodes whose AABB intersects but whose silhouette doesn't (or vice-versa). Make it silhouette-aware via the kernel; extract one `hitTestArea` used by both `areaSelect.ts` and `lassoSelect.ts`.
- [ ] **Write the failing test first.** Add `src/canvas/deps/hitTestArea.test.ts` (or extend the area-select test): a polygon-silhouette node whose AABB overlaps the marquee rect but whose actual silhouette does/doesn't — assert the new silhouette-aware result. Pick a concrete asymmetric shape (e.g. a triangle) where rect-AABB and silhouette disagree. Run → FAIL.
- [ ] Read `aabbHitTest.ts`, `areaSelect.ts`, `lassoSelect.ts`. Extract `hitTestArea(node/pose, rectOrLasso)` that: for rect poses uses `aabbIntersectsRect`; for silhouette/path poses tests the silhouette against the area via kernel `pointInPolygon`/`segmentsCross` (+ `aabbOfPose` fast-reject). This is ADDITIVE — previously-undroppable nodes become selectable; the spec flags: "snapshot/affirm in tests."
- [ ] Make both `areaSelect` and `lassoSelect` call the one `hitTestArea`.
- [ ] Run → PASS. Then `--project=kit` + confirm both contract gates still 54/54 + 36/36. Some existing area-select snapshot tests may legitimately change (more nodes selected) — update them WITH a comment noting the silhouette-awareness; do NOT loosen an assertion that encodes a real requirement.
- [ ] Commit: `fix(geom): marquee/lasso area-select is silhouette-aware via the kernel (#3)`.

---

## PHASE 7 — Final atomic checkpoint

### Task 7.1: Release gate + merge
- [ ] `npx tsc --noEmit` (only the 4 pre-existing `MoveSnapDemo.tsx` errors) ; `npx vitest run --project=kit` (all pass) ; `npx vitest run apps/draw` (all pass) ; `npx tsup` (build clean).
- [ ] Both contract gates green (kit 54/54, draw 36/36).
- [ ] Update the migration design spec's Status line to note Phases 4–6 complete (deferred list now empty except anything genuinely punted with a reason).
- [ ] Merge the worktree branch into `main` (local, `--no-ff`, descriptive message). Do NOT push (needs Mike's explicit OK). Remove the worktree.

---

## Notes / guardrails
- Behavior-preserving tasks: if a test fails, FIRST determine whether it encoded the OLD (buggy/translate-only) behavior or a real regression. Update only tests that encoded superseded behavior, with a comment. Never weaken a contract-gate assertion.
- Seam 5's 6-el-vs-9-el matrix shape is the one real adaptation risk — verify the render-side DrawCommand wrap still gets the matrix form it expects.
- If any "dead" file (#8/#9) or "dead" cascade (#6) turns out to have a live consumer, STOP and report rather than delete.
- Keep `poseContainsRotated` internal (no public promotion needed).

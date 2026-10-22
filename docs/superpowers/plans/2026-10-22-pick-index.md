# Pick index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Picks (point, marquee, lasso; core and kernel3d) consult a BVH instead of testing every node, with results identical to today's walk.

**Architecture:** A dimension-generic BVH in `@weasel-js/geom/nd`. Core caches one index per (scene, descriptor), rebuilt lazily when the scene version, override generation or node-memo generation moves; `pickWalk` asks the source for an ordered candidate list when the query carries a broad-phase box. kernel3d caches a 3D index per world for its ray pick and marquee.

**Tech Stack:** TypeScript, vitest (`core` project for `packages/core`, see `npm run check:test-projects` for geom and kernel3d), vitest bench.

**Spec:** `docs/superpowers/specs/2026-10-22-pick-index-design.md` — read it first.

## Global Constraints

- No false negatives: the indexed walk returns exactly the ids, in exactly the order, the unindexed walk returns.
- Every existing gate and exact test in `pickWalk` still runs on the candidates; the index only pre-filters.
- `NodeInk.outset` must not depend on `NodeInkCtx.scale` (decided 2026-10-22); screen reach goes in `outsetPx`.
- Changesets are `patch`. Never write a `bump-approved` marker.
- `npm run check:size`: no source file over 400 lines, no function over 120. `pickWalk.ts` is 358 lines and `kernel3d/src/deps.ts` is allowlisted — put new logic in new files.
- No bare `requestAnimationFrame`; none is needed here.
- Tests are scoped while iterating (`npx vitest run --project=<p> <file>`). One agent — the final task — runs fleet checks: `npm run test:fleet`, `npm run test:gate`, `npm run test:fleet:postbuild -- HEAD`.

## Review Focus

- A node moved by a pose override mid-drag (no scene op) must be found at its new place by the next pick — owned by Task 3's staleness test.
- A `{ px }`-stroked node picked after zooming out far must still be hit at its stroke edge — Task 3's zoom equivalence test.
- A connector (derived node) picked by marquee, point and lasso at its painted path — Tasks 1 and 3.
- A node under a symmetry/repeat container picked at a copy — Task 3 (always-test list) equivalence fixture.
- A node on a parallax layer picked after the camera pans — Task 3 equivalence fixture with `camera`.

---

### Task 1: Marquee tests a derived node at its derived path

**Files:**
- Modify: `packages/core/src/canvas/deps/hitTestArea.ts` (`walkArea`'s `hits` and `clipAdmits`)
- Test: `packages/core/src/canvas/deps/hitTestArea.test.ts`

- [ ] **Step 1: Write the failing test** `marquee takes a derived node where its path is painted, not at its placeholder pose`: two rect nodes far apart and a node whose `dependsOn` draws a path between them (find an existing derived-node fixture with `grep -rn dependsOn packages/core/src/canvas/*.test.ts`). A marquee rect covering only the path's midpoint returns the derived node's id; a marquee covering only the placeholder pose's origin does not.
- [ ] **Step 2: Run** `npx vitest run --project=core packages/core/src/canvas/deps/hitTestArea.test.ts`. Expected: FAIL. If it passes, the bug is not real: delete the "To check while building" section of the spec and keep the test as a pin.
- [ ] **Step 3: Fix** — `hits(node, pose, derived, inherited)` tests `derived` as the outline and its bounds as `b` when present, the way `scenePointQuery` does; same for `clipAdmits`.
- [ ] **Step 4: Run** the file, then `npx vitest run --project=core packages/core/src/canvas`. Expected: PASS.
- [ ] **Step 5: Commit** `test marquee and lasso against a derived node's path, not its placeholder pose`.

### Task 2: BVH in `@weasel-js/geom/nd`

**Files:**
- Create: `packages/geom/src/bvh/bvh.ts`, `packages/geom/src/bvh/bvh.test.ts`
- Modify: `packages/geom/src/nd/index.ts` (export), `packages/geom/package.json` description (mention the BVH under `./nd`)

**Interfaces — Produces:**
```ts
/** Box layout: [min_0..min_{d-1}, max_0..max_{d-1}]. */
export type BoxN = ArrayLike<number>;
export interface HalfSpace { normal: ArrayLike<number>; offset: number } // inside: dot(normal, x) + offset >= 0
export interface Bvh<K> {
  readonly dim: number;
  readonly size: number;
  /** False (and not stored) when any coordinate is non-finite or min > max. */
  insert(key: K, box: BoxN): boolean;
  update(key: K, box: BoxN): boolean;
  remove(key: K): boolean;
  refit(): void;
  rebuild(): void;
  /** visit returns false to stop. */
  queryBox(box: BoxN, visit: (key: K) => boolean | void): void;
  queryPoint(p: ArrayLike<number>, visit: (key: K) => boolean | void): void;
  /** Leaves in nondecreasing order of box entry distance t (t >= 0, t <= tMax). */
  raycast(origin: ArrayLike<number>, dir: ArrayLike<number>, visit: (key: K, t: number) => boolean | void, tMax?: number): void;
  /** Leaves whose box is not wholly outside any half-space (conservative). */
  queryHalfSpaces(planes: readonly HalfSpace[], visit: (key: K) => boolean | void): void;
}
export function createBvh<K>(dim: number, entries?: Iterable<readonly [K, BoxN]>): Bvh<K>;
```
Boundary semantics: boxes touching at an edge count as meeting (closed intervals) — callers apply their own exact test.

- [ ] **Step 1: Tests**: `queryBox matches a brute-force overlap scan` (randomized, dim 2 and 3, 2,000 boxes, 200 queries, fixed seed — compare sorted key sets); `queryPoint matches brute force`; `raycast visits in nondecreasing t and matches slab-test brute force`; `queryHalfSpaces never drops a box inside all planes`; `update moves a box and the old position no longer answers`; `remove drops it`; `insert refuses NaN / Infinity / inverted boxes and returns false`; `refit after many updates still matches brute force`; `rebuild gives the same answers`; `empty tree answers nothing`.
- [ ] **Step 2: Run** `npx vitest run packages/geom/src/bvh/bvh.test.ts` (check the project with `npm run check:test-projects`). Expected: FAIL (module missing).
- [ ] **Step 3: Implement**: top-down build splitting at the median of the longest axis of centroids (leaf size ≤ 4), flat `Float64Array` node boxes; `insert` after build descends by least enlargement; `raycast` uses a priority queue (binary heap) on entry t.
- [ ] **Step 4: Run** the tests, `npm run check:size`, `npm run check:imports`. Expected: PASS.
- [ ] **Step 5: Commit** `add a dimension-generic BVH to geom/nd`.

### Task 3: Core pick index and the walk's candidate path

**Files:**
- Create: `packages/core/src/canvas/pickIndex/scenePickIndex.ts` (build, cache, freshness), `packages/core/src/canvas/pickIndex/nodeBroadBox.ts` (one node's box), `packages/core/src/canvas/pickIndex/scenePickIndex.test.ts`, `packages/core/src/canvas/pickIndex/pickIndex.equivalence.test.ts`
- Modify: `packages/core/src/canvas/pickWalk.ts` (types + candidate path), `packages/core/src/canvas/nodeShapeTypes.ts` (`NodeInk.outset` and `NodeInkCtx.scale` doc comments)

**Interfaces — Consumes:** `createBvh` (Task 2). **Produces:**
```ts
// pickWalk.ts
export interface PickBroad {
  /** World box, already grown by the query's own slop. */
  box: { x: number; y: number; width: number; height: number };
  /** Screen px per world unit at the asking view (least axis); grows the box by the index's max outsetPx. Omit for 0. */
  pxPerWorld?: number;
}
// PickQuery gains:  broad?: PickBroad   (inPlane must return a query whose broad is carried into the plane)
// PickSource gains: candidates?(broadFor: (layer: string | undefined) => PickBroad | null | undefined): readonly PickCandidate<TPose>[] | null
//   broadFor: null = layer unreachable (skip), undefined = this layer's query has no broad (source must return null → full walk).
//   Returns back-to-front candidates: the tree hits of every reachable layer plus the always-test list, sorted by render index.
// ScenePickSourceOptions gains: index?: { descriptor: PoseDescriptor<unknown> }   — when set, the source has `candidates`.

// scenePickIndex.ts
export interface ScenePickIndex {
  /** Ids per layer whose broad box meets `box` (world, in that layer's own coordinates). */
  near(layer: string | undefined, broad: PickBroad, out: Set<string>): void;
  readonly always: ReadonlySet<string>;
  readonly maxOutsetPx: number;
  renderIndexOf(id: string): number;
}
export function scenePickIndex(scene: Scene<unknown, string, unknown>, descriptor: PoseDescriptor<unknown>): ScenePickIndex;
```
`pickWalk`: when `q.broad` and `src.candidates` exist, iterate `src.candidates(layer => queryFor(layer) === null ? null : queryFor(layer)!.broad)` instead of `order()`; when it returns null, walk `order()`. Keep `copying` computed from the full `order()`.

Node box (`nodeBroadBox`): union of (a) `regionBoundsOf(node, pose, poseDescriptorForNode(descriptor, node))` and (b) the visual bounds the point query's `poseContainsRotated` tests with `descriptor`, on `scenePaintedPoseOf(scene)` poses; for a derived node, the bounds of its derived path instead of the pose; grown on every side by `findShapeInk(node, pose, { scale: 1, inherited }).outset`. Track `max(outsetPx)`. Containers are indexed like any node. Always-test: nodes with a copying ancestor, nodes `insert` refused.

Freshness key: `scene.getVersion()`, `scene.overrides.getGeneration()`, the node-memo generation (export a getter from `core/scene/nodeMemo.ts` if none exists), and the font glyph epoch if `findShapeInk` reads text metrics (check `NodeShape.ts:147-156`). Cache: `WeakMap<Scene, Map<PoseDescriptor, {key, index}>>`.

- [ ] **Step 1: Equivalence test** `indexed walk returns what the full walk returns`: build fixture scenes — rotated rects, 24-gons, a stroked node with `{ px }` width, a `dependsOn` connector, a clipping container, a container with `copiesFromPose`, a parallax layer queried with a `camera`, a node faded by override alpha, locked and hidden nodes — and for 300 random marquee rects, lasso polygons and points, at view scales 0.05, 1 and 20, assert `pickWalk(indexedSource, q)` deep-equals `pickWalk(plainSource, q)` (same array, same order). Use `scenePointQuery` and the area queries from `hitTestArea.ts` (export a query builder from there if needed, or go through `hitTestArea(..., opts with index)`).
- [ ] **Step 2: Staleness tests** in `scenePickIndex.test.ts`: after a pick, (a) `scene.setPose` via op, (b) `scene.overrides` write + `commit()`, (c) a `setData` that changes a polygon's bounds via descriptor `forNode`, (d) reparent under a translated container under a composing strategy, (e) `registerNodeShape` of a painter with a larger outset — each moves a node, and the next indexed pick at the new place finds it and at the old place does not. Plus `a still scene does not rebuild` (spy on build count across 10 picks).
- [ ] **Step 3: Run** both files. Expected: FAIL (no index).
- [ ] **Step 4: Implement** the index, the walk path, and the `NodeInk` doc change: `outset` — "World units, independent of the view: a reach measured on screen goes in `outsetPx`. Pick indexes box nodes once for every zoom, so an `outset` that changes with `scale` goes unpicked."; `NodeInkCtx.scale` — "View scale, for resolving `{ px }` lengths, which `ink` reports in `outsetPx`/`insetPx`, never folded into `outset`."
- [ ] **Step 5: Run** both files, then `npx vitest run --project=core packages/core/src/canvas`, `npm run check:size`. Expected: PASS.
- [ ] **Step 6: Commit** `add a per-scene BVH pick index behind pickWalk`.

### Task 4: Every scene pick asks the index

**Files:**
- Modify: `packages/core/src/canvas/deps/hitTestArea.ts` (area, polygon, lasso entry points set `broad` and pass `index`), `packages/core/src/canvas/SceneCanvas/scenePointQuery.ts` (`broad`: point ± `pickTolerancePx / leastScale`, `pxPerWorld: leastScale`, carried in `inPlane`), `packages/core/src/canvas/SceneCanvas/useSceneSelectTool.ts` and the other `scenePickSource` callers found by `grep -rn scenePickSource packages/*/src` (pass `index: { descriptor }`)
- Test: `packages/core/src/canvas/SceneCanvas/useSceneSelectTool.index.test.tsx` (or the existing select-tool test file)

**Interfaces — Consumes:** `PickBroad`, `ScenePickSourceOptions.index` (Task 3).

- [ ] **Step 1: Test** `the select tool's getWorldPose agrees with the index's painted pose`: in a SceneCanvas with overrides, derived nodes and a composing container, for every node, `adapter.getWorldPose(id)` deep-equals `scenePaintedPoseOf(scene)(node)`. If any differ, that source does not get `index` — record which and why in the test name.
- [ ] **Step 2: Test** `hover and click pick through the index`: spy `scenePickIndex` build; hover over a node in a 1,000-node scene twice; the pick returns the same id as with the index disabled, and the index built once.
- [ ] **Step 3: Implement**, run the new tests and `npx vitest run --project=core packages/core/src/canvas`. Expected: PASS.
- [ ] **Step 4: Commit** `route marquee, lasso and point picks through the pick index`.

### Task 5: kernel3d picks through a 3D BVH

**Files:**
- Create: `packages/kernel3d/src/pickIndex.ts`, `packages/kernel3d/src/pickIndex.test.ts`
- Modify: `packages/kernel3d/src/deps.ts` (`createNodeAtPoint`, `createAreaSelect` call into `pickIndex.ts`), `packages/kernel3d/src/world.ts` (`bounds` doc comment: "a function of the node alone; a result that depends on anything else must come with a scene change, or picks go stale")

**Interfaces — Consumes:** `createBvh` with dim 3, `rayAt`, `screenBoxOf`. **Produces:**
```ts
export function worldPickIndex<TData, TLayer extends string>(world: World3d<TData, TLayer>): {
  nearestOnRay(ray: Ray, excluded: ReadonlySet<NodeId> | null): NodeId | null;
  inScreenRect(vp: Viewport3d, rect: ScreenBox): NodeId[];   // render order
};
```
Cached in a `WeakMap<World3d>` keyed on `scene.getVersion()`, `scene.overrides.getGeneration()` and `world.bounds` identity. `nearestOnRay`: raycast nearest-first; exact `intersectRayAabb`; stop once a leaf's entry t exceeds the best exact t; ties on t go to the lowest render index. `inScreenRect`: four side half-spaces from the rays through the rect's corners (plane through corner rays A and B has normal `cross(dirA, (originB + dirB) − originA)`, oriented so the center ray's point lies inside — works for perspective and orthographic), then today's exact `screenBoxOf` overlap, sorted by render index.

- [ ] **Step 1: Equivalence tests**: random 3D scenes (500 nodes, perspective and orthographic viewports), 200 random screen points and rects: `createNodeAtPoint` and `createAreaSelect().hitTestArea` return what the current scan returns (keep the scan as a test-local reference copy). Plus a tie test: two identical boxes, the first in render order wins.
- [ ] **Step 2: Run** `npx vitest run packages/kernel3d/src/pickIndex.test.ts` (project per `check:test-projects`). Expected: FAIL.
- [ ] **Step 3: Implement**, run, plus `npx vitest run packages/kernel3d`. Expected: PASS.
- [ ] **Step 4: Commit** `pick kernel3d nodes through a 3D BVH`.

### Task 6: Benches, docs, changeset, fleet

**Files:**
- Modify: `tests/perf/bench/hit-test.bench.ts` (indexed vs full-walk groups; a point-pick group; an index-rebuild group), `tests/perf/bench/BASELINE.md` (re-recorded hit-test rows), `docs/TODO.md`
- Create: `tests/perf/recorded/pick-index-2026-10-22/run.sh` (mirror `tests/perf/recorded/tessellate-bench-2026-10-21/run.sh`), `.changeset/<name>.md` (`patch` for `@weasel-js/geom`, `@weasel-js/core`, `@weasel-js/kernel3d`; prose states the `NodeInk.outset` tightening and the `world.bounds` contract)

- [ ] **Step 1:** Add the bench groups; run once locally on 100 nodes only to check they execute.
- [ ] **Step 2:** Record on the fleet: `onto do --kind bench --node studio --solo --out tests/perf/recorded/pick-index-2026-10-22 -- bash tests/perf/recorded/pick-index-2026-10-22/run.sh`, then merge into `BASELINE.md` with `node tests/perf/bench-report.mjs --merge` as that script documents.
- [ ] **Step 3: TODO**: delete the "Area and lasso picks walk every node" entry; add one P3 entry listing the remaining linear scans (`features/text/textHitAt.ts`, `features/measure/measureHit.ts`, `canvas/deps/slice.ts`, `diagram/src/portLayer.ts`, `diagram/src/labelDragLayer.ts`, `labkit/src/loupe/lens/lensHitBoxes.ts`, `geom/src/snap/pathSnap.ts` `findPathSnaps`, kernel3d `snap/sources.ts` `boxesOf`) that can move onto the index.
- [ ] **Step 4:** `npm run typecheck`, `npm run test:gate`, `npm run test:fleet`, `npm run test:fleet:postbuild -- HEAD`. Fix anything red.
- [ ] **Step 5:** Delete this plan and the spec (`git rm`), after checking nothing in the spec is needed past merge (the outset contract lives in the doc comment). Commit `record pick-index benches and retire its TODO, plan and spec`.

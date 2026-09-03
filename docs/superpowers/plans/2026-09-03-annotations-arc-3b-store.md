# Annotations arc 3b — the capability and the scene-backed store

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An instrument can declare annotation targets, and a pure store over a weasel `Scene` answers every question about the marks on them.

**Architecture:** The scene is the truth; the store is a facade. A mark is one leaf node — its pose is the mark's bounds in the target's world (CSS px at zoom 1), and its `data` carries `target`, `kind`, optional `points`, and the meaning tier (`title` / `status` / `tags` / `meta`) plus `seen`, the snapshot of the config keys the target said its positions depend on. Everything is pure and JSON-safe: no React, no DOM, no live `Scene` in persisted state.

**Scope boundary.** 3b builds the declaration and the store. The overlay that mounts a `SceneCanvas` over a target's `ref` and the palette→tool bridge are 3c; undo delegation and the built-in meaning chrome are 3d.

**Tech stack:** TypeScript, `@weasel-js/core` scene + ops, vitest (`--project=labkit`).

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, arc 3.

---

## Constraints this arc inherits (verified, arc 3a)

- **Persisted payloads must be JSON-safe.** `Instrument.serialize` never runs — `registerSerializers` has no callers — so `record.state` is `JSON.stringify`d raw. `scene.toJSON()` output is safe; a live `Scene` is not.
- **Payloads version themselves.** labkit's document migrations only reach top-level sections, never `trials[].state`.
- **Fractions, not pixels.** A mark's stored position is a fraction of its target's content box, so a resolution change does not move it. World units (CSS px at zoom 1) are what the scene holds; conversion happens at the store boundary.

## Deviation from the spec, and why

The spec writes `subscribe(fn: (change) => void)`. `Scene.subscribe` is a bare invalidation with no diff, so a `change` payload would have to be synthesized by diffing snapshots on every mutation — cost paid by every consumer, for information most do not use. This arc ships `subscribe(fn: () => void)` and consumers re-query. Revisit if a consumer genuinely needs the delta.

---

## File structure

**Created — `packages/labkit/src/annotations/`**
- `types.ts` — `Annotation`, `AnnotationData`, `AnnotationInit`, `AnnotationQuery`, `FracRect`/`FracPoint`, `AnnotationTarget`, `AnnotationsCapability`, `AnnotationsApi`
- `frac.ts` — fraction↔world, and the rounding policy
- `staleness.ts` — `seenFrom`, `isStale`
- `store.ts` — `createAnnotationStore`
- `index.ts` — the module barrel
- one `.test.ts` beside each of `frac`, `staleness`, `store`

**Modified**
- `packages/labkit/src/instrument/types.ts` — `annotations?:` on `Instrument`
- `packages/labkit/src/index.ts` — public exports
- `packages/labkit/src/index.test.ts` — assert the new surface

---

### Task 1: types and the capability declaration

- [ ] Write `annotations/types.ts` with every type named above. `AnnotationTargetInfo` is the geometry-relevant subset the store needs (`id`, `content`, `positionDependsOn`); `AnnotationTarget` extends it with `ref` and `view`, which only 3c reads.
- [ ] Add `annotations?: AnnotationsCapability<TS, TC>;` to `Instrument`, with a doc comment saying declaring it is what makes the trial provide the overlay and chrome.
- [ ] Export the types from `packages/labkit/src/index.ts`, and add an assertion to `index.test.ts`.
- [ ] `npx tsc --noEmit` clean; commit.

### Task 2: fraction↔world

- [ ] **Failing test first** (`frac.test.ts`): a rect at frac `{x:.25,y:.5,w:.5,h:.25}` on a `256×170` content box is world `{x:64,y:85,width:128,height:42.5}`, and the round trip returns the original. A zero-width content box must not produce `Infinity` or `NaN`.
- [ ] Run it, watch it fail on the missing module.
- [ ] Implement `fracToWorld`, `worldToFrac`, `roundFrac` (4dp — brick-icons' precision, chosen so a stored diff shows meaning rather than float noise), and `fracContains` / `fracIntersects` for the store's hit-test.
- [ ] Guard the degenerate box explicitly: a content box with a zero side converts to zeros, not to `NaN`. Assert that, because `NaN` propagates silently through every later comparison.
- [ ] Tests pass; commit.

### Task 3: staleness

- [ ] **Failing test first** (`staleness.test.ts`), asserting the four behaviors that matter: a snapshot over the declared keys ignores undeclared ones; an unchanged config is not stale; a changed declared key is stale; a key absent from an older `seen` is ignored rather than treated as changed. That last one is what lets a stored mark survive a target gaining a new dependency.
- [ ] Also assert: no `seen` at all is not stale, and no declared keys means never stale.
- [ ] Implement `seenFrom(config, keys)` and `isStale(seen, config, keys)`.
- [ ] Tests pass; commit.

### Task 4: the store

- [ ] **Failing test first** (`store.test.ts`) covering, one `it` each: `add` then `get` round-trips every field; `query` filters by target / kind / status / tags / `where`; `hitTest` finds a mark under a point and respects `tol`; `within` finds marks inside a box and excludes ones merely touching it; `update` patches meaning without moving geometry; `setMeta` replaces meta only; `remove` drops it; `subscribe` fires on each mutation and stops after unsubscribe; `toJSON` → `fromJSON` round-trips and the result is `JSON.parse(JSON.stringify(...))`-clean.
- [ ] Watch them fail on the missing module.
- [ ] Implement `createAnnotationStore({ scene, targets })`. One scene layer, `'marks'`. A mark is a leaf whose pose is its world bounds and whose `data` is `AnnotationData`. `add` converts frac→world, snapshots `seen` from the target's `positionDependsOn`, and returns the new id.
- [ ] `toJSON` emits `{ version: 1, scene: scene.toJSON() }`. Assert JSON-safety directly — `expect(JSON.parse(JSON.stringify(out))).toEqual(out)` — rather than trusting the shape by eye.
- [ ] Tests pass; commit.

### Task 5: gate

- [ ] `npx tsc --noEmit && npm run lint && npm test`, all in the foreground, output read.
- [ ] `npx playwright test --config=tests/visual/playwright.config.ts` — `npm test` does not run it.
- [ ] No screenshot needed: this arc renders nothing. Say so rather than skipping silently.
- [ ] Changeset, `patch`. `npm run check:bumps`.

---

## Merging

`git merge main` then `git -C .claude/worktrees/trunk merge --ff-only labkit/annotations`. Leave that worktree. **`main` has never been pushed; pushing needs Mike's explicit say-so.** Delete this plan in the merge commit.
